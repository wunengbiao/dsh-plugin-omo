const STATUS_KEY = Symbol.for("dsh-plugin-omo.mcpStatus");
export const EMPTY_MCP_STATUS = { servers: [], failures: [] };
export function setMcpStatus(status) {
  globalThis[STATUS_KEY] = status;
}
export function getMcpStatus() {
  return globalThis[STATUS_KEY] ?? EMPTY_MCP_STATUS;
}
