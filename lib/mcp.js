import { McpStdioClient } from "./mcp-client.js";
import { setMcpStatus } from "./mcp-status.js";
import { createSettingsStore, settingsPath as defaultSettingsPath } from "./omo-settings-store.js";
export const name = "omo-mcp";
export const inject = ["tools"];
const OUTPUT = {
  schema: {
    type: "object",
    properties: { text: { type: "string" } },
    required: ["text"],
    additionalProperties: false
  },
  render(_args, value) {
    return [{ type: "text", text: value.text }];
  }
};
const EMPTY_SCHEMA = { type: "object", properties: {}, additionalProperties: true };
function sanitize(part) {
  const cleaned = part.replace(/[^A-Za-z0-9_-]+/g, "_").replace(/^_+|_+$/g, "");
  return cleaned === "" ? "tool" : cleaned;
}
export async function bootstrapMcpTools(ctx, servers, logger) {
  const clients = [];
  const disposers = [];
  const registered = [];
  const failures = [];
  const taken = new Set;
  for (const server of servers) {
    if (!server.enabled || server.transport !== "stdio")
      continue;
    const client = new McpStdioClient(server, { logger });
    try {
      const tools = await client.start();
      clients.push(client);
      for (const tool of tools) {
        let registeredName = sanitize(server.id) + "__" + sanitize(tool.name);
        if (taken.has(registeredName))
          registeredName = registeredName + "_" + (registered.length + 1);
        taken.add(registeredName);
        disposers.push(ctx.tools.register({
          name: registeredName,
          description: "[" + server.id + "] " + (tool.description ?? tool.name),
          parameters: tool.inputSchema ?? EMPTY_SCHEMA,
          output: OUTPUT,
          async execute(args) {
            const text = await client.callTool(tool.name, args);
            return { text };
          },
          isConcurrencySafe() {
            return false;
          }
        }));
        registered.push({ server: server.id, tool: tool.name, registeredName });
      }
      logger?.info("[dsh-plugin-omo] " + server.id + ": " + tools.length + " MCP tool(s) registered");
    } catch (error) {
      failures.push(server.id + ": " + (error instanceof Error ? error.message : String(error)));
      logger?.warn("[dsh-plugin-omo] MCP server " + server.id + " skipped: " + String(error));
      client.dispose();
    }
  }
  const byServer = new Map;
  for (const entry of registered) {
    byServer.set(entry.server, [...byServer.get(entry.server) ?? [], entry.registeredName]);
  }
  setMcpStatus({
    servers: [...byServer.entries()].map(([server, tools]) => ({ server, tools })),
    failures
  });
  return {
    result: { servers: clients.length, tools: registered, failures },
    dispose: () => {
      for (const dispose of disposers.splice(0))
        dispose();
      for (const client of clients.splice(0))
        client.dispose();
    }
  };
}
export function apply(ctx, config) {
  const store = createSettingsStore(typeof config?.settingsPath === "string" && config.settingsPath !== "" ? config.settingsPath : defaultSettingsPath());
  const servers = store.read().mcpServers;
  let disposeTools = () => {
    return;
  };
  const ready = bootstrapMcpTools(ctx, servers, ctx.logger).then(({ result, dispose }) => {
    disposeTools = dispose;
    return result;
  });
  if (ctx.effect !== undefined) {
    ctx.effect(() => () => disposeTools(), "dsh-plugin-omo: mcp tools");
  }
  return {
    ready,
    dispose: () => disposeTools()
  };
}
