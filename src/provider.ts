/**
 * The SkillProvider the registry calls. Discovery is intentionally uncached:
 * the catalog is 19 small frontmatter reads and the body is read on demand, so
 * there is no stale snapshot to invalidate when a skill file changes.
 */
import type { HostSkillCandidate, HostSkillDefinition, HostSkillLookupOptions, HostSkillProvider } from "./host.ts"
import { type CatalogOptions, listCandidates, loadDefinition } from "./skill-catalog.ts"

export type OmoProviderOptions = CatalogOptions

/** Create the omo SkillProvider for one registration. */
export function createOmoProvider(options: OmoProviderOptions): HostSkillProvider {
  return {
    name: options.providerName,
    async list(_lookup: HostSkillLookupOptions): Promise<readonly HostSkillCandidate[]> {
      return listCandidates(options)
    },
    async get(candidate: HostSkillCandidate, lookup: HostSkillLookupOptions): Promise<HostSkillDefinition | undefined> {
      return loadDefinition(candidate, options, lookup)
    },
  }
}
