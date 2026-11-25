/**
 * Client half of dsh-plugin-omo: the always-mode selector.
 *
 * Renders one trigger in the composer bar and a popover menu styled like the permission
 * control (same panel, row, hover and checkmark treatment), listing Native plus the four omo
 * primary agents. A CSS order rule moves the permission group to the right of this control.
 *
 * The selection is stored by the host plugin and injected as a per-session system prompt
 * directive, so it applies to every turn while it is set.
 */
window.__ModuleLoader__.load({
  id: 'dsh-plugin-omo',
  factory(require) {
    'use strict'
    const React = require('react')
    const ReactDOM = require('react-dom')
    const h = React.createElement

    const SLOT = 'conversation.input.left'
    const ROUTE = '/dsh-plugin-omo/mode'
    const MODES = ['native', 'sisyphus', 'hephaestus', 'prometheus', 'atlas']
    const LABELS = {
      native: 'Native',
      sisyphus: 'Sisyphus',
      hephaestus: 'Hephaestus',
      prometheus: 'Prometheus',
      atlas: 'Atlas',
    }
    const ROOT_ATTR = 'data-omo-mode-root'
    const STYLE_ID = 'dsh-plugin-omo/mode.module.css'
    const CSS = [
      '[' + ROOT_ATTR + ']{order:1;display:inline-flex;align-items:center}',
      /* The permission group is the sibling right before this control; order puts it on the right. */
      '*:has(> [' + ROOT_ATTR + ']) > *:has(+ [' + ROOT_ATTR + ']){order:2}',
      '.dsh-omo-trigger{display:inline-flex;align-items:center;gap:6px;padding:1px 8px;height:28px;border:none;',
      'border-radius:var(--dsw-radius-sm);background:transparent;color:var(--dsw-alias-label-tertiary);',
      'font-family:inherit;font-size:13px;font-weight:500;line-height:20px;white-space:nowrap;cursor:pointer}',
      '.dsh-omo-trigger:hover,.dsh-omo-trigger[aria-expanded=true]{background:var(--dsw-alias-interactive-bg-hover);',
      'color:var(--dsw-alias-label-secondary)}',
      '.dsh-omo-chevron{display:inline-flex;flex:none;opacity:.8}',
      '.dsh-omo-panel{position:fixed;z-index:1100;box-sizing:border-box;min-width:184px;max-width:min(264px,100vw - 24px);',
      'padding:6px;border-radius:var(--dsw-radius-lg);background:var(--dsw-specific-menu);',
      'backdrop-filter:var(--dsw-menu-backdrop-filter);box-shadow:var(--dsw-elevation-prominent);',
      'border:1px solid var(--dsw-alias-border-l1);color:var(--dsw-alias-label-primary);font-size:13px;line-height:20px}',
      '.dsh-omo-row{display:flex;align-items:center;gap:8px;width:100%;padding:6px 8px;border:none;background:transparent;',
      'border-radius:var(--dsw-radius-md);color:inherit;font-family:inherit;font-size:inherit;text-align:left;cursor:pointer}',
      '.dsh-omo-row:hover{background:var(--dsw-alias-interactive-bg-hover)}',
      '.dsh-omo-row[data-active=true]{color:var(--dsw-alias-label-primary)}',
      '.dsh-omo-glyph{display:inline-flex;flex:none;place-items:center;width:16px;height:16px;color:var(--dsw-alias-label-secondary)}',
      '.dsh-omo-label{flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      '.dsh-omo-check{display:inline-flex;flex:none;width:16px;height:16px;place-items:center;color:var(--dsw-alias-label-primary)}',
    ].join('')

    function mountStyles() {
      if (typeof document === 'undefined') return () => undefined
      if (document.querySelector('style[data-plugin-css="' + STYLE_ID + '"]') !== null) return () => undefined
      const tag = document.createElement('style')
      tag.dataset.plugin = 'dsh-plugin-omo'
      tag.dataset.pluginCss = STYLE_ID
      tag.textContent = CSS
      document.head.appendChild(tag)
      return () => {
        tag.remove()
      }
    }

    function isZh() {
      const lang = typeof navigator !== 'undefined' ? String(navigator.language || '') : ''
      return lang.toLowerCase().startsWith('zh')
    }

    function requestUrl(sessionId) {
      return sessionId === undefined || sessionId === ''
        ? ROUTE
        : ROUTE + '?sessionId=' + encodeURIComponent(sessionId)
    }

    async function readMode(sessionId) {
      const response = await fetch(requestUrl(sessionId), { credentials: 'same-origin' })
      if (!response.ok) throw new Error('mode read failed: ' + response.status)
      const payload = await response.json()
      return MODES.includes(payload.mode) ? payload.mode : 'native'
    }

    async function writeMode(sessionId, mode) {
      const response = await fetch(ROUTE, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ sessionId, mode }),
      })
      if (!response.ok) throw new Error('mode write failed: ' + response.status)
      const payload = await response.json()
      return MODES.includes(payload.mode) ? payload.mode : mode
    }

    const SVG = {
      mode: 'M8 1.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13Zm0 1.5a5 5 0 1 1 0 10 5 5 0 0 1 0-10Zm2.7 3.2-3.4 3.4-1.6-1.6',
      chevron: 'M3 4.5 6 7.5 9 4.5',
      check: 'M2.5 6.2 5 8.7l4.5-4.5',
    }

    function icon(path, size, width) {
      return h(
        'svg',
        { viewBox: '0 0 ' + size + ' ' + size, width: size, height: size, 'aria-hidden': 'true', fill: 'none' },
        h('path', {
          d: path,
          stroke: 'currentColor',
          strokeWidth: width || 1.5,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
        }),
      )
    }

    function ModeSelect({ sessionId }) {
      const [mode, setMode] = React.useState('native')
      const [open, setOpen] = React.useState(false)
      const [anchor, setAnchor] = React.useState(null)
      const rootRef = React.useRef(null)
      const panelRef = React.useRef(null)
      const buttonRef = React.useRef(null)

      // Put this control in front of the permission group. Done in the DOM because the slot may wrap
      // us in an extra element, which makes a pure CSS sibling selector unreliable.
      React.useLayoutEffect(() => {
        const el = rootRef.current
        if (!el) return undefined
        const parent = el.parentElement
        if (!parent) return undefined
        const row = parent.parentElement ?? parent
        const self = parent === row ? el : parent
        self.style.order = '1'
        const previous = self.previousElementSibling
        if (previous instanceof HTMLElement) previous.style.order = '2'
        return () => {
          self.style.order = ''
          if (previous instanceof HTMLElement) previous.style.order = ''
        }
      }, [])

      React.useEffect(() => {
        let alive = true
        readMode(sessionId)
          .then((next) => {
            if (alive) setMode(next)
          })
          .catch(() => {})
        return () => {
          alive = false
        }
      }, [sessionId])

      React.useEffect(() => {
        if (!open) return undefined
        const onPointerDown = (event) => {
          const target = event.target
          if (rootRef.current?.contains(target) || panelRef.current?.contains(target)) return
          setOpen(false)
        }
        const onKeyDown = (event) => {
          if (event.key === 'Escape') {
            setOpen(false)
            buttonRef.current?.focus?.()
          }
        }
        /* A fixed panel cannot follow a scrolling composer; closing is cheaper and never lies. */
        const onDismiss = () => setOpen(false)
        document.addEventListener('pointerdown', onPointerDown, true)
        document.addEventListener('keydown', onKeyDown)
        window.addEventListener('resize', onDismiss)
        window.addEventListener('scroll', onDismiss, true)
        return () => {
          document.removeEventListener('pointerdown', onPointerDown, true)
          document.removeEventListener('keydown', onKeyDown)
          window.removeEventListener('resize', onDismiss)
          window.removeEventListener('scroll', onDismiss, true)
        }
      }, [open])

      const toggle = React.useCallback(() => {
        setOpen((current) => {
          if (current) return false
          const rect = buttonRef.current?.getBoundingClientRect?.()
          if (rect) {
            const width = 200
            const gap = 8
            const left = Math.max(12, Math.min(rect.left, window.innerWidth - width - 12))
            /* Both edges come from the trigger, so the panel hugs it without measuring itself. */
            setAnchor({
              left,
              width,
              bottom: window.innerHeight - rect.top + gap,
              maxHeight: Math.max(120, rect.top - gap - 12),
            })
          }
          return true
        })
      }, [])

      const choose = React.useCallback(
        (next) => {
          setMode(next)
          setOpen(false)
          writeMode(sessionId, next)
            .then((stored) => setMode(stored))
            .catch(() => {})
        },
        [sessionId],
      )

      const zh = isZh()
      const label = LABELS[mode]
      return h(
        'div',
        { ref: rootRef, [ROOT_ATTR]: mode },
        h(
          'button',
          {
            ref: buttonRef,
            type: 'button',
            className: 'dsh-omo-trigger',
            'aria-haspopup': 'menu',
            'aria-expanded': open,
            'aria-label': (zh ? '始终模式：' : 'Always mode: ') + label,
            title: zh ? '始终模式：选中后对该会话每一轮都生效' : 'Always mode: applies to every turn of this session',
            onClick: toggle,
          },
          h('span', { className: 'dsh-omo-glyph', 'aria-hidden': 'true' }, icon(SVG.mode, 16)),
          h('span', { className: 'dsh-omo-label' }, label),
          h('span', { className: 'dsh-omo-chevron', 'aria-hidden': 'true' }, icon(SVG.chevron, 12)),
        ),
        open && anchor !== null && typeof document !== 'undefined'
          /* Portaled to body: the composer card establishes a containing block for fixed
             descendants (backdrop-filter/transform), which would push the panel far away. */
          ? ReactDOM.createPortal(
              h(
              'div',
              {
                ref: panelRef,
                className: 'dsh-omo-panel',
                role: 'menu',
                'aria-label': zh ? '始终模式' : 'Always mode',
                style: {
                  left: anchor.left + 'px',
                  bottom: anchor.bottom + 'px',
                  width: anchor.width + 'px',
                  maxHeight: anchor.maxHeight + 'px',
                  overflowY: 'auto',
                },
              },
              MODES.map((id) =>
                h(
                  'button',
                  {
                    key: id,
                    type: 'button',
                    role: 'menuitemradio',
                    'aria-checked': id === mode,
                    'data-active': id === mode,
                    className: 'dsh-omo-row',
                    onClick: () => choose(id),
                  },
                  h('span', { className: 'dsh-omo-glyph', 'aria-hidden': 'true' }, icon(SVG.mode, 16)),
                  h('span', { className: 'dsh-omo-label' }, LABELS[id]),
                  h(
                    'span',
                    { className: 'dsh-omo-check', 'aria-hidden': 'true' },
                    id === mode ? icon(SVG.check, 12, 1.8) : null,
                  ),
                ),
              ),
              ),
              document.body,
            )
          : null,
      )
    }
    ModeSelect.__test = { MODES, LABELS, requestUrl, CSS }

    function apply(ctx) {
      ctx.effect(() => mountStyles(), 'dsh-plugin-omo: mode styles')
      ctx.slots.inject(SLOT, () => {
        ctx.slots.register(
          {
            name: SLOT,
            id: 'omo-mode',
            order: 20,
            inject: (sessionId) => ({ sessionId }),
          },
          ModeSelect,
        )
      })
    }

    return { name: 'dsh-plugin-omo', inject: ['slots'], apply }
  },
})
