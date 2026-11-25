/**
 * Client half of dsh-plugin-omo: the always-mode selector.
 *
 * Renders one native select in the composer bar, left of the permission control,
 * listing the four omo primary agents plus Native ("no mode"). The selection is
 * stored by the host plugin and injected as a per-session system prompt
 * directive, so it applies to every turn while it is set.
 *
 * Loaded through window.__ModuleLoader__ and only depends on the shared React.
 */
window.__ModuleLoader__.load({
  id: 'dsh-plugin-omo',
  factory(require) {
    'use strict'
    const React = require('react')
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
    const STYLE = {
      appearance: 'none',
      background: 'transparent',
      border: 'none',
      borderRadius: 'var(--dsw-radius-sm, 6px)',
      color: 'var(--dsw-alias-label-secondary, #81858c)',
      cursor: 'pointer',
      fontFamily: 'inherit',
      fontSize: '13px',
      fontWeight: 500,
      height: '28px',
      lineHeight: '20px',
      maxWidth: '160px',
      outline: 'none',
      padding: '0 20px 0 8px',
      whiteSpace: 'nowrap',
      backgroundImage:
        "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12' fill='none'%3E%3Cpath d='M3 4.5L6 7.5L9 4.5' stroke='%2381858C' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E\")",
      backgroundPosition: 'right 4px center',
      backgroundRepeat: 'no-repeat',
      backgroundSize: '12px 12px',
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

    function ModeSelect({ sessionId }) {
      const [mode, setMode] = React.useState('native')
      const [pending, setPending] = React.useState(false)
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

      const onChange = React.useCallback(
        (event) => {
          const next = event.target.value
          setMode(next)
          setPending(true)
          writeMode(sessionId, next)
            .then((stored) => setMode(stored))
            .catch(() => {})
            .finally(() => setPending(false))
        },
        [sessionId],
      )

      const zh = isZh()
      return h(
        'label',
        {
          title: zh ? '始终模式：选中后对该会话每一轮都生效' : 'Always mode: applies to every turn of this session',
          style: { display: 'inline-flex', alignItems: 'center', gap: '2px' },
        },
        h('span', { 'aria-hidden': true, style: { display: 'none' } }, zh ? '始终模式' : 'Always mode'),
        h(
          'select',
          {
            'aria-label': zh ? '始终模式' : 'Always mode',
            'data-omo-mode': mode,
            value: mode,
            disabled: pending,
            onChange,
            style: STYLE,
          },
          MODES.map((id) => h('option', { key: id, value: id }, LABELS[id])),
        ),
      )
    }
    ModeSelect.__test = { MODES, LABELS, requestUrl }

    function apply(ctx) {
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
