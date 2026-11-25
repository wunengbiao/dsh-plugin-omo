/**
 * Persistent settings for the omo plugin, written by the settings page and read by the
 * skill provider and the MCP probe.
 *
 * The file lives under the harness home so a profile update does not wipe it:
 * `$DSH_HOME/omo/settings.json`, defaulting to `~/.dsh/omo/settings.json`.
 */
import { existsSync, mkdirSync, readFileSync, renameSync, statSync, writeFileSync } from "node:fs"
import { homedir } from "node:os"
import { dirname, join } from "node:path"

export interface McpServerSpec {
  readonly id: string
  readonly name: string
  readonly transport: "stdio" | "http"
  readonly command?: string
  readonly args?: readonly string[]
  readonly env?: Readonly<Record<string, string>>
  readonly url?: string
  readonly enabled: boolean
}

export interface OmoSettings {
  readonly disabledSkills: readonly string[]
  readonly extraSkillDirs: readonly string[]
  readonly mcpServers: readonly McpServerSpec[]
}

export const EMPTY_SETTINGS: OmoSettings = { disabledSkills: [], extraSkillDirs: [], mcpServers: [] }

export function settingsPath(): string {
  const home = process.env.DSH_HOME !== undefined && process.env.DSH_HOME !== "" ? process.env.DSH_HOME : join(homedir(), ".dsh")
  return join(home, "omo", "settings.json")
}

function toStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string" && entry !== "") : []
}

function toMcpServer(value: unknown): McpServerSpec | undefined {
  if (typeof value !== "object" || value === null) return undefined
  const record = value as Record<string, unknown>
  const id = typeof record.id === "string" ? record.id.trim() : ""
  if (id === "") return undefined
  const transport = record.transport === "http" ? "http" : "stdio"
  const env: Record<string, string> = {}
  if (typeof record.env === "object" && record.env !== null) {
    for (const [key, entry] of Object.entries(record.env)) {
      if (typeof entry === "string") env[key] = entry
    }
  }
  return {
    id,
    name: typeof record.name === "string" && record.name !== "" ? record.name : id,
    transport,
    ...(typeof record.command === "string" && record.command !== "" ? { command: record.command } : {}),
    ...(Array.isArray(record.args) ? { args: record.args.filter((entry): entry is string => typeof entry === "string") } : {}),
    ...(Object.keys(env).length > 0 ? { env } : {}),
    ...(typeof record.url === "string" && record.url !== "" ? { url: record.url } : {}),
    enabled: record.enabled !== false,
  }
}

/** Normalize anything into a complete settings object. */
export function normalizeSettings(value: unknown): OmoSettings {
  if (typeof value !== "object" || value === null) return EMPTY_SETTINGS
  const record = value as Record<string, unknown>
  const byId = new Map<string, McpServerSpec>()
  for (const entry of Array.isArray(record.mcpServers) ? record.mcpServers : []) {
    const server = toMcpServer(entry)
    if (server !== undefined) byId.set(server.id, server)
  }
  return {
    disabledSkills: [...new Set(toStringArray(record.disabledSkills))],
    extraSkillDirs: [...new Set(toStringArray(record.extraSkillDirs))],
    mcpServers: [...byId.values()],
  }
}

export interface SettingsStore {
  /** Current settings; a missing or broken file reads as empty. */
  readonly read: () => OmoSettings
  /** Replace settings and persist them atomically. */
  readonly write: (next: OmoSettings) => OmoSettings
  /** Merge a partial patch over the current settings. */
  readonly patch: (patch: Partial<OmoSettings>) => OmoSettings
  readonly path: () => string
}

/** Create a store that re-reads when the file's mtime changes, so page edits are live. */
export function createSettingsStore(filePath: string = settingsPath()): SettingsStore {
  let cached: OmoSettings = EMPTY_SETTINGS
  let cachedMtime = -1

  const read = (): OmoSettings => {
    if (!existsSync(filePath)) {
      cached = EMPTY_SETTINGS
      cachedMtime = -1
      return cached
    }
    const mtime = statSync(filePath).mtimeMs
    if (mtime === cachedMtime) return cached
    try {
      cached = normalizeSettings(JSON.parse(readFileSync(filePath, "utf8")))
    } catch {
      cached = EMPTY_SETTINGS
    }
    cachedMtime = mtime
    return cached
  }

  const write = (next: OmoSettings): OmoSettings => {
    const normalized = normalizeSettings(next)
    mkdirSync(dirname(filePath), { recursive: true })
    const temporary = filePath + ".tmp"
    writeFileSync(temporary, JSON.stringify(normalized, null, 2) + "\n")
    renameSync(temporary, filePath)
    cached = normalized
    cachedMtime = statSync(filePath).mtimeMs
    return normalized
  }

  return {
    read,
    write,
    patch: (patch) => {
      const current = read()
      return write({
        disabledSkills: patch.disabledSkills ?? current.disabledSkills,
        extraSkillDirs: patch.extraSkillDirs ?? current.extraSkillDirs,
        mcpServers: patch.mcpServers ?? current.mcpServers,
      })
    },
    path: () => filePath,
  }
}
