/**
 * The "always mode" selector: which omo agent persona a session runs under.
 *
 * The client dropdown writes here through the HTTP route, and the system prompt
 * section reads it for the assembling session. Native means no injection.
 */

/** Selectable modes; native is the explicit "none" choice. */
export const OMO_MODES = ["native", "sisyphus", "hephaestus", "prometheus", "atlas"] as const

export type OmoMode = (typeof OMO_MODES)[number]

export const DEFAULT_OMO_MODE: OmoMode = "native"

function isOmoMode(value: unknown): value is OmoMode {
  return typeof value === "string" && (OMO_MODES as readonly string[]).includes(value)
}

/** Normalize any input to a known mode, falling back to native. */
export function normalizeOmoMode(value: unknown): OmoMode {
  return isOmoMode(value) ? value : DEFAULT_OMO_MODE
}

/** Compact persona directive per mode. Empty for native, which injects nothing. */
export function modeDirective(mode: OmoMode): string {
  switch (mode) {
    case "native":
      return ""
    case "sisyphus":
      return [
        "Operating mode: Sisyphus (oh-my-openagent primary orchestrator).",
        "Plan before acting, then delegate the mechanical work to subagents and keep the decisive reasoning for yourself.",
        "Keep a live task list, verify every claim against evidence, and never report a step as done without having run it.",
        "Prefer the cheapest correct path; ask a focused question only when the answer changes the plan.",
      ].join("\n")
    case "hephaestus":
      return [
        "Operating mode: Hephaestus (oh-my-openagent autonomous deep worker).",
        "Own the task end to end: read the real code, implement, run the tests, and prove the result on the real surface.",
        "Do not hand work back with a plan when the work is executable; do not claim a fix without a reproduction.",
        "Keep changes minimal and reversible, and leave the repository in a state another engineer can review.",
      ].join("\n")
    case "prometheus":
      return [
        "Operating mode: Prometheus (oh-my-openagent strategic planner).",
        "Interview first: resolve ambiguity, constraints, and success criteria before proposing an approach.",
        "Produce one decision-complete plan a worker can execute without re-deciding anything.",
        "Write plans to Markdown only; do not modify code while planning.",
      ].join("\n")
    case "atlas":
      return [
        "Operating mode: Atlas (oh-my-openagent todo-list orchestrator).",
        "Maintain an explicit todo list and move it forward one verified step at a time.",
        "Track what is pending, in progress, and complete; report progress from the list, not from memory.",
        "Stop when the list is empty and the evidence backs every completed item.",
      ].join("\n")
  }
}

export interface ModeStore {
  /** Mode for one session, or the nearest fallback. */
  readonly get: (sessionId: string | undefined) => OmoMode
  /** Record a mode for one session (or globally when the session is unknown). */
  readonly set: (sessionId: string | undefined, mode: OmoMode) => void
  /** Current global fallback. */
  readonly globalMode: () => OmoMode
}

const SHARED_KEY = Symbol.for("dsh-plugin-omo.modeStore")

/**
 * One store per process. The skills entry and the ./ui entry are bundled separately, so a module
 * singleton would split in two; the symbol slot on globalThis is what keeps them in step.
 */
export function sharedModeStore(): ModeStore {
  const slot = globalThis as unknown as Record<symbol, ModeStore | undefined>
  const existing = slot[SHARED_KEY]
  if (existing !== undefined) return existing
  const created = createModeStore()
  slot[SHARED_KEY] = created
  return created
}

/** In-memory store; DSH sessions are process-local, and a restart starts at native. */
export function createModeStore(): ModeStore {
  const perSession = new Map<string, OmoMode>()
  let global: OmoMode = DEFAULT_OMO_MODE
  return {
    get(sessionId) {
      if (sessionId !== undefined) {
        const stored = perSession.get(sessionId)
        if (stored !== undefined) return stored
      }
      return global
    },
    set(sessionId, mode) {
      if (sessionId === undefined) {
        global = mode
        return
      }
      perSession.set(sessionId, mode)
      global = mode
    },
    globalMode() {
      return global
    },
  }
}
