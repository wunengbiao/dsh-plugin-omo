/**
 * Directory discovery for the bundled omo skills.
 *
 * A root holds either bundle directories (`<name>/SKILL.md`) or flat Markdown
 * entries (`<name>.md`). Roots are scanned in order and a name found in an
 * earlier root wins, so a project or user override stays authoritative.
 */
import { existsSync, readFileSync, readdirSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import type { HostSkillCandidate, HostSkillDefinition, HostSkillLookupOptions } from "./host.ts"
import { type SkillDocument, parseSkillDocument } from "./skill-document.ts"

/** Provider rank for bundled skills; lower ranks win duplicate names. */
export const BUNDLED_SKILL_RANK = 600

/** Where one candidate came from, kept opaque in the registry. */
export interface CatalogLocator {
  readonly documentPath: string
  readonly root: string
}

/** Options that shape one discovery pass. */
export interface CatalogOptions {
  readonly roots: readonly string[]
  readonly disabled: ReadonlySet<string>
  readonly rank: number
  readonly providerName: string
}

interface DiscoveredSkill {
  readonly documentPath: string
  readonly root: string
  readonly document: SkillDocument
}

function listMarkdownFiles(root: string): string[] {
  const entries = readdirSync(root, { withFileTypes: true })
  const documents: string[] = []
  for (const entry of entries) {
    if (entry.isDirectory()) {
      const bundle = join(root, entry.name, "SKILL.md")
      if (existsSync(bundle)) documents.push(bundle)
      continue
    }
    if (entry.isFile() && entry.name.endsWith(".md")) documents.push(join(root, entry.name))
  }
  return documents.sort()
}

function readDocument(documentPath: string): SkillDocument {
  return parseSkillDocument(readFileSync(documentPath, "utf8"), documentPath)
}

/** Discover every skill the configured roots provide, first root wins. */
export function discoverSkills(options: CatalogOptions): DiscoveredSkill[] {
  const discovered: DiscoveredSkill[] = []
  const ownedBy = new Map<string, string>()
  for (const configuredRoot of options.roots) {
    const root = resolve(configuredRoot)
    if (!existsSync(root)) continue
    const seenInRoot = new Set<string>()
    for (const documentPath of listMarkdownFiles(root)) {
      const document = readDocument(documentPath)
      if (seenInRoot.has(document.name)) {
        throw new Error(
          "[dsh-plugin-omo] duplicate skill name " + document.name + " in " + root + " (" + documentPath + ")",
        )
      }
      seenInRoot.add(document.name)
      if (ownedBy.has(document.name)) continue
      ownedBy.set(document.name, documentPath)
      discovered.push({ documentPath, root, document })
    }
  }
  return discovered.sort((left, right) => left.document.name.localeCompare(right.document.name))
}

/** Build the catalog candidate for one discovered skill. */
export function toCandidate(entry: DiscoveredSkill, options: CatalogOptions): HostSkillCandidate {
  const document = entry.document
  return {
    name: document.name,
    description: document.description,
    ...(document.whenToUse === undefined ? {} : { whenToUse: document.whenToUse }),
    path: entry.documentPath,
    invocation: { modelInvocable: document.modelInvocable, userInvocable: document.userInvocable },
    source: "bundled",
    provider: options.providerName,
    resourceBase: { kind: "directory", path: dirname(entry.documentPath) },
    rank: options.rank,
    locator: { documentPath: entry.documentPath, root: entry.root } satisfies CatalogLocator,
    metadata: document.metadata,
  }
}

/** Catalog listing for the registry, with the disabled set applied. */
export function listCandidates(options: CatalogOptions): HostSkillCandidate[] {
  return discoverSkills(options)
    .filter((entry) => !options.disabled.has(entry.document.name))
    .map((entry) => toCandidate(entry, options))
}

function isCatalogLocator(value: unknown): value is CatalogLocator {
  if (typeof value !== "object" || value === null) return false
  const candidate = value as { documentPath?: unknown; root?: unknown }
  return typeof candidate.documentPath === "string" && typeof candidate.root === "string"
}

/** Load the body for one candidate. Returns undefined when it is no longer loadable. */
export function loadDefinition(
  candidate: HostSkillCandidate,
  options: CatalogOptions,
  _lookup: HostSkillLookupOptions,
): HostSkillDefinition | undefined {
  if (!isCatalogLocator(candidate.locator)) return undefined
  if (options.disabled.has(candidate.name)) return undefined
  if (!existsSync(candidate.locator.documentPath)) return undefined
  const document = readDocument(candidate.locator.documentPath)
  if (document.name !== candidate.name) return undefined
  return {
    name: document.name,
    description: document.description,
    ...(document.whenToUse === undefined ? {} : { whenToUse: document.whenToUse }),
    path: candidate.locator.documentPath,
    invocation: { modelInvocable: document.modelInvocable, userInvocable: document.userInvocable },
    source: "bundled",
    provider: options.providerName,
    resourceBase: { kind: "directory", path: dirname(candidate.locator.documentPath) },
    content: document.body,
    metadata: document.metadata,
  }
}
