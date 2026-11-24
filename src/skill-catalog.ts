/**
 * Directory discovery for the bundled omo skills.
 *
 * A root holds either bundle directories (`<name>/SKILL.md`) or flat Markdown
 * entries (`<name>.md`). Roots are scanned in order and a name found in an
 * earlier root wins, so a project or user override stays authoritative.
 */
import { type Dirent, existsSync, readFileSync, readdirSync, statSync } from "node:fs"
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

/** Classify one directory entry, following symlinks and skipping broken ones. */
function classifyEntry(directory: string, entry: Dirent): { directory: boolean; file: boolean } {
  if (!entry.isSymbolicLink()) return { directory: entry.isDirectory(), file: entry.isFile() }
  try {
    const stats = statSync(join(directory, entry.name))
    return { directory: stats.isDirectory(), file: stats.isFile() }
  } catch {
    return { directory: false, file: false }
  }
}

function listMarkdownFiles(root: string): string[] {
  const entries = readdirSync(root, { withFileTypes: true })
  const documents: string[] = []
  for (const entry of entries) {
    const kind = classifyEntry(root, entry)
    if (kind.directory) {
      const bundle = join(root, entry.name, "SKILL.md")
      if (existsSync(bundle)) documents.push(bundle)
      continue
    }
    if (kind.file && entry.name.endsWith(".md")) documents.push(join(root, entry.name))
  }
  return documents.sort()
}

function readDocument(documentPath: string): SkillDocument {
  return parseSkillDocument(readFileSync(documentPath, "utf8"), documentPath)
}

/**
 * Count skill documents without parsing them.
 *
 * The plugin logs this at load time, so it must not read frontmatter: a malformed
 * document has to reject list() (where the registry contains the failure) instead
 * of failing the whole bundle during apply.
 */
export function countSkillDocuments(roots: readonly string[]): number {
  let count = 0
  for (const configuredRoot of roots) {
    const root = resolve(configuredRoot)
    if (!existsSync(root)) continue
    for (const entry of readdirSync(root, { withFileTypes: true })) {
      const kind = classifyEntry(root, entry)
      if (kind.directory) {
        if (existsSync(join(root, entry.name, "SKILL.md"))) count += 1
        continue
      }
      if (kind.file && entry.name.endsWith(".md")) count += 1
    }
  }
  return count
}

/** One document that could not become a candidate, reported instead of thrown. */
export interface CatalogIssue {
  readonly documentPath: string
  readonly message: string
}

export interface CatalogDiscovery {
  readonly skills: readonly DiscoveredSkill[]
  readonly issues: readonly CatalogIssue[]
}

/**
 * Discover every skill the configured roots provide, first root wins.
 *
 * A malformed document becomes an issue rather than an exception: one broken
 * SKILL.md in a bundle must not hide every other skill the same provider serves.
 */
export function discoverSkills(options: CatalogOptions): CatalogDiscovery {
  const discovered: DiscoveredSkill[] = []
  const issues: CatalogIssue[] = []
  const ownedBy = new Map<string, string>()
  for (const configuredRoot of options.roots) {
    const root = resolve(configuredRoot)
    if (!existsSync(root)) continue
    const seenInRoot = new Set<string>()
    for (const documentPath of listMarkdownFiles(root)) {
      let document: SkillDocument
      try {
        document = readDocument(documentPath)
      } catch (error) {
        issues.push({ documentPath, message: error instanceof Error ? error.message : String(error) })
        continue
      }
      if (seenInRoot.has(document.name)) {
        issues.push({
          documentPath,
          message: "[dsh-plugin-omo] duplicate skill name " + document.name + " in " + root,
        })
        continue
      }
      seenInRoot.add(document.name)
      if (ownedBy.has(document.name)) continue
      ownedBy.set(document.name, documentPath)
      discovered.push({ documentPath, root, document })
    }
  }
  return {
    skills: discovered.sort((left, right) => left.document.name.localeCompare(right.document.name)),
    issues,
  }
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
export function listCandidates(options: CatalogOptions): CatalogListing {
  const discovery = discoverSkills(options)
  return {
    candidates: discovery.skills
      .filter((entry) => !options.disabled.has(entry.document.name))
      .map((entry) => toCandidate(entry, options)),
    issues: discovery.issues,
  }
}

export interface CatalogListing {
  readonly candidates: readonly HostSkillCandidate[]
  readonly issues: readonly CatalogIssue[]
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
  let document: SkillDocument
  try {
    document = readDocument(candidate.locator.documentPath)
  } catch {
    return undefined
  }
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
