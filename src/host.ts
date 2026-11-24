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

/** One source of skills. */
export interface HostSkillProvider {
  readonly name: string
  readonly list: (options: HostSkillLookupOptions) => Promise<readonly HostSkillCandidate[]>
  readonly get: (
    candidate: HostSkillCandidate,
    options: HostSkillLookupOptions,
  ) => Promise<HostSkillDefinition | undefined>
}

/** Skill registry service. */
export interface HostSkillRegistry {
  readonly registerProvider: (create: (control: HostProviderControl) => HostSkillProvider) => () => void
}

/** The Cordis plugin context, narrowed to the services this plugin injects. */
export interface HostContext {
  readonly skills: HostSkillRegistry
  readonly logger?: HostLogger
  readonly effect?: (execute: () => () => void) => void
}
