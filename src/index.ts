export {
  apply,
  defaultSkillRoot,
  inject,
  name,
  normalizeOmoConfig,
  type OmoPluginConfig,
  type OmoPluginInstance,
  type NormalizedOmoConfig,
} from "./plugin.ts"
export { BUNDLED_SKILL_RANK } from "./skill-catalog.ts"
export { createRootWatcher, type RootWatchFactory, type RootWatcher } from "./skill-watcher.ts"
export { parseSkillDocument, SKILL_NAME_PATTERN, SkillDocumentError, type SkillDocument } from "./skill-document.ts"
export type {
  HostContext,
  HostSkillCandidate,
  HostSkillDefinition,
  HostSkillProvider,
  HostSkillLookupOptions,
  HostSkillSummary,
} from "./host.ts"
