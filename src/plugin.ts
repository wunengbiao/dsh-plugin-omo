/**
 * Cordis plugin entry: registers the omo SkillProvider with the harness skill
 * registry and validates the row configuration from cordis.yml.
 */
import { existsSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import type { HostContext, HostSkillProvider } from "./host.ts"
import { createOmoProvider } from "./provider.ts"
import { BUNDLED_SKILL_RANK, countSkillDocuments } from "./skill-catalog.ts"
import { SKILL_NAME_PATTERN } from "./skill-document.ts"

export const name = "omo"
export const inject = ["skills"]

/** Row configuration accepted from a profile or bundle patch layer. */
export interface OmoPluginConfig {
  /** Provider name registered in the skill registry. Defaults to omo. */
  providerName?: string
  /** Absolute path to the skill root. Defaults to the skills directory shipped beside the plugin. */
  skillDir?: string
  /** Extra skill roots scanned after skillDir; earlier roots win duplicate names. */
  extraSkillDirs?: string[]
  /** Skill names hidden from the catalog. */
  disabled?: string[]
  /** Provider rank; the default sits in the bundled tier so project and user skills win duplicates. */
  rank?: number
}

export interface NormalizedOmoConfig {
  readonly providerName: string
  readonly roots: readonly string[]
  readonly disabled: ReadonlySet<string>
  readonly rank: number
}

const DEFAULT_PROVIDER_NAME = "omo"
const RESERVED_PROVIDER_NAME = "runtime"
const KNOWN_KEYS = new Set(["providerName", "skillDir", "extraSkillDirs", "disabled", "rank"])

function configError(reason: string): Error {
  return new Error("[dsh-plugin-omo] invalid configuration: " + reason)
}

/** Default skill root: the skills directory shipped at the package root. */
export function defaultSkillRoot(): string {
  return resolve(dirname(fileURLToPath(import.meta.url)), "..", "skills")
}

function readProviderName(value: unknown): string {
  if (value === undefined) return DEFAULT_PROVIDER_NAME
  if (typeof value !== "string") throw configError("providerName must be a string")
  const trimmed = value.trim()
  if (!SKILL_NAME_PATTERN.test(trimmed)) throw configError("providerName must be kebab-case, received " + trimmed)
  if (trimmed === RESERVED_PROVIDER_NAME) throw configError("providerName " + RESERVED_PROVIDER_NAME + " is reserved")
  return trimmed
}

function readStringArray(value: unknown, key: string): string[] {
  if (value === undefined) return []
  if (!Array.isArray(value)) throw configError(key + " must be an array of strings")
  const values: string[] = []
  for (const entry of value) {
    if (typeof entry !== "string" || entry.trim() === "") throw configError(key + " must contain non-empty strings")
    values.push(entry.trim())
  }
  return values
}

function readRank(value: unknown): number {
  if (value === undefined) return BUNDLED_SKILL_RANK
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    throw configError("rank must be a non-negative integer")
  }
  return value
}

/** Validate row configuration. Throws on anything that cannot be honored. */
export function normalizeOmoConfig(config: unknown): NormalizedOmoConfig {
  if (config === undefined || config === null) {
    return { providerName: DEFAULT_PROVIDER_NAME, roots: [defaultSkillRoot()], disabled: new Set(), rank: BUNDLED_SKILL_RANK }
  }
  if (typeof config !== "object" || Array.isArray(config)) throw configError("configuration must be a mapping")
  const record = config as Record<string, unknown>
  const unknownKeys = Object.keys(record).filter((key) => !KNOWN_KEYS.has(key))
  if (unknownKeys.length > 0) throw configError("unknown keys: " + unknownKeys.join(", "))
  if (record.skillDir !== undefined && typeof record.skillDir !== "string") {
    throw configError("skillDir must be a string")
  }
  const primaryRoot = typeof record.skillDir === "string" && record.skillDir.trim() !== ""
    ? resolve(record.skillDir)
    : defaultSkillRoot()
  const roots = [primaryRoot, ...readStringArray(record.extraSkillDirs, "extraSkillDirs").map((entry) => resolve(entry))]
  const disabled = new Set<string>()
  for (const entry of readStringArray(record.disabled, "disabled")) {
    if (!SKILL_NAME_PATTERN.test(entry)) throw configError("disabled entry must be kebab-case, received " + entry)
    disabled.add(entry)
  }
  return { providerName: readProviderName(record.providerName), roots, disabled, rank: readRank(record.rank) }
}

export interface OmoPluginInstance {
  readonly provider: HostSkillProvider
  readonly dispose: () => void
}

/** Register the provider; the returned disposer unregisters it. */
export function apply(ctx: HostContext, config?: unknown): OmoPluginInstance {
  const normalized = normalizeOmoConfig(config)
  const provider = createOmoProvider(
    {
      roots: normalized.roots,
      disabled: normalized.disabled,
      rank: normalized.rank,
      providerName: normalized.providerName,
    },
    ctx.logger,
  )
  const dispose = ctx.skills.registerProvider(() => provider)
  const missingRoots = normalized.roots.filter((rootPath) => !existsSync(rootPath))
  if (missingRoots.length > 0) {
    ctx.logger?.warn("[dsh-plugin-omo] skill roots missing: " + missingRoots.join(", "))
  }
  // Count documents only. Parsing here would let one malformed SKILL.md fail the whole bundle at
  // load time, when the registry is the layer that contains a provider failure.
  let documentCount = 0
  try {
    documentCount = countSkillDocuments(normalized.roots)
  } catch (error) {
    ctx.logger?.warn("[dsh-plugin-omo] could not count skill documents: " + String(error))
  }
  ctx.logger?.info(
    "[dsh-plugin-omo] registered provider " + normalized.providerName + " over " + documentCount + " skill documents",
  )
  return { provider, dispose }
}
