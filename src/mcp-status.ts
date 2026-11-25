/**
 * Registered-MCP-tool status shared between the mcp entry (writer) and the settings routes
 * (reader). Both entries are bundled separately, so the slot on globalThis is the handoff.
 */
const STATUS_KEY = Symbol.for("dsh-plugin-omo.mcpStatus")

export interface McpStatusEntry {
  readonly server: string
  readonly tools: readonly string[]
}

export interface McpStatus {
  readonly servers: readonly McpStatusEntry[]
  readonly failures: readonly string[]
}

export const EMPTY_MCP_STATUS: McpStatus = { servers: [], failures: [] }

type Slot = Record<symbol, McpStatus | undefined>

/** Publish the current status after a bootstrap. */
export function setMcpStatus(status: McpStatus): void {
  ;(globalThis as unknown as Slot)[STATUS_KEY] = status
}

/** Read the status; empty when the mcp entry has not run in this process. */
export function getMcpStatus(): McpStatus {
  return (globalThis as unknown as Slot)[STATUS_KEY] ?? EMPTY_MCP_STATUS
}
