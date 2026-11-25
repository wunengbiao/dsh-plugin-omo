/**
 * MCP entry: start the enabled stdio servers from the settings file and expose their tools
 * to the model as `<server>__<tool>`, forwarding every call through `tools/call`.
 *
 * It injects `tools` only, so a composition without the tool registry simply leaves this
 * row pending; failures of individual servers are logged and skipped, never fatal.
 */
import type { HostContext, HostLogger } from "./host.ts"
import { McpStdioClient } from "./mcp-client.ts"
import { setMcpStatus } from "./mcp-status.ts"
import { createSettingsStore, settingsPath as defaultSettingsPath, type McpServerSpec } from "./omo-settings-store.ts"

export const name = "omo-mcp"
export const inject = ["tools"]

const OUTPUT = {
  schema: {
    type: "object",
    properties: { text: { type: "string" } },
    required: ["text"],
    additionalProperties: false,
  },
  render(_args: unknown, value: { text: string }) {
    return [{ type: "text", text: value.text }]
  },
}

const EMPTY_SCHEMA = { type: "object", properties: {}, additionalProperties: true }

/** DSH tool names are conservative; MCP names may carry dots or spaces. */
function sanitize(part: string): string {
  const cleaned = part.replace(/[^A-Za-z0-9_-]+/g, "_").replace(/^_+|_+$/g, "")
  return cleaned === "" ? "tool" : cleaned
}

export interface McpPluginConfig {
  readonly settingsPath?: string
}

export interface McpServerTool {
  readonly server: string
  readonly tool: string
  readonly registeredName: string
}

export interface McpBootstrapResult {
  readonly servers: number
  readonly tools: readonly McpServerTool[]
  readonly failures: readonly string[]
}

export interface McpPluginInstance {
  readonly ready: Promise<McpBootstrapResult>
  readonly dispose: () => void
}

/** Register every enabled server's tools. Failures are reported, not thrown. */
export async function bootstrapMcpTools(
  ctx: HostContext,
  servers: readonly McpServerSpec[],
  logger?: HostLogger,
): Promise<{ result: McpBootstrapResult; dispose: () => void }> {
  const clients: McpStdioClient[] = []
  const disposers: (() => void)[] = []
  const registered: McpServerTool[] = []
  const failures: string[] = []
  const taken = new Set<string>()

  for (const server of servers) {
    if (!server.enabled || server.transport !== "stdio") continue
    const client = new McpStdioClient(server, { logger })
    try {
      const tools = await client.start()
      clients.push(client)
      for (const tool of tools) {
        let registeredName = sanitize(server.id) + "__" + sanitize(tool.name)
        if (taken.has(registeredName)) registeredName = registeredName + "_" + (registered.length + 1)
        taken.add(registeredName)
        disposers.push(
          (ctx.tools as {
            register: (definition: unknown) => () => void
          }).register({
            name: registeredName,
            description: "[" + server.id + "] " + (tool.description ?? tool.name),
            parameters: tool.inputSchema ?? EMPTY_SCHEMA,
            output: OUTPUT,
            async execute(args: unknown) {
              const text = await client.callTool(tool.name, args)
              return { text }
            },
            isConcurrencySafe() {
              // MCP tools may mutate; keep calls exclusive.
              return false
            },
          }),
        )
        registered.push({ server: server.id, tool: tool.name, registeredName })
      }
      logger?.info("[dsh-plugin-omo] " + server.id + ": " + tools.length + " MCP tool(s) registered")
    } catch (error) {
      failures.push(server.id + ": " + (error instanceof Error ? error.message : String(error)))
      logger?.warn("[dsh-plugin-omo] MCP server " + server.id + " skipped: " + String(error))
      client.dispose()
    }
  }

  const byServer = new Map<string, string[]>()
  for (const entry of registered) {
    byServer.set(entry.server, [...(byServer.get(entry.server) ?? []), entry.registeredName])
  }
  setMcpStatus({
    servers: [...byServer.entries()].map(([server, tools]) => ({ server, tools })),
    failures,
  })

  return {
    result: { servers: clients.length, tools: registered, failures },
    dispose: () => {
      for (const dispose of disposers.splice(0)) dispose()
      for (const client of clients.splice(0)) client.dispose()
    },
  }
}

/** Cordis entry; registration runs in the background so a slow server cannot block boot. */
export function apply(ctx: HostContext, config?: McpPluginConfig): McpPluginInstance {
  const store = createSettingsStore(
    typeof config?.settingsPath === "string" && config.settingsPath !== "" ? config.settingsPath : defaultSettingsPath(),
  )
  const servers = store.read().mcpServers
  let disposeTools: () => void = () => undefined
  const ready = bootstrapMcpTools(ctx, servers, ctx.logger).then(({ result, dispose }) => {
    disposeTools = dispose
    return result
  })
  if (ctx.effect !== undefined) {
    ctx.effect(() => () => disposeTools(), "dsh-plugin-omo: mcp tools")
  }
  return {
    ready,
    dispose: () => disposeTools(),
  }
}
