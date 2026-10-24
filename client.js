window.__ModuleLoader__.load({
  id: '@local/delete-session',
  factory(require) {
    const React = require('react')
    const { MenuItemButton } = require('@deepseek-ai/dsh-client-ui-primitives')
    const h = React.createElement

    const NS = 'dshDeleteSession'
    const ENDPOINT = '/dsh-session-delete'

    const en = {
      'menu.deleteSession': 'Delete session',
      'dialog.title': 'Delete this session permanently?',
      'dialog.body':
        'This permanently deletes every message, attachment, and generated record of \u201c{title}\u201d. It cannot be undone.',
      'dialog.untitled': 'this session',
      'dialog.cancel': 'Cancel',
      'dialog.confirm': 'Delete permanently',
      'dialog.deleting': 'Deleting\u2026',
      'dialog.failed': 'Delete failed: {message}',
      'toast.done': 'Session permanently deleted',
    }

    const zh = {
      'menu.deleteSession': '\u5220\u9664\u4f1a\u8bdd',
      'dialog.title': '\u5f7b\u5e95\u5220\u9664\u8fd9\u4e2a\u4f1a\u8bdd\uff1f',
      'dialog.body':
        '\u5c06\u6c38\u4e45\u5220\u9664\u300c{title}\u300d\u7684\u5168\u90e8\u6d88\u606f\u3001\u9644\u4ef6\u4e0e\u751f\u6210\u8bb0\u5f55\uff0c\u6b64\u64cd\u4f5c\u65e0\u6cd5\u64a4\u9500\u3002',
      'dialog.untitled': '\u6b64\u4f1a\u8bdd',
      'dialog.cancel': '\u53d6\u6d88',
      'dialog.confirm': '\u6c38\u4e45\u5220\u9664',
      'dialog.deleting': '\u6b63\u5728\u5220\u9664\u2026',
      'dialog.failed': '\u5220\u9664\u5931\u8d25\uff1a{message}',
      'toast.done': '\u4f1a\u8bdd\u5df2\u5f7b\u5e95\u5220\u9664',
    }

    const DANGER_CSS = `
.dsh-del-danger button[role="menuitem"]:hover:not(:disabled),
.dsh-del-danger button[role="menuitem"]:focus-visible:not(:disabled){background:var(--dsw-alias-interactive-bg-hover)}
`

    const DIALOG_CSS = `
.dsh-del-backdrop{position:fixed;inset:0;z-index:10000;display:flex;align-items:center;justify-content:center;box-sizing:border-box;padding:24px;background:rgba(0,0,0,.38);pointer-events:auto}
.dsh-del-panel{box-sizing:border-box;width:min(440px,100%);padding:20px;border:1px solid var(--dsw-alias-border-l1);border-radius:12px;background:var(--dsw-alias-bg-overlay);color:var(--dsw-alias-label-primary);box-shadow:0 18px 60px rgba(0,0,0,.35);font-family:inherit}
.dsh-del-title{margin:0 0 10px;font-size:16px;font-weight:600;line-height:1.4;color:var(--dsw-alias-label-primary)}
.dsh-del-body{margin:0;font-size:13px;line-height:1.65;color:var(--dsw-alias-label-secondary);overflow-wrap:anywhere}
.dsh-del-error{margin:12px 0 0;padding:8px 10px;border-radius:6px;border:1px solid var(--dsw-alias-state-error-primary);color:var(--dsw-alias-state-error-primary);font-size:12px;line-height:1.5;overflow-wrap:anywhere}
.dsh-del-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:20px}
.dsh-del-btn{min-height:32px;padding:6px 14px;border-radius:6px;font:inherit;font-size:13px;line-height:1.2;cursor:pointer}
.dsh-del-btn:disabled{cursor:default;opacity:.6}
.dsh-del-cancel{border:1px solid var(--dsw-alias-border-l2);background:transparent;color:var(--dsw-alias-label-primary)}
.dsh-del-cancel:hover:not(:disabled){background:var(--dsw-alias-bg-layer-2)}
.dsh-del-confirm{border:1px solid var(--dsw-alias-state-error-primary);background:color-mix(in srgb,var(--dsw-alias-state-error-primary) 16%,transparent);color:var(--dsw-alias-state-error-primary);font-weight:600}
.dsh-del-confirm:hover:not(:disabled){background:color-mix(in srgb,var(--dsw-alias-state-error-primary) 26%,transparent)}
.dsh-del-btn:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:2px}
.dsh-del-toast{position:fixed;right:24px;bottom:24px;z-index:10001;max-width:min(360px,calc(100vw - 48px));padding:10px 14px;border:1px solid var(--dsw-alias-border-l1);border-radius:8px;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);box-shadow:0 12px 36px rgba(0,0,0,.28);font-family:inherit;font-size:13px;line-height:1.5;pointer-events:none}
`

    /** Small external store shared by the menu row and the frame overlay. */
    function createRequestStore() {
      let value = null
      let sequence = 0
      const listeners = new Set()
      return {
        get: () => value,
        subscribe(listener) {
          listeners.add(listener)
          return () => listeners.delete(listener)
        },
        open(sessionId, title) {
          value = { sessionId, title, seq: ++sequence }
          for (const listener of listeners) listener()
        },
        close() {
          value = null
          for (const listener of listeners) listener()
        },
      }
    }

    function useStore(store) {
      const [value, setValue] = React.useState(store.get())
      React.useEffect(
        () => store.subscribe(() => setValue(store.get())),
        [store],
      )
      return value
    }

    function TrashIcon({ size = 14 }) {
      return h(
        'svg',
        {
          viewBox: '0 0 1024 1024',
          width: size,
          height: size,
          fill: 'currentColor',
          'aria-hidden': true,
          focusable: false,
        },
        h('path', {
          d: 'M160 256H96a32 32 0 0 1 0-64h256V95.936a32 32 0 0 1 32-32h256a32 32 0 0 1 32 32V192h256a32 32 0 1 1 0 64h-64v672a32 32 0 0 1-32 32H192a32 32 0 0 1-32-32V256zm448-64v-64H416v64h192zM224 896h576V256H224v640zm192-128a32 32 0 0 1-32-32V416a32 32 0 0 1 64 0v320a32 32 0 0 1-32 32zm192 0a32 32 0 0 1-32-32V416a32 32 0 0 1 64 0v320a32 32 0 0 1-32 32z',
        }),
      )
    }

    function DeleteMenuItem({ sessionId, displayTitle, requestDelete, useMenuOpenState, t }) {
      const [, setMenuOpen] = useMenuOpenState()
      return h(
        'div',
        { className: 'dsh-del-danger' },
        h('style', null, DANGER_CSS),
        h(
          MenuItemButton,
          {
            danger: true,
            separatorBefore: true,
            icon: h(TrashIcon, { size: 14 }),
            onSelect: () => {
              setMenuOpen(false)
              requestDelete(sessionId, displayTitle)
            },
          },
          t('menu.deleteSession'),
        ),
      )
    }

    function DeleteDialog({ requests, t }) {
      const request = useStore(requests)
      const [busy, setBusy] = React.useState(false)
      const [error, setError] = React.useState(null)
      const [toast, setToast] = React.useState(null)
      const toastTimer = React.useRef(undefined)
      const titleId = React.useId()
      const bodyId = React.useId()

      React.useEffect(() => {
        if (request === null) return
        setBusy(false)
        setError(null)
      }, [request?.seq])

      React.useEffect(() => {
        if (request === null) return undefined
        const onKeyDown = (event) => {
          if (event.key === 'Escape' && !busy) requests.close()
        }
        window.addEventListener('keydown', onKeyDown)
        return () => window.removeEventListener('keydown', onKeyDown)
      }, [request, busy, requests])

      React.useEffect(
        () => () => {
          if (toastTimer.current !== undefined) clearTimeout(toastTimer.current)
        },
        [],
      )

      const showToast = (message) => {
        setToast(message)
        if (toastTimer.current !== undefined) clearTimeout(toastTimer.current)
        toastTimer.current = setTimeout(() => {
          toastTimer.current = undefined
          setToast(null)
        }, 4000)
      }

      const close = () => {
        if (busy) return
        requests.close()
        setError(null)
      }

      const confirm = async () => {
        if (busy || request === null) return
        setBusy(true)
        setError(null)
        try {
          await deleteOnHost(request.sessionId)
          requests.close()
          showToast(t('toast.done'))
        } catch (reason) {
          setError(reason instanceof Error ? reason.message : String(reason))
        } finally {
          setBusy(false)
        }
      }

      return h(
        React.Fragment,
        null,
        h('style', null, DIALOG_CSS),
        request !== null &&
          h(
            'div',
            {
              className: 'dsh-del-backdrop',
              onMouseDown: (event) => {
                if (event.target === event.currentTarget) close()
              },
            },
            h(
              'div',
              {
                className: 'dsh-del-panel',
                role: 'dialog',
                'aria-modal': 'true',
                'aria-labelledby': titleId,
                'aria-describedby': bodyId,
              },
              h('h2', { className: 'dsh-del-title', id: titleId }, t('dialog.title')),
              h(
                'p',
                { className: 'dsh-del-body', id: bodyId },
                t('dialog.body', {
                  title: request.title.length > 0 ? request.title : t('dialog.untitled'),
                }),
              ),
              error !== null &&
                h(
                  'div',
                  { className: 'dsh-del-error', role: 'alert' },
                  t('dialog.failed', { message: error }),
                ),
              h(
                'div',
                { className: 'dsh-del-actions' },
                h(
                  'button',
                  {
                    type: 'button',
                    className: 'dsh-del-btn dsh-del-cancel',
                    autoFocus: true,
                    disabled: busy,
                    onClick: close,
                  },
                  t('dialog.cancel'),
                ),
                h(
                  'button',
                  {
                    type: 'button',
                    className: 'dsh-del-btn dsh-del-confirm',
                    disabled: busy,
                    onClick: confirm,
                  },
                  busy ? t('dialog.deleting') : t('dialog.confirm'),
                ),
              ),
            ),
          ),
        toast !== null && h('div', { className: 'dsh-del-toast', role: 'status' }, toast),
      )
    }

    async function deleteOnHost(sessionId) {
      const init = {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ sessionId }),
      }
      const target = ENDPOINT.slice(1)
      const transport = globalThis.__DSH_TRANSPORT__
      const response = typeof transport?.fetch === 'function'
        ? await transport.fetch(target, init)
        : await fetch(target, init)
      const text = await response.text()
      let payload
      try {
        payload = text.length > 0 ? JSON.parse(text) : null
      } catch {
        throw new Error(text.length > 0 ? text : `HTTP ${response.status}`)
      }
      if (!response.ok || payload === null || payload.ok !== true) {
        throw new Error(payload?.message ?? `HTTP ${response.status}`)
      }
      return payload
    }

    return {
      inject: ['slots', 'locale'],
      apply(ctx) {
        const requests = createRequestStore()
        ctx.effect(
          () => ctx.locale.register(NS, { en, zh }),
          'dsh-delete-session: dictionaries',
        )

        ctx.slots.inject('sidebar.workspaces.session.menu.item', () =>
          ctx.slots.register(
            {
              name: 'sidebar.workspaces.session.menu.item',
              id: 'delete-session',
              order: 410,
              locale: NS,
              inject: () => ({
                requestDelete: (sessionId, title) => requests.open(sessionId, title),
              }),
            },
            DeleteMenuItem,
          ),
        )

        ctx.slots.inject('shell.overlay', () =>
          ctx.slots.register(
            {
              name: 'shell.overlay',
              id: 'delete-session-dialog',
              order: 1000,
              locale: NS,
              inject: () => ({ requests }),
            },
            DeleteDialog,
          ),
        )
      },
    }
  },
})
