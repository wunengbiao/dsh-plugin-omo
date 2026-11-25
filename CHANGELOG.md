# Changelog

## 0.4.0

- **MCP tools are now real session tools.** A third entry (`./mcp`, `inject: ["tools"]`) starts every enabled stdio
  server from the settings file, completes `initialize` + `tools/list`, and registers each tool as
  `<server>__<tool>` with the server's JSON Schema as its parameters. Execution forwards through `tools/call` and
  returns the flattened text content.
- A server that fails to start, exits, or exceeds its timeout is logged and skipped: the rest of the pack and the
  other servers keep working, and the failure is reported in the settings payload.
- The settings page shows how many tools each server registered (`已注册 N`), and the page payload carries
  `registered.servers` / `registered.failures`.
- MCP calls are registered as non-concurrency-safe, so two mutating tools never run in parallel.

## 0.3.2

- **浏览…** opens the real directory picker for skill directories: the desktop bridge
  (`globalThis.__DSH_DIRECTORY_PICKER__`) first, then the workspace picker; when neither exists the page says so and
  the paste-and-Add path still works. Previously the button only stored whatever text was typed, which read as a
  button that did nothing.
- The settings route now validates `extraSkillDirs`: a missing path or a file is rejected with a message naming it,
  instead of silently producing an empty catalog entry.

## 0.3.1

- The settings page is titled **OMO 配置** (was lowercase `omo 配置`), in the nav row and in the page header.
- A fresh install now seeds the **CodeGraph** MCP server (`codegraph serve --mcp`, stdio) into
  `$DSH_HOME/omo/settings.json`, so the MCP panel lists it out of the box and **测试** performs a real handshake with
  the installed CodeGraph CLI. Deleting it persists; the seed only applies while no settings file exists.

## 0.3.0

- New settings page **omo 配置** (first-level nav next to 通用设置/模型/内置插件/Agent 预设), with two panels:
  - **技能**: lists every discoverable skill with its source and description, toggles it on or off, and manages extra
    skill directories. Toggles write `$DSH_HOME/omo/settings.json`; the provider reads it per call and a watcher on the
    file invalidates the cached catalog, so a toggle takes effect without a restart.
  - **MCP 服务**: add, enable/disable, delete stdio servers, and **Test** runs a real MCP handshake
    (`initialize` then `tools/list`) and reports the tool count, the first tool names, or the failure.
- Host routes: `/dsh-plugin-omo/settings` (GET/POST), `/dsh-plugin-omo/skills`, `/dsh-plugin-omo/mcp/probe`.
- Limitation, stated up front: this release manages MCP configuration and verifies connectivity, but does not yet
  register MCP tools into the session; that lands in 0.3.1. HTTP transport is rejected with a clear message.

## 0.2.4

- Each mode has its own icon in the menu and in the trigger: a neutral dot for Native, an ascent mark for Sisyphus, a
  hammer for Hephaestus, a flame for Prometheus, and a globe for Atlas. The repeated check-in-a-circle glyph is gone;
  the active row still shows a check on the right.
- The menu is narrower (176px instead of 200px).

## 0.2.3

- The mode menu no longer floats far from its trigger. It was `position: fixed` without a portal, and the composer card
  establishes a containing block for fixed descendants (backdrop-filter/transform), so viewport math placed it far up
  the page. The panel now portals to `document.body` and anchors its bottom edge to the trigger's top edge, with the
  remaining viewport height as its max height; it also closes on resize or scroll instead of drifting.

## 0.2.2

- Ordering the permission group to the right is now done in the DOM on mount instead of relying only on a CSS
  sibling selector: a slot may wrap the control in an extra element, which would make `:has(+ …)` miss. The CSS
  rule stays as a fallback.

## 0.2.1

- The always-mode control now matches the permission control instead of using a native select: same trigger treatment
  (glyph, label, chevron, hover, expanded state) and the same popover menu (rounded panel, rows with glyphs, checkmark
  on the active row, Escape and outside-click dismissal).
- The permission group moves to the right of the mode control, so the order in the composer is
  `+ | always mode | permission`. The CSS `order` rule keys off the control's own attribute, so it needs no hashed
  class name from the host bundle.

## 0.2.0

- Always-mode selector in the composer. A native dropdown renders left of the permission control
  (`conversation.input.left`) with four choices from the omo primary agents (Sisyphus, Hephaestus, Prometheus, Atlas)
  plus `Native`, which selects nothing. The choice is stored per session and injected as a system prompt directive, so
  it applies to every turn while it is set. Host route `/dsh-plugin-omo/mode` serves GET and POST for the client.

## 0.1.7

- `build:check` now actually detects drift. It used to stage the source into the package and then validate that
  staging, which always agrees with itself, so an edited source skill still reported "current". The check stages into
  a scratch directory and compares the resulting manifest with the committed one, plus the files on disk: a changed
  body, a new skill, a removed skill, and a hand-edited staged copy each fail with the offending path.

## 0.1.6

- End the frontmatter only at a column-0 fence. A block scalar containing an indented `---` (a literal rule line
  inside a description) was treated as the closing fence, so the description was truncated and the rest leaked into
  the skill body. Trailing spaces on the closing fence are still accepted.

## 0.1.5

- An unreadable or non-directory skill root no longer empties the catalog. Reading it threw, which propagated out of
  `list()` and made the registry drop the whole provider, so one `chmod 000` extra directory hid all 18 bundled
  skills. The root is now reported as a catalog issue, the surviving roots still serve their skills, and the path is
  logged.

## 0.1.4

- Refresh the catalog when a skill is added or removed. The registry caches one completed catalog per provider, so a
  skill created after startup stayed invisible until the app restarted: only skill bodies were live, because `get()`
  rereads them. The provider now watches its roots and calls the registration's `invalidate()` on any directory
  change, so a new or removed skill appears on the next lookup. Verified against the harness registry: a skill
  dropped into the root after mounting shows up in the next `snapshot()`.

## 0.1.3

- Follow symlinked skill entries. A root containing a symlinked bundle (`<root>/<name> -> elsewhere`) or a symlinked
  flat document was skipped, because `readdirSync` reports a link as neither a directory nor a file. Discovery now
  stats the link, so shared or symlinked skill directories are picked up; a dangling link is skipped instead of
  throwing. This matters for users who share skills between projects or symlink a local checkout.

## 0.1.2

- One malformed SKILL.md no longer takes the whole bundle down. `apply()` used to parse every document while
  logging its skill count, so a single bad file failed the plugin load and the registry dropped all 18 skills.
  Registration is now document-counting only, and discovery reports a broken document as an issue:
  `list()` returns the surviving candidates with `complete: false`, `get()` treats it as unavailable, and the
  plugin logs the offending path. Verified against the harness registry: 17 skills survive with `refactor`
  corrupted, and the log names `skills/refactor/SKILL.md`.

## 0.1.1

- Stop shipping a skill whose vendored runtime is absent. `browser` loads omowright from `runtime/omowright`,
  which is gitignored build output in the source tree, so the staged package now skips it with a logged reason
  instead of shipping a skill whose scripts throw. 18 skills remain, all self-contained.

## 0.1.0

- First release: registers the `omo` SkillProvider in DSH and ships the 19 cross-harness omo skills.
- Configuration for `providerName`, `skillDir`, `extraSkillDirs`, `disabled`, and `rank`.
- `script/build-dsh-plugin.ts` stages the skills with a sha256 manifest; `--check` fails on drift.
