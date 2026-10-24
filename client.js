window.__ModuleLoader__.load({
  id: '@local/session-delete',
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

    function SessionDeleteIcon({ size = 14 }) {
      return h(
        'svg',
        {
          viewBox: '0 0 32 32',
          width: size,
          height: size,
          fill: '#8B1A1A',
          'aria-hidden': true,
          focusable: false,
        },
        h('path', {
          d: 'M27,4H5C3.3,4,2,5.3,2,7v18c0,1.7,1.3,3,3,3h10.4c-0.9-1.5-1.4-3.2-1.4-5c0-5.5,4.5-10,10-10c2.3,0,4.3,0.8,6,2V7 C30,5.3,28.7,4,27,4z M7.9,8.4C7.9,8.5,7.8,8.6,7.7,8.7C7.5,8.9,7.3,9,7,9S6.5,8.9,6.3,8.7C6.1,8.5,6,8.3,6,8c0-0.3,0.1-0.5,0.3-0.7 c0,0,0.1-0.1,0.1-0.1c0.1,0,0.1-0.1,0.2-0.1C6.7,7,6.7,7,6.8,7c0.1,0,0.3,0,0.4,0c0.1,0,0.1,0,0.2,0.1c0.1,0,0.1,0.1,0.2,0.1 c0,0,0.1,0.1,0.1,0.1c0.1,0.1,0.2,0.2,0.2,0.3C8,7.7,8,7.9,8,8C8,8.1,8,8.3,7.9,8.4z M10.7,8.7C10.5,8.9,10.3,9,10,9 C9.7,9,9.5,8.9,9.3,8.7C9.1,8.5,9,8.3,9,8c0-0.1,0-0.3,0.1-0.4c0.1-0.1,0.1-0.2,0.2-0.3c0.1-0.1,0.2-0.2,0.3-0.2 C10,6.9,10.4,7,10.7,7.3c0.1,0.1,0.2,0.2,0.2,0.3C11,7.7,11,7.9,11,8C11,8.3,10.9,8.5,10.7,8.7z M13.9,8.4c-0.1,0.1-0.1,0.2-0.2,0.3 C13.5,8.9,13.3,9,13,9c-0.1,0-0.3,0-0.4-0.1c-0.1-0.1-0.2-0.1-0.3-0.2c-0.1-0.1-0.2-0.2-0.2-0.3C12,8.3,12,8.1,12,8 c0-0.1,0-0.3,0.1-0.4c0.1-0.1,0.1-0.2,0.2-0.3c0.4-0.4,1-0.4,1.4,0c0.1,0.1,0.2,0.2,0.2,0.3C14,7.7,14,7.9,14,8 C14,8.1,14,8.3,13.9,8.4z',
        }),
        h('path', {
          d: 'M18.3,17.3c-3.1,3.1-3.1,8.2,0,11.3s8.2,3.1,11.3,0s3.1-8.2,0-11.3S21.5,14.2,18.3,17.3z M26.8,21.6L25.4,23l1.4,1.4 c0.4,0.4,0.4,1,0,1.4c-0.4,0.4-1,0.4-1.4,0L24,24.4l-1.4,1.4c-0.4,0.4-1,0.4-1.4,0c-0.4-0.4-0.4-1,0-1.4l1.4-1.4l-1.4-1.4 c-0.4-0.4-0.4-1,0-1.4c0.4-0.4,1-0.4,1.4,0l1.4,1.4l1.4-1.4c0.4-0.4,1-0.4,1.4,0C27.2,20.6,27.2,21.2,26.8,21.6z',
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
            icon: h(SessionDeleteIcon, { size: 14 }),
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
