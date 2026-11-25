import { spawn } from "node:child_process";
const PROTOCOL_VERSION = "2024-11-05";
const DEFAULT_TIMEOUT_MS = 15000;
const MAX_OUTPUT_BYTES = 4 * 1024 * 1024;
function summarizeContent(result) {
  const content = result?.content;
  if (!Array.isArray(content))
    return JSON.stringify(result ?? null);
  const parts = [];
  for (const entry of content) {
    if (typeof entry !== "object" || entry === null)
      continue;
    const record = entry;
    if (record.type === "text" && typeof record.text === "string")
      parts.push(record.text);
    else if (record.type === "image")
      parts.push("[image " + String(record.mimeType ?? "unknown") + "]");
    else if (record.type === "resource")
      parts.push("[resource " + String(record.uri ?? "") + "]");
    else if (typeof record.text === "string")
      parts.push(record.text);
  }
  return parts.length > 0 ? parts.join(`
`) : JSON.stringify(result ?? null);
}

export class McpStdioClient {
  spec;
  options;
  child;
  buffer = "";
  bytes = 0;
  nextId = 1;
  pending = new Map;
  closed = false;
  constructor(spec, options = {}) {
    this.spec = spec;
    this.options = options;
  }
  async start() {
    if (this.spec.transport !== "stdio")
      throw new Error("unsupported transport: " + this.spec.transport);
    if (this.spec.command === undefined || this.spec.command === "")
      throw new Error("stdio server needs a command");
    const child = spawn(this.spec.command, [...this.spec.args ?? []], {
      env: { ...process.env, ...this.spec.env ?? {} },
      stdio: ["pipe", "pipe", "pipe"]
    });
    this.child = child;
    child.on("error", (error) => this.failAll(new Error("server failed to start: " + error.message)));
    child.on("exit", (code) => this.failAll(new Error("server exited (code " + String(code) + ")")));
    child.stderr?.on("data", (chunk) => this.options.logger?.warn("[mcp " + this.spec.id + "] " + chunk.toString("utf8").trim()));
    child.stdout?.on("data", (chunk) => this.onData(chunk));
    await this.request("initialize", {
      protocolVersion: PROTOCOL_VERSION,
      capabilities: {},
      clientInfo: { name: "dsh-plugin-omo", version: "0.4.0" }
    });
    this.notify("notifications/initialized", {});
    const listed = await this.request("tools/list", {});
    const tools = listed.tools;
    if (!Array.isArray(tools))
      return [];
    const definitions = [];
    for (const entry of tools) {
      if (typeof entry !== "object" || entry === null)
        continue;
      const record = entry;
      if (typeof record.name !== "string" || record.name === "")
        continue;
      definitions.push({
        name: record.name,
        ...typeof record.description === "string" ? { description: record.description } : {},
        ...record.inputSchema !== undefined ? { inputSchema: record.inputSchema } : {}
      });
    }
    return definitions;
  }
  async callTool(name, args) {
    const result = await this.request("tools/call", { name, arguments: args ?? {} });
    return summarizeContent(result);
  }
  dispose() {
    this.closed = true;
    this.failAll(new Error("client disposed"));
    try {
      this.child?.kill("SIGTERM");
    } catch {}
    this.child = undefined;
  }
  failAll(error) {
    for (const [id, pending] of this.pending) {
      clearTimeout(pending.timer);
      this.pending.delete(id);
      pending.reject(error);
    }
  }
  onData(chunk) {
    this.bytes += chunk.length;
    if (this.bytes > MAX_OUTPUT_BYTES) {
      this.failAll(new Error("server produced too much output"));
      this.dispose();
      return;
    }
    this.buffer += chunk.toString("utf8");
    let index = this.buffer.indexOf(`
`);
    while (index >= 0) {
      const line = this.buffer.slice(0, index).trim();
      this.buffer = this.buffer.slice(index + 1);
      index = this.buffer.indexOf(`
`);
      if (line === "")
        continue;
      let message;
      try {
        message = JSON.parse(line);
      } catch {
        continue;
      }
      if (typeof message.id !== "number")
        continue;
      const pending = this.pending.get(message.id);
      if (pending === undefined)
        continue;
      this.pending.delete(message.id);
      clearTimeout(pending.timer);
      if (message.error !== undefined)
        pending.reject(new Error(message.error.message ?? "MCP error"));
      else
        pending.resolve(message.result);
    }
  }
  write(payload) {
    if (this.closed || this.child === undefined)
      throw new Error("client is closed");
    this.child.stdin.write(JSON.stringify(payload) + `
`);
  }
  notify(method, params) {
    try {
      this.write({ jsonrpc: "2.0", method, params });
    } catch {}
  }
  request(method, params) {
    const id = this.nextId;
    this.nextId += 1;
    const timeoutMs = this.options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(method + " timed out after " + timeoutMs + " ms"));
      }, timeoutMs);
      this.pending.set(id, { resolve, reject, timer });
      try {
        this.write({ jsonrpc: "2.0", id, method, params });
      } catch (error) {
        clearTimeout(timer);
        this.pending.delete(id);
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    });
  }
}
