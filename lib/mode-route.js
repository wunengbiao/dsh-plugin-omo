import { OMO_MODES, normalizeOmoMode } from "./mode-store.js";
export const MODE_ROUTE = "/dsh-plugin-omo/mode";
const MAX_BODY_BYTES = 4096;
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
export function createModeRouteHandler(store, logger) {
  return async (request, response) => {
    const url = new URL(request.url ?? MODE_ROUTE, "http://localhost");
    const sessionId = url.searchParams.get("sessionId") ?? undefined;
    if ((request.method ?? "GET") === "GET") {
      sendJson(response, 200, { mode: store.get(sessionId), modes: [...OMO_MODES] });
      return;
    }
    if (request.method !== "POST") {
      sendJson(response, 405, { error: "method not allowed" });
      return;
    }
    try {
      const raw = await readBody(request);
      const parsed = JSON.parse(raw === "" ? "{}" : raw);
      const targetSession = typeof parsed.sessionId === "string" && parsed.sessionId !== "" ? parsed.sessionId : sessionId;
      const requested = typeof parsed.mode === "string" ? parsed.mode : undefined;
      if (requested !== undefined && !OMO_MODES.includes(requested)) {
        sendJson(response, 400, { error: "unknown mode", modes: [...OMO_MODES] });
        return;
      }
      const mode = normalizeOmoMode(requested);
      store.set(targetSession, mode);
      logger?.info("[dsh-plugin-omo] always mode set to " + mode + (targetSession === undefined ? "" : " for one session"));
      sendJson(response, 200, { mode });
    } catch (error) {
      sendJson(response, 400, { error: error instanceof Error ? error.message : String(error) });
    }
  };
}
