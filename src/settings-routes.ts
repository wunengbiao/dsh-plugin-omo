/**
 * HTTP surface behind the omo settings page: read and patch the settings file, list the
 * skills the provider would serve, and probe one MCP server.
 */
import { statSync } from "node:fs"
import type { HostLogger } from "./host.ts"
import { probeMcpServer } from "./mcp-probe.ts"
import { getMcpStatus } from "./mcp-status.ts"
import { type McpServerSpec, type OmoSettings, type SettingsStore, normalizeSettings } from "./omo-settings-store.ts"
import { type CatalogOptions, listCandidates } from "./skill-catalog.ts"

export const SETTINGS_ROUTE = "/dsh-plugin-omo/settings"
export const SKILLS_ROUTE = "/dsh-plugin-omo/skills"
export const MCP_PROBE_ROUTE = "/dsh-plugin-omo/mcp/probe"
const MAX_BODY_BYTES = 256 * 1024

export interface SettingsRouteRequest {
  readonly method?: string | undefined
  readonly url?: string | undefined
  on: (event: "data" | "end" | "error", listener: (chunk?: unknown) => void) => void
}

export interface SettingsRouteResponse {
  writeHead: (status: number, headers: Record<string, string>) => void
  end: (body?: string) => void
}

function sendJson(response: SettingsRouteResponse, status: number, payload: unknown): void {
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
  })
  response.end(JSON.stringify(payload))
}

function readBody(request: SettingsRouteRequest): Promise<string> {
  return new Promise((resolve, reject) => {
    let size = 0
    const chunks: string[] = []
    request.on("data", (chunk) => {
      const text = typeof chunk === "string" ? chunk : Buffer.isBuffer(chunk) ? chunk.toString("utf8") : ""
      size += text.length
      if (size > MAX_BODY_BYTES) {
        reject(new Error("body too large"))
        return
      }
      chunks.push(text)
    })
    request.on("end", () => resolve(chunks.join("")))
    request.on("error", (error) => reject(error instanceof Error ? error : new Error(String(error))))
  })
}

export interface SettingsRoutesOptions {
  readonly store: SettingsStore
  /** Package skill root, always scanned. */
  readonly shippedSkillRoot: string
  /** Row configuration that the store values extend. */
  readonly baseDisabled?: readonly string[]
  readonly baseExtraDirs?: readonly string[]
  readonly logger?: HostLogger
}

export interface SettingsRoutes {
  readonly settings: (request: SettingsRouteRequest, response: SettingsRouteResponse) => Promise<void>
  readonly skills: (request: SettingsRouteRequest, response: SettingsRouteResponse) => Promise<void>
  readonly probe: (request: SettingsRouteRequest, response: SettingsRouteResponse) => Promise<void>
}

/** Catalog options the provider and the settings listing both use. */
export function catalogOptionsFrom(settings: OmoSettings, options: SettingsRoutesOptions): CatalogOptions {
  return {
    roots: [options.shippedSkillRoot, ...(options.baseExtraDirs ?? []), ...settings.extraSkillDirs],
    disabled: new Set([...(options.baseDisabled ?? []), ...settings.disabledSkills]),
    rank: 600,
    providerName: "omo",
  }
}

/** Reject a patch that points the provider at a path that cannot hold skills. */
function validateExtraDirs(dirs: readonly string[]): string | undefined {
  for (const dir of dirs) {
    let stats
    try {
      stats = statSync(dir)
    } catch {
      return "skill directory does not exist: " + dir
    }
    if (!stats.isDirectory()) return "skill path is not a directory: " + dir
  }
  return undefined
}

/** Create the three handlers bound to one store. */
export function createSettingsRoutes(options: SettingsRoutesOptions): SettingsRoutes {
  const settingsState = (): Record<string, unknown> => ({
    path: options.store.path(),
    settings: options.store.read(),
    registered: getMcpStatus(),
  })

  return {
    async settings(request, response) {
      const method = request.method ?? "GET"
      if (method === "GET") {
        sendJson(response, 200, settingsState())
        return
      }
      if (method !== "POST") {
        sendJson(response, 405, { error: "method not allowed" })
        return
      }
      try {
        const raw = await readBody(request)
        const parsed = JSON.parse(raw === "" ? "{}" : raw) as Partial<OmoSettings>
        const next = normalizeSettings({ ...options.store.read(), ...parsed })
        const directoryError = validateExtraDirs(next.extraSkillDirs)
        if (directoryError !== undefined) {
          sendJson(response, 400, { error: directoryError })
          return
        }
        options.store.write(next)
        options.logger?.info("[dsh-plugin-omo] settings saved to " + options.store.path())
        sendJson(response, 200, { path: options.store.path(), settings: next })
      } catch (error) {
        sendJson(response, 400, { error: error instanceof Error ? error.message : String(error) })
      }
    },

    async skills(_request, response) {
      const settings = options.store.read()
      const disabled = new Set([...(options.baseDisabled ?? []), ...settings.disabledSkills])
      // The page must show disabled skills too, so discover without the disabled filter.
      const listing = listCandidates({ ...catalogOptionsFrom(settings, options), disabled: new Set<string>() })
      sendJson(response, 200, {
        extraSkillDirs: settings.extraSkillDirs,
        items: listing.candidates.map((candidate) => ({
          name: candidate.name,
          description: candidate.description,
          source: candidate.path?.startsWith(options.shippedSkillRoot) === true ? "bundled" : "extra",
          path: candidate.path,
          enabled: !disabled.has(candidate.name),
        })),
        issues: listing.issues,
      })
    },

    async probe(request, response) {
      const url = new URL(request.url ?? MCP_PROBE_ROUTE, "http://localhost")
      const id = url.searchParams.get("id") ?? ""
      const server = options.store.read().mcpServers.find((entry: McpServerSpec) => entry.id === id)
      if (server === undefined) {
        sendJson(response, 404, { error: "unknown server", id })
        return
      }
      const result = await probeMcpServer(server)
      sendJson(response, 200, result)
    },
  }
}
