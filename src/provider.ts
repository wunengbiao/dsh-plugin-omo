/**
 * The SkillProvider the registry calls. Discovery is intentionally uncached: the
 * catalog is 18 small frontmatter reads and the body is read on demand, so there is
 * no stale snapshot to invalidate when a skill file changes.
 */
import type {
  HostLogger,
  HostSkillCandidate,
  HostSkillDefinition,
  HostSkillLookupOptions,
  HostSkillProvider,
} from "./host.ts"
import { type CatalogOptions, listCandidates, loadDefinition } from "./skill-catalog.ts"

export type OmoProviderOptions = CatalogOptions

/** Create the omo SkillProvider for one registration. */
export function createOmoProvider(options: OmoProviderOptions, logger?: HostLogger): HostSkillProvider {
  return {
    name: options.providerName,
    async list(_lookup: HostSkillLookupOptions) {
      const listing = listCandidates(options)
      if (listing.issues.length === 0) return listing.candidates
      for (const issue of listing.issues) {
        logger?.warn("[dsh-plugin-omo] skipped skill document " + issue.documentPath + ": " + issue.message)
      }
      return { candidates: listing.candidates, complete: false }
    },
    async get(candidate: HostSkillCandidate, lookup: HostSkillLookupOptions): Promise<HostSkillDefinition | undefined> {
      return loadDefinition(candidate, options, lookup)
    },
  }
}
