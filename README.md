# dsh-plugin-omo

DeepSeek Harness plugin that ships the [oh-my-openagent](https://github.com/code-yeongyu/oh-my-openagent) (omo)
cross-harness skills as a native DSH `SkillProvider`.

The plugin registers one provider named `omo` in `ctx.skills`. Every bundled skill then behaves like any other
DSH skill: it appears in the session catalog, the model can load it with the `skill` tool, and it resolves its
reference files through `resourceBase`.

## Install

```sh
dsh plugin --profile web add github:wunengbiao/dsh-plugin-omo#v0.1.0
```

The tag pin matters: it keeps a later push from silently changing what runs on your machine. The package ships its
built JavaScript and its skills, so the install runs no build script and needs no pnpm build allowance.

Other forms:

```sh
# unpinned, tracks main
dsh plugin --profile web add github:wunengbiao/dsh-plugin-omo

# from a checkout
git clone https://github.com/wunengbiao/dsh-plugin-omo.git
dsh plugin --profile web add ./dsh-plugin-omo
```

The bundle declares `dsh.bundle.patch`, so `dsh plugin add` appends it to `dsh.profile.bundles` and the loader
mounts it as the `omo` row. Verify without booting:

```sh
dsh --profile web --dump-config | grep dsh-plugin-omo
```

Restart the app, or boot the profile again, so the provider is registered in the running session.

### Desktop app

The desktop profile belongs to the Electron application, and `dsh plugin --profile desktop` refuses to compose it.
Mount the installed entry through the desktop profile's own patch layer instead, then restart the app:

```yaml
# ~/.dsh/profiles/desktop/cordis.patch.yml
- insert:
    - id: omo
      name: /absolute/path/to/dsh-plugin-omo/index.js
```

That row is a local-path mount. A packaged install should go through the app's plugin manager so the package is
tracked in the profile manifest.

## What ships

19 skills copied from `packages/shared-skills/skills` of oh-my-openagent:

`ast-grep`, `browser`, `coding-agent-sessions`, `data-scientist`, `debugging`, `eval-integrity`, `frontend`,
`git-master`, `init-deep`, `lsp-setup`, `programming`, `refactor`, `remove-ai-slops`, `review-work`,
`ultimate-browsing`, `ulw-execute`, `ulw-plan`, `ulw-research`, `visual-qa`.

What it does not do (yet): no tools, no agent presets, no hooks, no team mode. DSH already ships the tool surface
(grep, glob, read, edit, write, bash, web, jobs, subagents, session query) that the omo adapters for other harnesses
reimplement, so duplicating it would add risk without adding capability.

## Configure

Configuration is optional. Put it on the `omo` row of `$DSH_HOME/profiles/<profile>/cordis.patch.yml`:

```yaml
- id: omo
  name: dsh-plugin-omo
  config:
    disabled: [browser, ultimate-browsing]
```

| Key | Type | Default | Meaning |
|---|---|---|---|
| `providerName` | kebab-case string | `omo` | Provider name in the skill registry. `runtime` is reserved. |
| `skillDir` | string | the package `skills/` directory | Skill root scanned first. |
| `extraSkillDirs` | string[] | `[]` | Additional roots scanned after `skillDir`. |
| `disabled` | string[] | `[]` | Skill names hidden from the catalog and from `get`. |
| `rank` | non-negative integer | `600` | Duplicate-name precedence inside one registry layer; lower wins. |

Unknown keys, wrong types, and non-kebab names fail the plugin load with a message that names the problem.

### Precedence

The default rank sits in the bundled tier. DSH's local provider scans `<project>/.agents/skills` (rank 200) and the
user roots (rank 400 and 500) ahead of it, so a project or user copy of a skill wins over the copy this plugin ships.
Two plugins claiming the same skill name in the same tier resolve by rank, then registration order.

## Development

```sh
npm run check   # node --check over the committed runtime modules
npm test        # node --test, exercises the built entry end to end
bun run build   # regenerate index.js and lib/ from src/ (maintainers only)
```

`index.js` and `lib/*.js` are committed so installs need no toolchain. `src/` holds the TypeScript those files are
generated from; the source of truth is `packages/omo-dsh` in oh-my-openagent, and `skills/` is staged from
`packages/shared-skills/skills` there. Regenerate both together, never by hand.

## Layout

```
dsh-plugin-omo/
  index.js               generated entry (exports name, inject, apply)
  lib/                   generated runtime modules
  src/                   TypeScript source those modules come from
  skills/                the 19 bundled SKILL.md trees plus a sha256 manifest
  cordis.patch.yml       bundle layer that inserts the omo row
  scripts/build.mjs      transpiles src/ into index.js and lib/
  test/plugin.test.mjs   node --test suite over the built entry
```

## License

MIT
