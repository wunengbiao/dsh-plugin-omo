import { MODE_ROUTE, createModeRouteHandler } from "./mode-route.js";
import { sharedModeStore } from "./mode-store.js";
import { createSettingsStore, settingsPath as defaultSettingsPath } from "./omo-settings-store.js";
import { MCP_PROBE_ROUTE, SETTINGS_ROUTE, SKILLS_ROUTE, createSettingsRoutes } from "./settings-routes.js";
import { defaultSkillRoot } from "./plugin.js";
export const name = "omo-ui";
export const inject = ["webServer"];
export function apply(ctx, _config) {
  const webServer = ctx.webServer;
  if (webServer === undefined) {
    throw new Error("[dsh-plugin-omo] the ui entry requires the webServer service");
  }
  const handler = createModeRouteHandler(sharedModeStore(), ctx.logger);
  const route = {
    kind: "exact",
    path: MODE_ROUTE,
    handler
  };
  if (ctx.effect !== undefined) {
    ctx.effect(() => webServer.register(route), "dsh-plugin-omo: always mode route");
  } else {
    webServer.register(route);
  }
  const settingsStore = createSettingsStore(typeof _config?.settingsPath === "string" ? String(_config.settingsPath) : defaultSettingsPath());
  const settingsRoutes = createSettingsRoutes({
    store: settingsStore,
    shippedSkillRoot: defaultSkillRoot(),
    logger: ctx.logger
  });
  const extra = [
    { kind: "exact", path: SETTINGS_ROUTE, handler: settingsRoutes.settings },
    { kind: "exact", path: SKILLS_ROUTE, handler: settingsRoutes.skills },
    { kind: "exact", path: MCP_PROBE_ROUTE, handler: settingsRoutes.probe }
  ];
  for (const entry of extra) {
    if (ctx.effect !== undefined) {
      ctx.effect(() => webServer.register(entry), "dsh-plugin-omo: " + entry.path);
    } else {
      webServer.register(entry);
    }
  }
  ctx.logger?.info("[dsh-plugin-omo] settings routes ready: " + SETTINGS_ROUTE + ", " + SKILLS_ROUTE + ", " + MCP_PROBE_ROUTE);
  return { route };
}
