/**
 * Long-lived stdio MCP client: one child process per configured server, newline-delimited
 * JSON-RPC, `initialize` then `tools/list` once, then forwarded `tools/call`.
 */
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process"
import type { HostLogger } from "./host.ts"
import type { McpServerSpec } from "./omo-settings-store.ts"

const PROTOCOL_VERSION = "2024-11-05"
const DEFAULT_TIMEOUT_MS = 15000
const MAX_OUTPUT_BYTES = 4 * 1024 * 1024

export interface McpToolDefinition {
  readonly name: string
  readonly description?: string
  readonly inputSchema?: unknown
}

interface Pending {
  readonly resolve: (value: unknown) => void
  readonly reject: (error: Error) => void
  readonly timer: ReturnType<typeof setTimeout>
}

function summarizeContent(result: unknown): string {
  const content = (result as { content?: unknown } | undefined)?.content
  if (!Array.isArray(content)) return JSON.stringify(result ?? null)
  const parts: string[] = []
  for (const entry of content) {
    if (typeof entry !== "object" || entry === null) continue
    const record = entry as { type?: unknown; text?: unknown; data?: unknown; mimeType?: unknown; uri?: unknown }
    if (record.type === "text" && typeof record.text === "string") parts.push(record.text)
    else if (record.type === "image") parts.push("[image " + String(record.mimeType ?? "unknown") + "]")
    else if (record.type === "resource") parts.push("[resource " + String(record.uri ?? "") + "]")
    else if (typeof record.text === "string") parts.push(record.text)
  }
  return parts.length > 0 ? parts.join("\n") : JSON.stringify(result ?? null)
}

export interface McpClientOptions {
  readonly timeoutMs?: number
  readonly logger?: HostLogger
}

export class McpStdioClient {
  private readonly spec: McpServerSpec
  private readonly options: McpClientOptions
  private child: ChildProcessWithoutNullStreams | undefined
  private buffer = ""
  private bytes = 0
  private nextId = 1
  private readonly pending = new Map<number, Pending>()
  private closed = false

  constructor(spec: McpServerSpec, options: McpClientOptions = {}) {
    this.spec = spec
    this.options = options
  }

  /** Spawn, handshake, and list tools. Throws with a readable reason on any failure. */
  async start(): Promise<McpToolDefinition[]> {
    if (this.spec.transport !== "stdio") throw new Error("unsupported transport: " + this.spec.transport)
    if (this.spec.command === undefined || this.spec.command === "") throw new Error("stdio server needs a command")
    const child = spawn(this.spec.command, [...(this.spec.args ?? [])], {
      env: { ...process.env, ...(this.spec.env ?? {}) },
      stdio: ["pipe", "pipe", "pipe"],
    })
    this.child = child
    child.on("error", (error) => this.failAll(new Error("server failed to start: " + error.message)))
    child.on("exit", (code) => this.failAll(new Error("server exited (code " + String(code) + ")")))
    child.stderr?.on("data", (chunk: Buffer) => this.options.logger?.warn("[mcp " + this.spec.id + "] " + chunk.toString("utf8").trim()))
    child.stdout?.on("data", (chunk: Buffer) => this.onData(chunk))

    await this.request("initialize", {
      protocolVersion: PROTOCOL_VERSION,
      capabilities: {},
      clientInfo: { name: "dsh-plugin-omo", version: "0.4.0" },
    })
    this.notify("notifications/initialized", {})
    const listed = await this.request("tools/list", {})
    const tools = (listed as { tools?: unknown }).tools
    if (!Array.isArray(tools)) return []
    const definitions: McpToolDefinition[] = []
    for (const entry of tools) {
      if (typeof entry !== "object" || entry === null) continue
      const record = entry as { name?: unknown; description?: unknown; inputSchema?: unknown }
      if (typeof record.name !== "string" || record.name === "") continue
      definitions.push({
        name: record.name,
        ...(typeof record.description === "string" ? { description: record.description } : {}),
        ...(record.inputSchema !== undefined ? { inputSchema: record.inputSchema } : {}),
      })
    }
    return definitions
  }

  /** Forward one tools/call and flatten its content to text. */
  async callTool(name: string, args: unknown): Promise<string> {
    const result = await this.request("tools/call", { name, arguments: args ?? {} })
    return summarizeContent(result)
  }

  dispose(): void {
    this.closed = true
    this.failAll(new Error("client disposed"))
    try {
      this.child?.kill("SIGTERM")
    } catch {
      // Already gone.
    }
    this.child = undefined
  }

  private failAll(error: Error): void {
    for (const [id, pending] of this.pending) {
      clearTimeout(pending.timer)
      this.pending.delete(id)
      pending.reject(error)
    }
  }

  private onData(chunk: Buffer): void {
    this.bytes += chunk.length
    if (this.bytes > MAX_OUTPUT_BYTES) {
      this.failAll(new Error("server produced too much output"))
      this.dispose()
      return
    }
    this.buffer += chunk.toString("utf8")
    let index = this.buffer.indexOf("\n")
    while (index >= 0) {
      const line = this.buffer.slice(0, index).trim()
      this.buffer = this.buffer.slice(index + 1)
      index = this.buffer.indexOf("\n")
      if (line === "") continue
      let message: { id?: unknown; result?: unknown; error?: { message?: string } }
      try {
        message = JSON.parse(line) as { id?: unknown; result?: unknown; error?: { message?: string } }
      } catch {
        continue
      }
      if (typeof message.id !== "number") continue
      const pending = this.pending.get(message.id)
      if (pending === undefined) continue
      this.pending.delete(message.id)
      clearTimeout(pending.timer)
      if (message.error !== undefined) pending.reject(new Error(message.error.message ?? "MCP error"))
      else pending.resolve(message.result)
    }
  }

  private write(payload: unknown): void {
    if (this.closed || this.child === undefined) throw new Error("client is closed")
    this.child.stdin.write(JSON.stringify(payload) + "\n")
  }

  private notify(method: string, params: unknown): void {
    try {
      this.write({ jsonrpc: "2.0", method, params })
    } catch {
      // Notifications are best effort.
    }
  }

  private request(method: string, params: unknown): Promise<unknown> {
    const id = this.nextId
    this.nextId += 1
    const timeoutMs = this.options.timeoutMs ?? DEFAULT_TIMEOUT_MS
    return new Promise<unknown>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id)
        reject(new Error(method + " timed out after " + timeoutMs + " ms"))
      }, timeoutMs)
      this.pending.set(id, { resolve, reject, timer })
      try {
        this.write({ jsonrpc: "2.0", id, method, params })
      } catch (error) {
        clearTimeout(timer)
        this.pending.delete(id)
        reject(error instanceof Error ? error : new Error(String(error)))
      }
    })
  }
}
