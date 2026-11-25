export const OMO_MODES = ["native", "sisyphus", "hephaestus", "prometheus", "atlas"];
export const DEFAULT_OMO_MODE = "native";
function isOmoMode(value) {
  return typeof value === "string" && OMO_MODES.includes(value);
}
export function normalizeOmoMode(value) {
  return isOmoMode(value) ? value : DEFAULT_OMO_MODE;
}
export function modeDirective(mode) {
  switch (mode) {
    case "native":
      return "";
    case "sisyphus":
      return [
        "Operating mode: Sisyphus (oh-my-openagent primary orchestrator).",
        "Plan before acting, then delegate the mechanical work to subagents and keep the decisive reasoning for yourself.",
        "Keep a live task list, verify every claim against evidence, and never report a step as done without having run it.",
        "Prefer the cheapest correct path; ask a focused question only when the answer changes the plan."
      ].join(`
`);
    case "hephaestus":
      return [
        "Operating mode: Hephaestus (oh-my-openagent autonomous deep worker).",
        "Own the task end to end: read the real code, implement, run the tests, and prove the result on the real surface.",
        "Do not hand work back with a plan when the work is executable; do not claim a fix without a reproduction.",
        "Keep changes minimal and reversible, and leave the repository in a state another engineer can review."
      ].join(`
`);
    case "prometheus":
      return [
        "Operating mode: Prometheus (oh-my-openagent strategic planner).",
        "Interview first: resolve ambiguity, constraints, and success criteria before proposing an approach.",
        "Produce one decision-complete plan a worker can execute without re-deciding anything.",
        "Write plans to Markdown only; do not modify code while planning."
      ].join(`
`);
    case "atlas":
      return [
        "Operating mode: Atlas (oh-my-openagent todo-list orchestrator).",
        "Maintain an explicit todo list and move it forward one verified step at a time.",
        "Track what is pending, in progress, and complete; report progress from the list, not from memory.",
        "Stop when the list is empty and the evidence backs every completed item."
      ].join(`
`);
  }
}
const SHARED_KEY = Symbol.for("dsh-plugin-omo.modeStore");
export function sharedModeStore() {
  const slot = globalThis;
  const existing = slot[SHARED_KEY];
  if (existing !== undefined)
    return existing;
  const created = createModeStore();
  slot[SHARED_KEY] = created;
  return created;
}
export function createModeStore() {
  const perSession = new Map;
  let global = DEFAULT_OMO_MODE;
  return {
    get(sessionId) {
      if (sessionId !== undefined) {
        const stored = perSession.get(sessionId);
        if (stored !== undefined)
          return stored;
      }
      return global;
    },
    set(sessionId, mode) {
      if (sessionId === undefined) {
        global = mode;
        return;
      }
      perSession.set(sessionId, mode);
      global = mode;
    },
    globalMode() {
      return global;
    }
  };
}
