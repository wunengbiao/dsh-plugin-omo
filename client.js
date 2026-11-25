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
      /* settings page */
      '.dsh-omo-page{display:flex;flex-direction:column;gap:18px;padding:4px 4px 24px;color:var(--dsw-alias-label-primary);font-size:13px;line-height:20px}',
      '.dsh-omo-block{display:flex;flex-direction:column;gap:10px;padding:12px;border:1px solid var(--dsw-alias-border-l1);border-radius:var(--dsw-radius-lg);background:var(--dsw-alias-bg-layer-1)}',
      '.dsh-omo-block-head{display:flex;align-items:center;gap:8px;font-size:13px;font-weight:600}',
      '.dsh-omo-hint{color:var(--dsw-alias-label-tertiary);font-size:12px}',
      '.dsh-omo-row-item{display:flex;align-items:center;gap:10px;padding:6px 4px;border-radius:var(--dsw-radius-sm)}',
      '.dsh-omo-row-item:hover{background:var(--dsw-alias-interactive-bg-hover)}',
      '.dsh-omo-name{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:12px;flex:none;min-width:160px}',
      '.dsh-omo-grow{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--dsw-alias-label-tertiary);font-size:12px}',
      '.dsh-omo-chip{flex:none;padding:0 6px;border-radius:999px;font-size:11px;line-height:18px;background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-tertiary)}',
      '.dsh-omo-btn{border:1px solid var(--dsw-alias-border-l2);background:transparent;color:inherit;border-radius:var(--dsw-radius-sm);padding:2px 8px;font:inherit;font-size:12px;cursor:pointer}',
      '.dsh-omo-btn:hover{background:var(--dsw-alias-interactive-bg-hover)}',
      '.dsh-omo-btn:disabled{opacity:.5;cursor:default}',
      '.dsh-omo-input{flex:1;min-width:0;padding:3px 8px;border:1px solid var(--dsw-alias-border-l2);border-radius:var(--dsw-radius-sm);background:transparent;color:inherit;font:inherit;font-size:12px}',
      '.dsh-omo-ok{color:var(--dsw-alias-state-business-primary)}',
      '.dsh-omo-bad{color:var(--dsw-alias-state-error-primary)}',
      '.dsh-omo-form{display:grid;grid-template-columns:120px 1fr auto;gap:8px;align-items:center}',
      '.dsh-omo-form input,.dsh-omo-form textarea{width:100%;box-sizing:border-box}',
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

    /* One glyph per mode: neutral dot, ascent, forge, fire, globe. */
    const GLYPHS = {
      native: ['M8 1.7a6.3 6.3 0 1 0 0 12.6A6.3 6.3 0 0 0 8 1.7Z', 'M8 6.7a1.3 1.3 0 1 0 0 2.6 1.3 1.3 0 0 0 0-2.6Z'],
      sisyphus: ['M8 1.7a6.3 6.3 0 1 0 0 12.6A6.3 6.3 0 0 0 8 1.7Z', 'M5.3 9.7 8 6.9l2.7 2.8'],
      hephaestus: ['M4.1 12.3 8.9 7.5', 'M8.5 5.3 10.3 3.5l2.2 2.2-1.8 1.8-2.2-2.2Z'],
      prometheus: [
        'M8 14c2.3 0 3.8-1.6 3.8-3.6 0-2.3-2-3.4-2.4-6.3-1.6 1-2.4 2.4-2.4 3.6 0 1-.6 1.4-1.2 1.4-.5 0-.9-.3-1.1-.8-.4.7-.6 1.4-.6 2C4.1 12.4 5.7 14 8 14Z',
      ],
      atlas: [
        'M8 1.7a6.3 6.3 0 1 0 0 12.6A6.3 6.3 0 0 0 8 1.7Z',
        'M1.8 8h12.4',
        'M8 1.7c1.9 1.8 2.8 3.9 2.8 6.3s-.9 4.5-2.8 6.3C6.1 12.5 5.2 10.4 5.2 8s.9-4.5 2.8-6.3Z',
      ],
    }
    const SVG = {
      chevron: 'M3 4.5 6 7.5 9 4.5',
      check: 'M2.5 6.2 5 8.7l4.5-4.5',
    }

    function icon(paths, size, width) {
      const list = Array.isArray(paths) ? paths : [paths]
      return h(
        'svg',
        { viewBox: '0 0 ' + size + ' ' + size, width: size, height: size, 'aria-hidden': 'true', fill: 'none' },
        list.map((d, index) =>
          h('path', {
            key: index,
            d,
            stroke: 'currentColor',
            strokeWidth: width || 1.4,
            strokeLinecap: 'round',
            strokeLinejoin: 'round',
          }),
        ),
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
            const width = 176
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
          h('span', { className: 'dsh-omo-glyph', 'aria-hidden': 'true' }, icon(GLYPHS[mode], 16)),
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
                  h('span', { className: 'dsh-omo-glyph', 'aria-hidden': 'true' }, icon(GLYPHS[id], 16)),
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

    const ROUTE_SETTINGS = '/dsh-plugin-omo/settings'
    const ROUTE_SKILLS = '/dsh-plugin-omo/skills'
    const ROUTE_PROBE = '/dsh-plugin-omo/mcp/probe'
    const EMPTY_SETTINGS = { disabledSkills: [], extraSkillDirs: [], mcpServers: [] }

    async function jsonFetch(url, init) {
      const response = await fetch(url, { credentials: 'same-origin', ...init })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error || 'HTTP ' + response.status)
      return payload
    }

    function OmoSettingsIcon() {
      return icon(GLYPHS.atlas, 16)
    }

    function OmoSettingsSection() {
      const zh = isZh()
      const [path, setPath] = React.useState('')
      const [settings, setSettings] = React.useState(EMPTY_SETTINGS)
      const [skills, setSkills] = React.useState([])
      const [probes, setProbes] = React.useState({})
      const [error, setError] = React.useState('')
      const [busy, setBusy] = React.useState(false)
      const [dirInput, setDirInput] = React.useState('')
      const [form, setForm] = React.useState({ id: '', command: '', args: '', env: '' })

      const load = React.useCallback(async () => {
        try {
          const [settingsPayload, skillsPayload] = await Promise.all([jsonFetch(ROUTE_SETTINGS), jsonFetch(ROUTE_SKILLS)])
          setPath(settingsPayload.path || '')
          setSettings(settingsPayload.settings || EMPTY_SETTINGS)
          setSkills(skillsPayload.items || [])
          setError('')
        } catch (failure) {
          setError(String(failure.message || failure))
        }
      }, [])

      React.useEffect(() => {
        void load()
      }, [load])

      const save = React.useCallback(
        async (patch) => {
          setBusy(true)
          try {
            const payload = await jsonFetch(ROUTE_SETTINGS, {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify(patch),
            })
            setPath(payload.path || '')
            setSettings(payload.settings || EMPTY_SETTINGS)
            const skillsPayload = await jsonFetch(ROUTE_SKILLS)
            setSkills(skillsPayload.items || [])
            setError('')
          } catch (failure) {
            setError(String(failure.message || failure))
          } finally {
            setBusy(false)
          }
        },
        [],
      )

      const toggleSkill = (name, enabled) => {
        const next = enabled
          ? settings.disabledSkills.filter((entry) => entry !== name)
          : [...new Set([...settings.disabledSkills, name])]
        void save({ disabledSkills: next })
      }
      const addDir = () => {
        const value = dirInput.trim()
        if (value === '') return
        setDirInput('')
        void save({ extraSkillDirs: [...new Set([...settings.extraSkillDirs, value])] })
      }
      const removeDir = (value) => void save({ extraSkillDirs: settings.extraSkillDirs.filter((entry) => entry !== value) })
      const updateServers = (next) => void save({ mcpServers: next })
      const toggleServer = (server, enabled) =>
        updateServers(settings.mcpServers.map((entry) => (entry.id === server.id ? { ...entry, enabled } : entry)))
      const removeServer = (server) => updateServers(settings.mcpServers.filter((entry) => entry.id !== server.id))
      const addServer = () => {
        const id = form.id.trim()
        const command = form.command.trim()
        if (id === '' || command === '') return
        const env = {}
        for (const line of form.env.split('\n')) {
          const index = line.indexOf('=')
          if (index > 0) env[line.slice(0, index).trim()] = line.slice(index + 1).trim()
        }
        const spec = {
          id,
          name: id,
          transport: 'stdio',
          command,
          args: form.args.split(/\s+/).filter(Boolean),
          ...(Object.keys(env).length > 0 ? { env } : {}),
          enabled: true,
        }
        setForm({ id: '', command: '', args: '', env: '' })
        updateServers([...settings.mcpServers.filter((entry) => entry.id !== id), spec])
      }
      const probe = async (server) => {
        setProbes((current) => ({ ...current, [server.id]: { pending: true } }))
        try {
          const payload = await jsonFetch(ROUTE_PROBE + '?id=' + encodeURIComponent(server.id))
          setProbes((current) => ({ ...current, [server.id]: payload }))
        } catch (failure) {
          setProbes((current) => ({ ...current, [server.id]: { ok: false, error: String(failure.message || failure) } }))
        }
      }

      return h(
        'div',
        { className: 'dsh-omo-page' },
        h('div', null, h('div', { className: 'dsh-omo-block-head' }, zh ? 'omo 配置' : 'omo settings'), h('div', { className: 'dsh-omo-hint' }, path)),
        error === '' ? null : h('div', { className: 'dsh-omo-bad' }, error),

        h(
          'section',
          { className: 'dsh-omo-block' },
          h('div', { className: 'dsh-omo-block-head' }, zh ? '技能' : 'Skills'),
          h('div', { className: 'dsh-omo-hint' }, zh ? '关闭后该技能不再出现在会话目录里；新增目录用于加载外部 SKILL.md。' : 'Disabled skills leave the session catalog; extra directories load external SKILL.md bundles.'),
          skills.map((skill) =>
            h(
              'div',
              { key: skill.name, className: 'dsh-omo-row-item' },
              h('span', { className: 'dsh-omo-name' }, skill.name),
              h('span', { className: 'dsh-omo-chip' }, skill.source),
              h('span', { className: 'dsh-omo-grow', title: skill.description }, skill.description),
              h('input', {
                type: 'checkbox',
                checked: skill.enabled,
                disabled: busy,
                'aria-label': skill.name,
                onChange: (event) => toggleSkill(skill.name, event.target.checked),
              }),
            ),
          ),
          h(
            'div',
            { className: 'dsh-omo-row-item' },
            h('input', {
              className: 'dsh-omo-input',
              placeholder: zh ? '外部技能目录，例如 /Users/me/skills' : 'Extra skill directory',
              value: dirInput,
              onChange: (event) => setDirInput(event.target.value),
            }),
            h('button', { type: 'button', className: 'dsh-omo-btn', disabled: busy, onClick: addDir }, zh ? '添加目录' : 'Add'),
          ),
          settings.extraSkillDirs.map((value) =>
            h(
              'div',
              { key: value, className: 'dsh-omo-row-item' },
              h('span', { className: 'dsh-omo-name' }, value),
              h('span', { className: 'dsh-omo-grow' }),
              h('button', { type: 'button', className: 'dsh-omo-btn', disabled: busy, onClick: () => removeDir(value) }, zh ? '移除' : 'Remove'),
            ),
          ),
        ),

        h(
          'section',
          { className: 'dsh-omo-block' },
          h('div', { className: 'dsh-omo-block-head' }, zh ? 'MCP 服务' : 'MCP servers'),
          h('div', { className: 'dsh-omo-hint' }, zh ? '目前支持 stdio 传输；HTTP 会在后续版本支持。保存后可用「测试」做一次真实握手。' : 'stdio only for now; HTTP lands later. Save, then Test runs a real handshake.'),
          settings.mcpServers.map((server) => {
            const result = probes[server.id]
            return h(
              'div',
              { key: server.id, className: 'dsh-omo-row-item' },
              h('span', { className: 'dsh-omo-name' }, server.name || server.id),
              h('span', { className: 'dsh-omo-chip' }, server.transport),
              h(
                'span',
                { className: 'dsh-omo-grow ' + (result === undefined ? '' : result.pending ? '' : result.ok ? 'dsh-omo-ok' : 'dsh-omo-bad') },
                result === undefined
                  ? server.transport === 'stdio'
                    ? [server.command, (server.args || []).join(' ')].filter(Boolean).join(' ')
                    : server.url || ''
                  : result.pending
                    ? zh ? '连接中…' : 'connecting…'
                    : result.ok
                      ? (result.tools || []).length + (zh ? ' 个工具' : ' tools')
                      : result.error || 'failed',
              ),
              h('input', {
                type: 'checkbox',
                checked: server.enabled,
                disabled: busy,
                'aria-label': server.id,
                onChange: (event) => toggleServer(server, event.target.checked),
              }),
              h('button', { type: 'button', className: 'dsh-omo-btn', onClick: () => void probe(server) }, zh ? '测试' : 'Test'),
              h('button', { type: 'button', className: 'dsh-omo-btn', disabled: busy, onClick: () => removeServer(server) }, zh ? '删除' : 'Delete'),
            )
          }),
          h(
            'div',
            { className: 'dsh-omo-form' },
            h('input', { className: 'dsh-omo-input', placeholder: zh ? '名称/标识' : 'id', value: form.id, onChange: (event) => setForm({ ...form, id: event.target.value }) }),
            h('input', { className: 'dsh-omo-input', placeholder: zh ? '命令，例如 npx' : 'command, e.g. npx', value: form.command, onChange: (event) => setForm({ ...form, command: event.target.value }) }),
            h('button', { type: 'button', className: 'dsh-omo-btn', disabled: busy, onClick: addServer }, zh ? '添加' : 'Add'),
            h('input', { className: 'dsh-omo-input', placeholder: zh ? '参数，空格分隔' : 'args, space separated', value: form.args, onChange: (event) => setForm({ ...form, args: event.target.value }) }),
            h('input', { className: 'dsh-omo-input', placeholder: zh ? '环境变量 KEY=VALUE，每行一个' : 'env KEY=VALUE per line', value: form.env, onChange: (event) => setForm({ ...form, env: event.target.value }) }),
          ),
        ),
      )
    }
    OmoSettingsSection.__test = { ROUTE_SETTINGS, ROUTE_SKILLS, ROUTE_PROBE }

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
      // A first-level settings page: nav row + body, both keyed by the same id.
      ctx.slots.inject('settings.section', () =>
        ctx.slots.register(
          {
            name: 'settings.section',
            id: 'omo-settings',
            order: 90,
            label: () => 'omo 配置',
          },
          OmoSettingsSection,
        ),
      )
      ctx.slots.inject('settings.section.icon', () =>
        ctx.slots.register({ name: 'settings.section.icon', id: 'omo-settings', order: 90 }, OmoSettingsIcon),
      )
    }

    return { name: 'dsh-plugin-omo', inject: ['slots'], apply }
  },
})
