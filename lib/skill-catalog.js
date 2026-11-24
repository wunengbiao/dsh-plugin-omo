import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { parseSkillDocument } from "./skill-document.js";
export const BUNDLED_SKILL_RANK = 600;
function listMarkdownFiles(root) {
  const entries = readdirSync(root, { withFileTypes: true });
  const documents = [];
  for (const entry of entries) {
    if (entry.isDirectory()) {
      const bundle = join(root, entry.name, "SKILL.md");
      if (existsSync(bundle))
        documents.push(bundle);
      continue;
    }
    if (entry.isFile() && entry.name.endsWith(".md"))
      documents.push(join(root, entry.name));
  }
  return documents.sort();
}
function readDocument(documentPath) {
  return parseSkillDocument(readFileSync(documentPath, "utf8"), documentPath);
}
export function discoverSkills(options) {
  const discovered = [];
  const ownedBy = new Map;
  for (const configuredRoot of options.roots) {
    const root = resolve(configuredRoot);
    if (!existsSync(root))
      continue;
    const seenInRoot = new Set;
    for (const documentPath of listMarkdownFiles(root)) {
      const document = readDocument(documentPath);
      if (seenInRoot.has(document.name)) {
        throw new Error("[dsh-plugin-omo] duplicate skill name " + document.name + " in " + root + " (" + documentPath + ")");
      }
      seenInRoot.add(document.name);
      if (ownedBy.has(document.name))
        continue;
      ownedBy.set(document.name, documentPath);
      discovered.push({ documentPath, root, document });
    }
  }
  return discovered.sort((left, right) => left.document.name.localeCompare(right.document.name));
}
export function toCandidate(entry, options) {
  const document = entry.document;
  return {
    name: document.name,
    description: document.description,
    ...document.whenToUse === undefined ? {} : { whenToUse: document.whenToUse },
    path: entry.documentPath,
    invocation: { modelInvocable: document.modelInvocable, userInvocable: document.userInvocable },
    source: "bundled",
    provider: options.providerName,
    resourceBase: { kind: "directory", path: dirname(entry.documentPath) },
    rank: options.rank,
    locator: { documentPath: entry.documentPath, root: entry.root },
    metadata: document.metadata
  };
}
export function listCandidates(options) {
  return discoverSkills(options).filter((entry) => !options.disabled.has(entry.document.name)).map((entry) => toCandidate(entry, options));
}
function isCatalogLocator(value) {
  if (typeof value !== "object" || value === null)
    return false;
  const candidate = value;
  return typeof candidate.documentPath === "string" && typeof candidate.root === "string";
}
export function loadDefinition(candidate, options, _lookup) {
  if (!isCatalogLocator(candidate.locator))
    return;
  if (options.disabled.has(candidate.name))
    return;
  if (!existsSync(candidate.locator.documentPath))
    return;
  const document = readDocument(candidate.locator.documentPath);
  if (document.name !== candidate.name)
    return;
  return {
    name: document.name,
    description: document.description,
    ...document.whenToUse === undefined ? {} : { whenToUse: document.whenToUse },
    path: candidate.locator.documentPath,
    invocation: { modelInvocable: document.modelInvocable, userInvocable: document.userInvocable },
    source: "bundled",
    provider: options.providerName,
    resourceBase: { kind: "directory", path: dirname(candidate.locator.documentPath) },
    content: document.body,
    metadata: document.metadata
  };
}
