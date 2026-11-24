import { listCandidates, loadDefinition } from "./skill-catalog.js";
export function createOmoProvider(options) {
  return {
    name: options.providerName,
    async list(_lookup) {
      return listCandidates(options);
    },
    async get(candidate, lookup) {
      return loadDefinition(candidate, options, lookup);
    }
  };
}
