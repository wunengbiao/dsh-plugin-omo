import { MODE_ROUTE, createModeRouteHandler } from "./mode-route.js";
import { sharedModeStore } from "./mode-store.js";
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
  ctx.logger?.info("[dsh-plugin-omo] always mode route at " + MODE_ROUTE);
  return { route };
}
