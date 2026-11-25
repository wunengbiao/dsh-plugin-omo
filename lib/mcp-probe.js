import { spawn } from "node:child_process";
const PROTOCOL_VERSION = "2024-11-05";
const DEFAULT_TIMEOUT_MS = 8000;
const MAX_OUTPUT_BYTES = 1024 * 1024;
function summarizeTools(result) {
  const tools = result?.tools;
  if (!Array.isArray(tools))
    return [];
  const summaries = [];
  for (const entry of tools) {
    if (typeof entry !== "object" || entry === null)
      continue;
    const record = entry;
    if (typeof record.name !== "string" || record.name === "")
      continue;
    summaries.push({
      name: record.name,
      ...typeof record.description === "string" && record.description !== "" ? { description: record.description } : {}
    });
  }
  return summaries;
}
export function probeMcpServer(server, options = {}) {
  const started = Date.now();
  const fail = (error) => ({ ok: false, server: server.id, error, durationMs: Date.now() - started });
  if (server.transport === "http") {
    return Promise.resolve(fail("http transport is not supported yet; configure a stdio server"));
  }
  if (server.command === undefined || server.command === "") {
    return Promise.resolve(fail("stdio server needs a command"));
  }
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  return new Promise((resolve) => {
    let settled = false;
    let buffer = "";
    let bytes = 0;
    const finish = (result) => {
      if (settled)
        return;
      settled = true;
      clearTimeout(timer);
      try {
        child.kill("SIGTERM");
      } catch {}
      resolve(result);
    };
    const child = spawn(server.command, [...server.args ?? []], {
      env: { ...process.env, ...server.env ?? {} },
      stdio: ["pipe", "pipe", "pipe"]
    });
    const timer = setTimeout(() => finish(fail("timed out after " + timeoutMs + " ms")), timeoutMs);
    const send = (message) => {
      try {
        child.stdin?.write(JSON.stringify(message) + `
`);
      } catch {
        finish(fail("could not write to the server"));
      }
    };
    child.on("error", (error) => finish(fail("failed to start: " + error.message)));
    child.on("exit", (code) => finish(fail("server exited before answering (code " + String(code) + ")")));
    child.stderr?.on("data", () => {
      return;
    });
    child.stdout?.on("data", (chunk) => {
      bytes += chunk.length;
      if (bytes > MAX_OUTPUT_BYTES) {
        finish(fail("server produced too much output"));
        return;
      }
      buffer += chunk.toString("utf8");
      let index = buffer.indexOf(`
`);
      while (index >= 0) {
        const line = buffer.slice(0, index).trim();
        buffer = buffer.slice(index + 1);
        index = buffer.indexOf(`
`);
        if (line === "")
          continue;
        let message;
        try {
          message = JSON.parse(line);
        } catch {
          continue;
        }
        if (message.id === 1) {
          if (message.error !== undefined) {
            finish(fail("initialize failed: " + (message.error.message ?? "unknown error")));
            return;
          }
          send({ jsonrpc: "2.0", method: "notifications/initialized", params: {} });
          send({ jsonrpc: "2.0", id: 2, method: "tools/list", params: {} });
          continue;
        }
        if (message.id === 2) {
          if (message.error !== undefined) {
            finish(fail("tools/list failed: " + (message.error.message ?? "unknown error")));
            return;
          }
          finish({ ok: true, server: server.id, tools: summarizeTools(message.result), durationMs: Date.now() - started });
          return;
        }
      }
    });
    send({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: PROTOCOL_VERSION,
        capabilities: {},
        clientInfo: { name: "dsh-plugin-omo", version: "0.3.0" }
      }
    });
  });
}
