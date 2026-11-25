/**
 * HTTP surface the client dropdown uses to read and write the always mode.
 * Registered on the harness web server, so it lives on the same origin as the UI.
 */
import type { HostLogger } from "./host.ts"
import { type ModeStore, OMO_MODES, normalizeOmoMode } from "./mode-store.ts"

export const MODE_ROUTE = "/dsh-plugin-omo/mode"
const MAX_BODY_BYTES = 4096

export interface RouteRequest {
  readonly method?: string | undefined
  readonly url?: string | undefined
  on: (event: "data" | "end" | "error", listener: (chunk?: unknown) => void) => void
}

export interface RouteResponse {
  writeHead: (status: number, headers: Record<string, string>) => void
  end: (body?: string) => void
}

function sendJson(response: RouteResponse, status: number, payload: unknown): void {
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
  })
  response.end(JSON.stringify(payload))
}

function readBody(request: RouteRequest): Promise<string> {
  return new Promise((resolve, reject) => {
    let size = 0
    const chunks: string[] = []
    request.on("data", (chunk) => {
      const text = typeof chunk === "string" ? chunk : Buffer.isBuffer(chunk) ? chunk.toString("utf8") : ""
      size += text.length
      if (size > MAX_BODY_BYTES) {
        reject(new Error("body too large"))
        return
      }
      chunks.push(text)
    })
    request.on("end", () => resolve(chunks.join("")))
    request.on("error", (error) => reject(error instanceof Error ? error : new Error(String(error))))
  })
}

/** Create the route handler bound to one store. */
export function createModeRouteHandler(store: ModeStore, logger?: HostLogger) {
  return async (request: RouteRequest, response: RouteResponse): Promise<void> => {
    const url = new URL(request.url ?? MODE_ROUTE, "http://localhost")
    const sessionId = url.searchParams.get("sessionId") ?? undefined
    if ((request.method ?? "GET") === "GET") {
      sendJson(response, 200, { mode: store.get(sessionId), modes: [...OMO_MODES] })
      return
    }
    if (request.method !== "POST") {
      sendJson(response, 405, { error: "method not allowed" })
      return
    }
    try {
      const raw = await readBody(request)
      const parsed = JSON.parse(raw === "" ? "{}" : raw) as { sessionId?: unknown; mode?: unknown }
      const targetSession =
        typeof parsed.sessionId === "string" && parsed.sessionId !== "" ? parsed.sessionId : sessionId
      const requested = typeof parsed.mode === "string" ? parsed.mode : undefined
      if (requested !== undefined && !(OMO_MODES as readonly string[]).includes(requested)) {
        sendJson(response, 400, { error: "unknown mode", modes: [...OMO_MODES] })
        return
      }
      const mode = normalizeOmoMode(requested)
      store.set(targetSession, mode)
      logger?.info("[dsh-plugin-omo] always mode set to " + mode + (targetSession === undefined ? "" : " for one session"))
      sendJson(response, 200, { mode })
    } catch (error) {
      sendJson(response, 400, { error: error instanceof Error ? error.message : String(error) })
    }
  }
}
