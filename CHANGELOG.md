# Changelog

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
