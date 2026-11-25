import { statSync } from "node:fs";
import { probeMcpServer } from "./mcp-probe.js";
import { getMcpStatus } from "./mcp-status.js";
import { normalizeSettings } from "./omo-settings-store.js";
import { listCandidates } from "./skill-catalog.js";
export const SETTINGS_ROUTE = "/dsh-plugin-omo/settings";
export const SKILLS_ROUTE = "/dsh-plugin-omo/skills";
export const MCP_PROBE_ROUTE = "/dsh-plugin-omo/mcp/probe";
const MAX_BODY_BYTES = 256 * 1024;
function sendJson(response, status, payload) {
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "x-content-type-options": "nosniff"
  });
  response.end(JSON.stringify(payload));
}
function readBody(request) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    request.on("data", (chunk) => {
      const text = typeof chunk === "string" ? chunk : Buffer.isBuffer(chunk) ? chunk.toString("utf8") : "";
      size += text.length;
      if (size > MAX_BODY_BYTES) {
        reject(new Error("body too large"));
        return;
      }
      chunks.push(text);
    });
    request.on("end", () => resolve(chunks.join("")));
    request.on("error", (error) => reject(error instanceof Error ? error : new Error(String(error))));
  });
}
export function catalogOptionsFrom(settings, options) {
  return {
    roots: [options.shippedSkillRoot, ...options.baseExtraDirs ?? [], ...settings.extraSkillDirs],
    disabled: new Set([...options.baseDisabled ?? [], ...settings.disabledSkills]),
    rank: 600,
    providerName: "omo"
  };
}
function validateExtraDirs(dirs) {
  for (const dir of dirs) {
    let stats;
    try {
      stats = statSync(dir);
    } catch {
      return "skill directory does not exist: " + dir;
    }
    if (!stats.isDirectory())
      return "skill path is not a directory: " + dir;
  }
  return;
}
export function createSettingsRoutes(options) {
  const settingsState = () => ({
    path: options.store.path(),
    settings: options.store.read(),
    registered: getMcpStatus()
  });
  return {
    async settings(request, response) {
      const method = request.method ?? "GET";
      if (method === "GET") {
        sendJson(response, 200, settingsState());
        return;
      }
      if (method !== "POST") {
        sendJson(response, 405, { error: "method not allowed" });
        return;
      }
      try {
        const raw = await readBody(request);
        const parsed = JSON.parse(raw === "" ? "{}" : raw);
        const next = normalizeSettings({ ...options.store.read(), ...parsed });
        const directoryError = validateExtraDirs(next.extraSkillDirs);
        if (directoryError !== undefined) {
          sendJson(response, 400, { error: directoryError });
          return;
        }
        options.store.write(next);
        options.logger?.info("[dsh-plugin-omo] settings saved to " + options.store.path());
        sendJson(response, 200, { path: options.store.path(), settings: next });
      } catch (error) {
        sendJson(response, 400, { error: error instanceof Error ? error.message : String(error) });
      }
    },
    async skills(_request, response) {
      const settings = options.store.read();
      const disabled = new Set([...options.baseDisabled ?? [], ...settings.disabledSkills]);
      const listing = listCandidates({ ...catalogOptionsFrom(settings, options), disabled: new Set });
      sendJson(response, 200, {
        extraSkillDirs: settings.extraSkillDirs,
        items: listing.candidates.map((candidate) => ({
          name: candidate.name,
          description: candidate.description,
          source: candidate.path?.startsWith(options.shippedSkillRoot) === true ? "bundled" : "extra",
          path: candidate.path,
          enabled: !disabled.has(candidate.name)
        })),
        issues: listing.issues
      });
    },
    async probe(request, response) {
      const url = new URL(request.url ?? MCP_PROBE_ROUTE, "http://localhost");
      const id = url.searchParams.get("id") ?? "";
      const server = options.store.read().mcpServers.find((entry) => entry.id === id);
      if (server === undefined) {
        sendJson(response, 404, { error: "unknown server", id });
        return;
      }
      const result = await probeMcpServer(server);
      sendJson(response, 200, result);
    }
  };
}
