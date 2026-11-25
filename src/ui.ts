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
  ctx.logger?.info("[dsh-plugin-omo] always mode route at " + MODE_ROUTE)
  return { route }
}
