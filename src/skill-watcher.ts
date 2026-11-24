/**
 * Directory watcher for the configured skill roots.
 *
 * The registry caches a completed catalog per provider, so a skill added or
 * removed at runtime is invisible until the provider invalidates that cache.
 * Bodies need no watcher: get() rereads the document every time.
 */
import { existsSync, watch } from "node:fs"
import type { HostLogger } from "./host.ts"

export interface RootWatchHandle {
  close: () => void
}

export type RootWatchFactory = (root: string, onChange: () => void) => RootWatchHandle

export interface RootWatcherOptions {
  readonly roots: readonly string[]
  /** Swappable for tests; defaults to fs.watch on the directory itself. */
  readonly watchFactory?: RootWatchFactory
  readonly logger?: HostLogger
}

export interface RootWatcher {
  /** Begin watching and report catalog changes to this invalidator. */
  readonly start: (invalidate: () => void) => void
  /** Close every watcher this instance opened. */
  readonly stop: () => void
}

const defaultWatchFactory: RootWatchFactory = (root, onChange) => watch(root, { persistent: false }, () => onChange())

/** Watch the roots (not their contents): entry additions and removals invalidate the catalog. */
export function createRootWatcher(options: RootWatcherOptions): RootWatcher {
  const factory = options.watchFactory ?? defaultWatchFactory
  const handles: RootWatchHandle[] = []
  let started = false

  return {
    start(invalidate: () => void): void {
      if (started) return
      started = true
      for (const root of options.roots) {
        if (!existsSync(root)) continue
        try {
          handles.push(factory(root, invalidate))
        } catch (error) {
          options.logger?.warn("[dsh-plugin-omo] could not watch " + root + ": " + String(error))
        }
      }
    },
    stop(): void {
      for (const handle of handles.splice(0)) {
        try {
          handle.close()
        } catch {
          // A closed watcher has nothing left to release.
        }
      }
      started = false
    },
  }
}
