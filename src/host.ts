/**
 * The slice of the DeepSeek Harness host API this plugin depends on.
 *
 * These interfaces mirror the published DSH contracts (docs/subsystems/skills.md,
 * docs/subsystems/core.md). They are declared locally instead of imported because
 * the plugin ships zero dependencies and must load inside the harness runtime,
 * which resolves @deepseek-ai packages itself.
 */

/** Host logger surface; every method is optional in practice. */
export interface HostLogger {
  readonly info: (message: string) => void
  readonly warn: (message: string) => void
  readonly debug?: (message: string) => void
}

/** Lifecycle control for one provider registration. */
export interface HostProviderControl {
  /** Aborts when the registration fails or the exact registration is disposed. */
  readonly signal: AbortSignal
  /** Drops completed provider catalogs while this registration stays active. */
  readonly invalidate: () => void
}

/** Invocation controls every resolved skill carries. */
export interface HostInvocationPolicy {
  readonly modelInvocable: boolean
  readonly userInvocable: boolean
}

/** Provider base for relative skill resources. */
export type HostResourceBase =
  | { readonly kind: "directory"; readonly path: string }
  | { readonly kind: "url"; readonly url: string }
  | { readonly kind: "opaque"; readonly description: string }

/** Invocation-neutral skill metadata. */
export interface HostSkillSummary {
  readonly path?: string
  readonly name: string
  readonly description: string
  readonly whenToUse?: string
  readonly invocation: HostInvocationPolicy
  readonly source: string
  readonly provider: string
  readonly resourceBase?: HostResourceBase
}

/** Provider catalog entry; locator is provider-owned and opaque to the registry. */
export interface HostSkillCandidate extends HostSkillSummary {
  readonly rank: number
  readonly locator: unknown
  readonly metadata?: Readonly<Record<string, unknown>>
}

/** Complete skill body returned by provider get(). */
export interface HostSkillDefinition extends HostSkillSummary {
  readonly content: string
  readonly metadata?: Readonly<Record<string, unknown>>
}

/** Lookup options the registry borrows from the caller. */
export interface HostSkillLookupOptions {
  readonly cwd?: string | undefined
  readonly signal?: AbortSignal | undefined
}

/** Candidates that remain loadable while discovery reports itself as incomplete. */
export interface HostSkillProviderObservation {
  readonly candidates: readonly HostSkillCandidate[]
  readonly complete: boolean
}

/** One source of skills. */
export interface HostSkillProvider {
  readonly name: string
  readonly list: (
    options: HostSkillLookupOptions,
  ) => Promise<readonly HostSkillCandidate[] | HostSkillProviderObservation>
  readonly get: (
    candidate: HostSkillCandidate,
    options: HostSkillLookupOptions,
  ) => Promise<HostSkillDefinition | undefined>
}

/** Skill registry service. */
export interface HostSkillRegistry {
  readonly registerProvider: (create: (control: HostProviderControl) => HostSkillProvider) => () => void
}

/** One web server route the plugin may register. */
export interface HostRoute {
  readonly kind: "exact" | "prefix"
  readonly path: string
  readonly handler: (request: never, response: never) => void | Promise<void>
}

/** HTTP carrier for same-origin client calls. */
export interface HostWebServer {
  readonly register: (route: HostRoute) => () => void
}

/** One contributed system prompt section. */
export interface HostPromptSection {
  readonly name: string
  readonly order: number
  readonly text: string | ((context: unknown) => string)
  readonly interpolate?: boolean
}

/** Prompt assembly service, available in some compositions only. */
export interface HostSystemPrompt {
  readonly section: (section: HostPromptSection) => () => void
}

/** The Cordis plugin context, narrowed to the services this plugin injects. */
export interface HostContext {
  readonly skills: HostSkillRegistry
  readonly logger?: HostLogger
  readonly effect?: (execute: () => () => void, label?: string) => unknown
  /** Optional: a headless composition may omit the web server. */
  readonly webServer?: HostWebServer
  /** Cordis service lookup for optional dependencies. */
  readonly get?: (name: string) => unknown
}
