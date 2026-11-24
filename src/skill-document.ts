/**
 * Parser for one SKILL.md document: YAML frontmatter plus the Markdown body.
 *
 * The harness validates skill names as kebab-case and requires a non-empty
 * description, so a malformed document fails loudly here instead of producing a
 * candidate the registry would reject later.
 */

/** Kebab-case identifier rule the skill registry enforces. */
export const SKILL_NAME_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

/** Raised when a SKILL.md cannot become a registry-valid skill. */
export class SkillDocumentError extends Error {
  readonly skillPath: string

  constructor(skillPath: string, reason: string) {
    super("[dsh-plugin-omo] invalid skill document at " + skillPath + ": " + reason)
    this.name = "SkillDocumentError"
    this.skillPath = skillPath
  }
}

/** One parsed SKILL.md, normalized into the fields the registry consumes. */
export interface SkillDocument {
  readonly name: string
  readonly description: string
  readonly whenToUse?: string
  readonly modelInvocable: boolean
  readonly userInvocable: boolean
  readonly metadata: Readonly<Record<string, unknown>>
  readonly body: string
}

/** Frontmatter keys that describe invocation policy instead of skill metadata. */
const RESERVED_KEYS = new Set([
  "name",
  "description",
  "when-to-use",
  "when_to_use",
  "disable-model-invocation",
  "user-invocable",
  "metadata",
])

function unquote(value: string): string {
  const trimmed = value.trim()
  if (trimmed.length >= 2 && trimmed.startsWith('"') && trimmed.endsWith('"')) {
    return trimmed.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, "\\")
  }
  if (trimmed.length >= 2 && trimmed.startsWith("'") && trimmed.endsWith("'")) {
    return trimmed.slice(1, -1).replace(/''/g, "'")
  }
  return trimmed
}

function isBlockScalar(value: string): boolean {
  return value === "|" || value === "|-" || value === "|+" || value === ">" || value === ">-" || value === ">+"
}

function takeIndented(lines: readonly string[], start: number): { readonly block: readonly string[]; readonly next: number } {
  const block: string[] = []
  let index = start
  while (index < lines.length) {
    const line = lines[index] as string
    if (line.trim() === "") {
      block.push("")
      index += 1
      continue
    }
    if (!/^\s+/.test(line)) break
    block.push(line)
    index += 1
  }
  return { block, next: index }
}

function parseBlockScalar(value: string, block: readonly string[]): string {
  const indents = block.filter((line) => line.trim() !== "").map((line) => (/^\s*/.exec(line) as RegExpExecArray)[0].length)
  const indent = indents.length > 0 ? Math.min(...indents) : 0
  const stripped = block.map((line) => (line.trim() === "" ? "" : line.slice(indent)))
  const joined = value.startsWith(">") ? stripped.join(" ").replace(/ {2,}/g, " ") : stripped.join("\n")
  return joined.trim()
}

function parseFrontmatter(lines: readonly string[], skillPath: string): Map<string, unknown> {
  const entries = new Map<string, unknown>()
  let index = 0
  while (index < lines.length) {
    const line = lines[index] as string
    const trimmed = line.trim()
    if (trimmed === "" || trimmed.startsWith("#")) {
      index += 1
      continue
    }
    const match = /^([A-Za-z0-9_-]+):\s*(.*)$/.exec(line)
    if (match === null) {
      throw new SkillDocumentError(skillPath, "unsupported frontmatter line: " + line.trim())
    }
    const key = match[1] as string
    const rawValue = match[2] as string
    if (isBlockScalar(rawValue)) {
      const taken = takeIndented(lines, index + 1)
      entries.set(key, parseBlockScalar(rawValue, taken.block))
      index = taken.next
      continue
    }
    if (rawValue !== "") {
      entries.set(key, unquote(rawValue))
      index += 1
      continue
    }
    const taken = takeIndented(lines, index + 1)
    if (taken.block.length === 0) {
      entries.set(key, "")
      index += 1
      continue
    }
    const nested: Record<string, string> = {}
    for (const blockLine of taken.block) {
      const nestedMatch = /^\s+([A-Za-z0-9_-]+):\s*(.*)$/.exec(blockLine)
      if (nestedMatch === null) continue
      nested[nestedMatch[1] as string] = unquote(nestedMatch[2] as string)
    }
    entries.set(key, nested)
    index = taken.next
  }
  return entries
}

function readBoolean(entries: Map<string, unknown>, key: string, fallback: boolean, skillPath: string): boolean {
  const value = entries.get(key)
  if (value === undefined) return fallback
  if (typeof value !== "string") throw new SkillDocumentError(skillPath, key + " must be a boolean")
  const normalized = value.trim().toLowerCase()
  if (normalized === "true") return true
  if (normalized === "false") return false
  throw new SkillDocumentError(skillPath, key + " must be true or false, received " + value)
}

/** Parse one SKILL.md file. Throws SkillDocumentError when it cannot become a skill. */
export function parseSkillDocument(raw: string, skillPath: string): SkillDocument {
  const normalized = raw.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n")
  const lines = normalized.split("\n")
  if ((lines[0] ?? "").trim() !== "---") {
    throw new SkillDocumentError(skillPath, "missing YAML frontmatter")
  }
  const closingIndex = lines.findIndex((line, index) => index > 0 && line.trim() === "---")
  if (closingIndex < 0) {
    throw new SkillDocumentError(skillPath, "unterminated YAML frontmatter")
  }
  const entries = parseFrontmatter(lines.slice(1, closingIndex), skillPath)
  const name = entries.get("name")
  if (typeof name !== "string" || name.trim() === "") {
    throw new SkillDocumentError(skillPath, "missing name")
  }
  if (!SKILL_NAME_PATTERN.test(name)) {
    throw new SkillDocumentError(skillPath, "name must be kebab-case, received " + name)
  }
  const description = entries.get("description")
  if (typeof description !== "string" || description.trim() === "") {
    throw new SkillDocumentError(skillPath, "missing description")
  }
  const whenToUseRaw = entries.get("when-to-use") ?? entries.get("when_to_use")
  const metadata: Record<string, unknown> = {}
  const declaredMetadata = entries.get("metadata")
  if (declaredMetadata !== undefined) {
    if (typeof declaredMetadata !== "object" || declaredMetadata === null) {
      throw new SkillDocumentError(skillPath, "metadata must be a mapping")
    }
    Object.assign(metadata, declaredMetadata as Record<string, unknown>)
  }
  for (const [key, value] of entries) {
    if (!RESERVED_KEYS.has(key)) metadata[key] = value
  }
  const document: SkillDocument = {
    name,
    description: description.trim(),
    ...(typeof whenToUseRaw === "string" && whenToUseRaw.trim() !== "" ? { whenToUse: whenToUseRaw.trim() } : {}),
    modelInvocable: !readBoolean(entries, "disable-model-invocation", false, skillPath),
    userInvocable: readBoolean(entries, "user-invocable", true, skillPath),
    metadata,
    body: lines
      .slice(closingIndex + 1)
      .join("\n")
      .replace(/^\n+/, "")
      .trimEnd(),
  }
  return document
}
