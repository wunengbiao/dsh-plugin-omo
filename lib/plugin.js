import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createOmoProvider } from "./provider.js";
import { BUNDLED_SKILL_RANK, countSkillDocuments } from "./skill-catalog.js";
import { createRootWatcher } from "./skill-watcher.js";
import { SKILL_NAME_PATTERN } from "./skill-document.js";
export const name = "omo";
export const inject = ["skills"];
const DEFAULT_PROVIDER_NAME = "omo";
const RESERVED_PROVIDER_NAME = "runtime";
const KNOWN_KEYS = new Set(["providerName", "skillDir", "extraSkillDirs", "disabled", "rank"]);
function configError(reason) {
  return new Error("[dsh-plugin-omo] invalid configuration: " + reason);
}
export function defaultSkillRoot() {
  return resolve(dirname(fileURLToPath(import.meta.url)), "..", "skills");
}
function readProviderName(value) {
  if (value === undefined)
    return DEFAULT_PROVIDER_NAME;
  if (typeof value !== "string")
    throw configError("providerName must be a string");
  const trimmed = value.trim();
  if (!SKILL_NAME_PATTERN.test(trimmed))
    throw configError("providerName must be kebab-case, received " + trimmed);
  if (trimmed === RESERVED_PROVIDER_NAME)
    throw configError("providerName " + RESERVED_PROVIDER_NAME + " is reserved");
  return trimmed;
}
function readStringArray(value, key) {
  if (value === undefined)
    return [];
  if (!Array.isArray(value))
    throw configError(key + " must be an array of strings");
  const values = [];
  for (const entry of value) {
    if (typeof entry !== "string" || entry.trim() === "")
      throw configError(key + " must contain non-empty strings");
    values.push(entry.trim());
  }
  return values;
}
function readRank(value) {
  if (value === undefined)
    return BUNDLED_SKILL_RANK;
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    throw configError("rank must be a non-negative integer");
  }
  return value;
}
export function normalizeOmoConfig(config) {
  if (config === undefined || config === null) {
    return { providerName: DEFAULT_PROVIDER_NAME, roots: [defaultSkillRoot()], disabled: new Set, rank: BUNDLED_SKILL_RANK };
  }
  if (typeof config !== "object" || Array.isArray(config))
    throw configError("configuration must be a mapping");
  const record = config;
  const unknownKeys = Object.keys(record).filter((key) => !KNOWN_KEYS.has(key));
  if (unknownKeys.length > 0)
    throw configError("unknown keys: " + unknownKeys.join(", "));
  if (record.skillDir !== undefined && typeof record.skillDir !== "string") {
    throw configError("skillDir must be a string");
  }
  const primaryRoot = typeof record.skillDir === "string" && record.skillDir.trim() !== "" ? resolve(record.skillDir) : defaultSkillRoot();
  const roots = [primaryRoot, ...readStringArray(record.extraSkillDirs, "extraSkillDirs").map((entry) => resolve(entry))];
  const disabled = new Set;
  for (const entry of readStringArray(record.disabled, "disabled")) {
    if (!SKILL_NAME_PATTERN.test(entry))
      throw configError("disabled entry must be kebab-case, received " + entry);
    disabled.add(entry);
  }
  return { providerName: readProviderName(record.providerName), roots, disabled, rank: readRank(record.rank) };
}
export function apply(ctx, config) {
  const normalized = normalizeOmoConfig(config);
  const provider = createOmoProvider({
    roots: normalized.roots,
    disabled: normalized.disabled,
    rank: normalized.rank,
    providerName: normalized.providerName
  }, ctx.logger);
  const watcher = createRootWatcher({ roots: normalized.roots, logger: ctx.logger });
  const dispose = ctx.skills.registerProvider((control) => {
    watcher.start(control.invalidate);
    return provider;
  });
  const missingRoots = normalized.roots.filter((rootPath) => !existsSync(rootPath));
  if (missingRoots.length > 0) {
    ctx.logger?.warn("[dsh-plugin-omo] skill roots missing: " + missingRoots.join(", "));
  }
  let documentCount = 0;
  try {
    documentCount = countSkillDocuments(normalized.roots);
  } catch (error) {
    ctx.logger?.warn("[dsh-plugin-omo] could not count skill documents: " + String(error));
  }
  ctx.logger?.info("[dsh-plugin-omo] registered provider " + normalized.providerName + " over " + documentCount + " skill documents");
  return {
    provider,
    dispose: () => {
      watcher.stop();
      dispose();
    }
  };
}
