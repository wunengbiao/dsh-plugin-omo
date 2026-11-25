import { existsSync, mkdirSync, readFileSync, renameSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
export const EMPTY_SETTINGS = { disabledSkills: [], extraSkillDirs: [], mcpServers: [] };
export function settingsPath() {
  const home = process.env.DSH_HOME !== undefined && process.env.DSH_HOME !== "" ? process.env.DSH_HOME : join(homedir(), ".dsh");
  return join(home, "omo", "settings.json");
}
function toStringArray(value) {
  return Array.isArray(value) ? value.filter((entry) => typeof entry === "string" && entry !== "") : [];
}
function toMcpServer(value) {
  if (typeof value !== "object" || value === null)
    return;
  const record = value;
  const id = typeof record.id === "string" ? record.id.trim() : "";
  if (id === "")
    return;
  const transport = record.transport === "http" ? "http" : "stdio";
  const env = {};
  if (typeof record.env === "object" && record.env !== null) {
    for (const [key, entry] of Object.entries(record.env)) {
      if (typeof entry === "string")
        env[key] = entry;
    }
  }
  return {
    id,
    name: typeof record.name === "string" && record.name !== "" ? record.name : id,
    transport,
    ...typeof record.command === "string" && record.command !== "" ? { command: record.command } : {},
    ...Array.isArray(record.args) ? { args: record.args.filter((entry) => typeof entry === "string") } : {},
    ...Object.keys(env).length > 0 ? { env } : {},
    ...typeof record.url === "string" && record.url !== "" ? { url: record.url } : {},
    enabled: record.enabled !== false
  };
}
export function normalizeSettings(value) {
  if (typeof value !== "object" || value === null)
    return EMPTY_SETTINGS;
  const record = value;
  const byId = new Map;
  for (const entry of Array.isArray(record.mcpServers) ? record.mcpServers : []) {
    const server = toMcpServer(entry);
    if (server !== undefined)
      byId.set(server.id, server);
  }
  return {
    disabledSkills: [...new Set(toStringArray(record.disabledSkills))],
    extraSkillDirs: [...new Set(toStringArray(record.extraSkillDirs))],
    mcpServers: [...byId.values()]
  };
}
export function createSettingsStore(filePath = settingsPath()) {
  let cached = EMPTY_SETTINGS;
  let cachedMtime = -1;
  const read = () => {
    if (!existsSync(filePath)) {
      cached = EMPTY_SETTINGS;
      cachedMtime = -1;
      return cached;
    }
    const mtime = statSync(filePath).mtimeMs;
    if (mtime === cachedMtime)
      return cached;
    try {
      cached = normalizeSettings(JSON.parse(readFileSync(filePath, "utf8")));
    } catch {
      cached = EMPTY_SETTINGS;
    }
    cachedMtime = mtime;
    return cached;
  };
  const write = (next) => {
    const normalized = normalizeSettings(next);
    mkdirSync(dirname(filePath), { recursive: true });
    const temporary = filePath + ".tmp";
    writeFileSync(temporary, JSON.stringify(normalized, null, 2) + `
`);
    renameSync(temporary, filePath);
    cached = normalized;
    cachedMtime = statSync(filePath).mtimeMs;
    return normalized;
  };
  return {
    read,
    write,
    patch: (patch) => {
      const current = read();
      return write({
        disabledSkills: patch.disabledSkills ?? current.disabledSkills,
        extraSkillDirs: patch.extraSkillDirs ?? current.extraSkillDirs,
        mcpServers: patch.mcpServers ?? current.mcpServers
      });
    },
    path: () => filePath
  };
}
