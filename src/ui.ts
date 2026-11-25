/**
 * Optional browser-side entry: the always-mode HTTP surface.
 *
 * Split from the skills entry because the web server is a required injection in this Cordis
 * version, and a headless composition has none: the row stays pending there instead of holding
 * the skill provider hostage.
 */
import type { HostContext, HostLogger, HostRoute } from "./host.ts"
import { MODE_ROUTE, createModeRouteHandler } from "./mode-route.ts"
import { sharedModeStore } from "./mode-store.ts"
import { createSettingsStore, settingsPath as defaultSettingsPath } from "./omo-settings-store.ts"
import { MCP_PROBE_ROUTE, SETTINGS_ROUTE, SKILLS_ROUTE, createSettingsRoutes } from "./settings-routes.ts"
import { defaultSkillRoot } from "./plugin.ts"

export const name = "omo-ui"
export const inject = ["webServer"]

export interface UiPluginInstance {
  readonly route: HostRoute
}

/** Register the always-mode route on the harness web server. */
export function apply(ctx: HostContext, _config?: unknown): UiPluginInstance {
  const webServer = ctx.webServer
  if (webServer === undefined) {
    throw new Error("[dsh-plugin-omo] the ui entry requires the webServer service")
  }
  const handler = createModeRouteHandler(sharedModeStore(), ctx.logger as HostLogger | undefined)
  const route: HostRoute = {
    kind: "exact",
    path: MODE_ROUTE,
    handler: handler as HostRoute["handler"],
  }
  if (ctx.effect !== undefined) {
    ctx.effect(() => webServer.register(route), "dsh-plugin-omo: always mode route")
  } else {
    webServer.register(route)
  }

  // Settings page surface: settings CRUD, skill listing, MCP handshake probe.
  const settingsStore = createSettingsStore(
    typeof (_config as { settingsPath?: unknown } | undefined)?.settingsPath === "string"
      ? String((_config as { settingsPath: string }).settingsPath)
      : defaultSettingsPath(),
  )
  const settingsRoutes = createSettingsRoutes({
    store: settingsStore,
    shippedSkillRoot: defaultSkillRoot(),
    logger: ctx.logger as HostLogger | undefined,
  })
  const extra: HostRoute[] = [
    { kind: "exact", path: SETTINGS_ROUTE, handler: settingsRoutes.settings as HostRoute["handler"] },
    { kind: "exact", path: SKILLS_ROUTE, handler: settingsRoutes.skills as HostRoute["handler"] },
    { kind: "exact", path: MCP_PROBE_ROUTE, handler: settingsRoutes.probe as HostRoute["handler"] },
  ]
  for (const entry of extra) {
    if (ctx.effect !== undefined) {
      ctx.effect(() => webServer.register(entry), "dsh-plugin-omo: " + entry.path)
    } else {
      webServer.register(entry)
    }
  }
  ctx.logger?.info("[dsh-plugin-omo] settings routes ready: " + SETTINGS_ROUTE + ", " + SKILLS_ROUTE + ", " + MCP_PROBE_ROUTE)
  return { route }
}
