# Changelog

## 0.1.1

- Stop shipping a skill whose vendored runtime is absent. `browser` loads omowright from `runtime/omowright`,
  which is gitignored build output in the source tree, so the staged package now skips it with a logged reason
  instead of shipping a skill whose scripts throw. 18 skills remain, all self-contained.

## 0.1.0

- First release: registers the `omo` SkillProvider in DSH and ships the 19 cross-harness omo skills.
- Configuration for `providerName`, `skillDir`, `extraSkillDirs`, `disabled`, and `rank`.
- `script/build-dsh-plugin.ts` stages the skills with a sha256 manifest; `--check` fails on drift.
