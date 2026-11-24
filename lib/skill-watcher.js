import { existsSync, watch } from "node:fs";
const defaultWatchFactory = (root, onChange) => watch(root, { persistent: false }, () => onChange());
export function createRootWatcher(options) {
  const factory = options.watchFactory ?? defaultWatchFactory;
  const handles = [];
  let started = false;
  return {
    start(invalidate) {
      if (started)
        return;
      started = true;
      for (const root of options.roots) {
        if (!existsSync(root))
          continue;
        try {
          handles.push(factory(root, invalidate));
        } catch (error) {
          options.logger?.warn("[dsh-plugin-omo] could not watch " + root + ": " + String(error));
        }
      }
    },
    stop() {
      for (const handle of handles.splice(0)) {
        try {
          handle.close();
        } catch {}
      }
      started = false;
    }
  };
}
