/**
 * The SkillProvider the registry calls. Discovery is intentionally uncached: the
 * catalog is a handful of frontmatter reads and the body is read on demand, so there is
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

/** Resolved per call, so settings edits apply without a restart. */
export type CatalogOptionsResolver = () => CatalogOptions

/** Create the omo SkillProvider for one registration. */
export function createOmoProvider(resolve: CatalogOptionsResolver, logger?: HostLogger): HostSkillProvider {
  return {
    name: resolve().providerName,
    async list(_lookup: HostSkillLookupOptions) {
      const listing = listCandidates(resolve())
      if (listing.issues.length === 0) return listing.candidates
      for (const issue of listing.issues) {
        logger?.warn("[dsh-plugin-omo] skipped skill document " + issue.documentPath + ": " + issue.message)
      }
      return { candidates: listing.candidates, complete: false }
    },
    async get(candidate: HostSkillCandidate, lookup: HostSkillLookupOptions): Promise<HostSkillDefinition | undefined> {
      return loadDefinition(candidate, resolve(), lookup)
    },
  }
}
