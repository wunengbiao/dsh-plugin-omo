import { listCandidates, loadDefinition } from "./skill-catalog.js";
export function createOmoProvider(options, logger) {
  return {
    name: options.providerName,
    async list(_lookup) {
      const listing = listCandidates(options);
      if (listing.issues.length === 0)
        return listing.candidates;
      for (const issue of listing.issues) {
        logger?.warn("[dsh-plugin-omo] skipped skill document " + issue.documentPath + ": " + issue.message);
      }
      return { candidates: listing.candidates, complete: false };
    },
    async get(candidate, lookup) {
      return loadDefinition(candidate, options, lookup);
    }
  };
}
