#!/usr/bin/env bun
/**
 * Transpile src/*.ts into the committed runtime modules.
 *
 * The published package runs under plain Node inside the harness, so the
 * JavaScript is committed and installs run no build. This script is only for
 * maintainers: it strips types with Bun's transpiler, rewrites the TypeScript
 * import specifiers to .js, and rebuilds the root index.js entry.
 */
import { spawnSync } from "node:child_process"
import { readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const srcDir = join(root, "src")
const libDir = join(root, "lib")
const entries = readdirSync(srcDir)
  .filter((name) => name.endsWith(".ts"))
  .map((name) => join(srcDir, name))

rmSync(libDir, { recursive: true, force: true })
const build = spawnSync(
  "bun",
  ["build", "--no-bundle", "--target", "node", "--format", "esm", "--outdir", libDir, ...entries],
  { cwd: root, encoding: "utf8" },
)
if (build.status !== 0) {
  process.stderr.write(build.stderr ?? "")
  process.exit(build.status ?? 1)
}

const rewrite = (source) => source.replace(/from "(\.{1,2}\/[^"]+)\.ts"/g, 'from "$1.js"')

for (const name of readdirSync(libDir).filter((entry) => entry.endsWith(".js"))) {
  const path = join(libDir, name)
  writeFileSync(path, rewrite(readFileSync(path, "utf8")))
}

const entry = rewrite(readFileSync(join(libDir, "index.js"), "utf8")).replace(/from "\.\//g, 'from "./lib/')
writeFileSync(join(root, "index.js"), entry)
rmSync(join(libDir, "index.js"))
process.stdout.write("wrote index.js and " + readdirSync(libDir).length + " modules in lib/\n")
