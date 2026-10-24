/**
 * Host half of the permanent-session-deletion bundle.
 *
 * The plugin owns one exact route on the Harness web server. The browser half
 * calls it after the user confirms; this half removes every durable and
 * derived artifact owned by the selected Session. The route applies the same
 * Host/Origin and browser-session admission as `/api`.
 */
import { createHash } from 'node:crypto'
import { readdir, rm, rmdir } from 'node:fs/promises'
import { homedir } from 'node:os'
import { dirname, join, resolve } from 'node:path'

/** Stable route used by the Client half. */
const ROUTE = '/dsh-session-delete'
const MAX_BODY_BYTES = 16 * 1024
const SESSION_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,200}$/

export const inject = [
  'webServer',
  'connection',
  'sessionPersistence',
  'sessionQuery',
  'workspaceRegistry',
]

class DeleteSessionError extends Error {
  constructor(message) {
    super(message)
    this.name = 'DeleteSessionError'
  }
}

/** Add one effect-owned HTTP route. */
export function apply(ctx) {
  ctx.effect(
    () =>
      ctx.webServer.register({
        kind: 'exact',
        path: ROUTE,
        handler: (req, res) => handleRequest(ctx, req, res),
      }),
    'dsh-delete-session: route',
  )
}

/** Answer one deletion request. */
async function handleRequest(ctx, req, res) {
  const rejection = ctx.connection.requestRejection(req)
  if (rejection !== undefined) {
    res.writeHead(rejection)
    res.end(rejection === 401 ? 'unauthorized' : 'forbidden')
    return
  }
  if (req.method !== 'POST') {
    sendJson(res, 405, { ok: false, message: 'method not allowed' })
    return
  }
  if (mediaType(req.headers['content-type']) !== 'application/json') {
    sendJson(res, 415, { ok: false, message: 'content-type must be application/json' })
    return
  }

  let body
  try {
    body = await readJsonBody(req)
  } catch (error) {
    sendJson(res, 400, { ok: false, message: error instanceof Error ? error.message : String(error) })
    return
  }

  const sessionId = body !== null && typeof body === 'object' ? body.sessionId : undefined
  if (typeof sessionId !== 'string' || !SESSION_ID.test(sessionId)) {
    sendJson(res, 400, { ok: false, message: 'invalid sessionId' })
    return
  }

  try {
    const result = await deleteSession(ctx, sessionId)
    if (result === null) {
      sendJson(res, 404, { ok: false, message: `session "${sessionId}" was not found` })
      return
    }
    sendJson(res, 200, { ok: true, ...result })
  } catch (error) {
    ctx.logger.warn(`dsh-delete-session: ${sessionId}: ${String(error)}`)
    sendJson(res, 500, {
      ok: false,
      message: error instanceof Error ? error.message : String(error),
    })
  }
}

/**
 * Delete one Session and the data only it owns.
 *
 * Shared content-addressed attachment objects are removed only after every
 * remaining Session has been scanned for a reference; if any scan fails, no
 * attachment is removed (conservative over complete).
 */
async function deleteSession(ctx, sessionId) {
  const persistence = ctx.sessionPersistence
  const snapshot = await persistence.stat(sessionId).catch(() => undefined)
  const liveSession = ctx.get('sessions')?.get?.(sessionId)
  const liveAgent = ctx.get('agents')?.get?.(sessionId)
  if (snapshot === undefined && liveSession === undefined && liveAgent === undefined) return null

  const root = persistence.root
  if (typeof root !== 'string' || root.length === 0) {
    throw new DeleteSessionError('the session persistence backend does not expose its root directory')
  }
  const sessionDir = await locateSessionDir(root, snapshot?.header?.cwd, sessionId)

  // Read the target log before any destructive step so attachment references
  // survive the deletion.
  let targetRefs = new Map()
  let attachmentsReadable = true
  try {
    const { events } = await ctx.sessionQuery.readSession(sessionId)
    collectAttachmentRefs(events, targetRefs)
  } catch (error) {
    attachmentsReadable = false
    ctx.logger.warn(`dsh-delete-session: could not read ${sessionId} for attachment references: ${String(error)}`)
  }

  // Stop the Session's running work first. The registry's archive path is the
  // shipped owner of turn, subagent, job, and schedule stops.
  try {
    await ctx.workspaceRegistry.archiveSession(sessionId, { stopActivity: true })
  } catch (error) {
    ctx.logger.warn(`dsh-delete-session: could not stop ${sessionId} through the workspace registry: ${String(error)}`)
  }

  await deleteSchedules(ctx, sessionId)
  await deleteJobs(ctx, sessionId)
  await deleteTerminals(ctx, liveAgent)

  // Release the in-memory Session/Agent so the list, lookup, and a page reload
  // cannot resurrect the deleted identity. The agent-scoped context is disposed
  // after its turn has been cancelled and drained.
  const retiredLive = await retireLive(ctx, sessionId, liveAgent, liveSession)

  // Remove Workspace accounting while the log still exists: the registry filters
  // Session membership through the canonical-cwd index.
  await detachFromWorkspaces(ctx, sessionId)

  let removedLog = false
  if (sessionDir !== undefined) {
    try {
      await rm(sessionDir, { recursive: true, force: true })
      removedLog = true
    } catch (error) {
      throw new DeleteSessionError(
        `session files could not be deleted at ${sessionDir}: ${error instanceof Error ? error.message : String(error)}`,
      )
    }
    await rmdir(dirname(sessionDir)).catch(() => {})
  }

  await deleteProjectionCache(ctx, sessionId)
  const attachmentReport = attachmentsReadable
    ? await deleteUnreferencedAttachments(ctx, sessionId, targetRefs)
    : { removed: 0, skipped: true, reason: 'the deleted log could not be read' }
  await deleteSpill(ctx, sessionId)

  ctx.emit('api-session/removed', sessionId)
  return {
    deleted: true,
    live: retiredLive,
    removedLog,
    sessionDir: removedLog ? sessionDir : undefined,
    attachments: attachmentReport,
  }
}

/** Delete the Session's durable schedules, including completed delivery rows. */
async function deleteSchedules(ctx, sessionId) {
  const schedule = ctx.get('schedule')
  if (schedule === undefined) return
  try {
    const rows = await schedule.catalog()
    for (const row of rows) {
      if (row.sessionId !== sessionId) continue
      await schedule.delete({ sessionId, id: row.id }).catch((error) => {
        ctx.logger.warn(`dsh-delete-session: schedule ${row.id} deletion failed: ${String(error)}`)
      })
    }
  } catch (error) {
    ctx.logger.warn(`dsh-delete-session: schedule catalog read failed: ${String(error)}`)
  }
}

/** Stop live background jobs and drop settled records owned by the Session. */
async function deleteJobs(ctx, sessionId) {
  const jobs = ctx.get('jobs')
  if (jobs === undefined) return
  try {
    for (const job of jobs.list(sessionId)) {
      try {
        if (job.status === 'running' || job.status === 'stopping') jobs.kill(job.id, sessionId, 'session deleted')
        else jobs.remove(job.id, sessionId)
      } catch (error) {
        ctx.logger.warn(`dsh-delete-session: job ${job.id} cleanup failed: ${String(error)}`)
      }
    }
  } catch (error) {
    ctx.logger.warn(`dsh-delete-session: job list failed: ${String(error)}`)
  }
}

/** Close terminals owned by the live Agent, when one exists. */
async function deleteTerminals(ctx, agent) {
  const terminals = ctx.get('terminals')
  if (terminals === undefined || agent === undefined) return
  try {
    for (const terminal of terminals.list(agent)) {
      await terminals.kill(agent, terminal.id, 'session deleted').catch((error) => {
        ctx.logger.warn(`dsh-delete-session: terminal ${terminal.id} cleanup failed: ${String(error)}`)
      })
    }
  } catch (error) {
    ctx.logger.warn(`dsh-delete-session: terminal list failed: ${String(error)}`)
  }
}

/**
 * Cancel, drain, and remove one live Agent/Session from the in-memory stores.
 * The Session log is the source of truth; removing the store entries makes a
 * reconnect, a list refresh, and `agents.get` agree that the identity is gone.
 */
async function retireLive(ctx, sessionId, agent, session) {
  if (agent === undefined && session === undefined) return false
  if (agent !== undefined) {
    try {
      if (typeof agent.cancel === 'function') agent.cancel({ kind: 'disposed' })
    } catch (error) {
      ctx.logger.warn(`dsh-delete-session: agent cancel failed: ${String(error)}`)
    }
    try {
      if (typeof agent.whenIdle === 'function') await bounded(agent.whenIdle(), 4000)
    } catch (error) {
      ctx.logger.warn(`dsh-delete-session: agent drain failed: ${String(error)}`)
    }
    try {
      if (agent.scope !== undefined && typeof agent.scope.dispose === 'function') await agent.scope.dispose()
    } catch (error) {
      ctx.logger.warn(`dsh-delete-session: agent scope disposal failed: ${String(error)}`)
    }
  }
  const agents = ctx.get('agents')
  const sessions = ctx.get('sessions')
  if (agents?.store instanceof Map) agents.store.delete(sessionId)
  if (sessions?.store instanceof Map) sessions.store.delete(sessionId)
  return true
}

/** Drop archive, pin, and Workspace membership for the Session. */
async function detachFromWorkspaces(ctx, sessionId) {
  const registry = ctx.workspaceRegistry
  await registry.unarchiveSession(sessionId).catch((error) => {
    ctx.logger.warn(`dsh-delete-session: unarchive failed: ${String(error)}`)
  })
  await registry.unpinSession(sessionId).catch((error) => {
    ctx.logger.warn(`dsh-delete-session: unpin failed: ${String(error)}`)
  })
  for (const workspace of registry.list()) {
    if (!workspace.sessionIds.includes(sessionId)) continue
    await workspace.detachSession(sessionId).catch((error) => {
      ctx.logger.warn(`dsh-delete-session: detach from ${workspace.id} failed: ${String(error)}`)
    })
  }
}

/** Remove the persisted projection checkpoint. */
async function deleteProjectionCache(ctx, sessionId) {
  try {
    const domain = ctx.get('storageDomain')?.get?.('session_projcache')
    if (domain !== undefined) await domain.table('sessions').delete(sessionId)
  } catch (error) {
    ctx.logger.warn(`dsh-delete-session: projection cache domain delete failed: ${String(error)}`)
  }
  const file = join(dshHome(), 'storages', 'session_projcache', 'sessions', `${sessionId}.json`)
  await rm(file, { force: true }).catch(() => {})
}

/**
 * Remove attachment objects no remaining Session references.
 * Content-addressed objects are shared by design, so this is reference-counted
 * by scanning every remaining Session's complete log.
 */
async function deleteUnreferencedAttachments(ctx, deletedId, targetRefs) {
  const attachments = ctx.get('attachments')
  if (attachments === undefined || targetRefs.size === 0) return { removed: 0, skipped: false }
  let records
  try {
    records = await ctx.sessionQuery.listSessions()
  } catch (error) {
    return { removed: 0, skipped: true, reason: `session list failed: ${String(error)}` }
  }

  const remaining = new Set()
  for (const record of records) {
    const id = record.header.id
    if (id === deletedId) continue
    try {
      const { events } = await ctx.sessionQuery.readSession(id)
      collectAttachmentIds(events, remaining)
    } catch (error) {
      return {
        removed: 0,
        skipped: true,
        reason: `could not scan ${id}: ${String(error)}`,
      }
    }
  }

  let removed = 0
  for (const [attachmentId, entry] of targetRefs) {
    if (remaining.has(attachmentId)) continue
    try {
      if (await deleteAttachmentObject(attachments, entry)) removed += 1
    } catch (error) {
      ctx.logger.warn(`dsh-delete-session: attachment ${attachmentId} cleanup failed: ${String(error)}`)
    }
  }
  return { removed, skipped: false }
}

/** Delete one image or verbatim file object, including every file alias. */
async function deleteAttachmentObject(attachments, entry) {
  if (entry.kind === 'image') {
    const path = attachments.imageHostPath(entry.value)
    if (path === undefined) return false
    await rm(path, { force: true })
    return true
  }
  const path = attachments.fileHostPath(entry.value)
  if (path === undefined) return false
  const sha = entry.id
  const aliasDir = dirname(path)
  await rm(aliasDir, { recursive: true, force: true })
  const filesRoot = dirname(dirname(aliasDir))
  const versionRoot = dirname(filesRoot)
  const object = join(versionRoot, 'file-objects', sha.slice(0, 2), sha)
  await rm(object, { force: true })
  return true
}

/** Remove the Session's private spill directory from the active spill root. */
async function deleteSpill(ctx, sessionId) {
  const root = ctx.get('spillStore')?.root
  if (typeof root !== 'string' || root.length === 0) return
  const hash = createHash('sha256').update(sessionId).digest('hex').slice(0, 12)
  await rm(join(root, `session-${hash}`), { recursive: true, force: true }).catch((error) => {
    ctx.logger.warn(`dsh-delete-session: spill cleanup failed: ${String(error)}`)
  })
}

/** Locate the Session-owned directory without trusting a stored cwd. */
async function locateSessionDir(root, cwd, sessionId) {
  const encoded = encodeSegment(sessionId)
  if (typeof cwd === 'string' && cwd.length > 0) {
    const direct = join(root, projectKey(cwd), encoded)
    if (await isDirectory(direct)) return direct
  }
  const entries = await readdir(root, { withFileTypes: true }).catch(() => [])
  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    const candidate = join(root, entry.name, encoded)
    if (await isDirectory(candidate)) return candidate
  }
  return undefined
}

async function isDirectory(path) {
  try {
    const entries = await readdir(path, { withFileTypes: true })
    return Array.isArray(entries)
  } catch {
    return false
  }
}

/** Same injective path-segment encoding as the JSONL persistence backend. */
function encodeSegment(raw) {
  if (raw === '.') return '~002E'
  if (raw === '..') return '~002E~002E'
  let out = ''
  for (let index = 0; index < raw.length; index += 1) {
    const code = raw.charCodeAt(index)
    const char = String.fromCharCode(code)
    if (char !== '~' && /^[A-Za-z0-9._-]$/.test(char)) out += char
    else out += `~${code.toString(16).toUpperCase().padStart(4, '0')}`
  }
  return out
}

/** Same human-navigable project-directory key as the JSONL backend. */
function projectKey(cwd) {
  let readable = ''
  let separatorRun = false
  for (let index = 0; index < cwd.length; index += 1) {
    const code = cwd.charCodeAt(index)
    const char = String.fromCharCode(code)
    if (char === '/' || char === '\\' || char === ':') {
      if (!separatorRun) readable += '-'
      separatorRun = true
    } else if (char !== '~' && /^[A-Za-z0-9._-]$/.test(char)) {
      readable += char
      separatorRun = false
    } else {
      readable += `~${code.toString(16).toUpperCase().padStart(4, '0')}`
      separatorRun = false
    }
  }
  return `--${(readable.replace(/^-+/, '') || 'root').slice(0, 251)}--`
}

/** Collect full attachment references from an event graph. */
function collectAttachmentRefs(value, refs, seen = new Set()) {
  if (value === null || typeof value !== 'object' || seen.has(value)) return
  seen.add(value)
  if (Array.isArray(value)) {
    for (const item of value) collectAttachmentRefs(item, refs, seen)
    return
  }
  if (typeof value.attachmentId === 'string' && value.attachmentId.length > 0) {
    const kind = typeof value.mediaType === 'string' ? 'image' : 'file'
    refs.set(value.attachmentId, { id: value.attachmentId, kind, value })
  }
  for (const item of Object.values(value)) collectAttachmentRefs(item, refs, seen)
}

/** Collect only attachment identities from an event graph. */
function collectAttachmentIds(value, ids, seen = new Set()) {
  if (value === null || typeof value !== 'object' || seen.has(value)) return
  seen.add(value)
  if (Array.isArray(value)) {
    for (const item of value) collectAttachmentIds(item, ids, seen)
    return
  }
  if (typeof value.attachmentId === 'string') ids.add(value.attachmentId)
  for (const item of Object.values(value)) collectAttachmentIds(item, ids, seen)
}

function dshHome() {
  return process.env.DSH_HOME !== undefined && process.env.DSH_HOME.length > 0
    ? resolve(process.env.DSH_HOME)
    : join(homedir(), '.dsh')
}

function mediaType(value) {
  return typeof value === 'string' ? value.split(';', 1)[0]?.trim().toLowerCase() : undefined
}

async function readJsonBody(req) {
  let size = 0
  const chunks = []
  for await (const chunk of req) {
    size += chunk.length
    if (size > MAX_BODY_BYTES) throw new Error('request body is too large')
    chunks.push(chunk)
  }
  if (size === 0) return null
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'))
  } catch {
    throw new Error('body is not JSON')
  }
}

function sendJson(res, status, payload) {
  res.statusCode = status
  res.setHeader('content-type', 'application/json; charset=utf-8')
  res.setHeader('cache-control', 'no-store')
  res.end(JSON.stringify(payload))
}

async function bounded(promise, timeoutMs) {
  let timer
  const timeout = new Promise((resolve) => {
    timer = setTimeout(resolve, timeoutMs)
    timer.unref?.()
  })
  try {
    return await Promise.race([promise, timeout])
  } finally {
    clearTimeout(timer)
  }
}
