import assert from "node:assert/strict"
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { test } from "node:test"

import {
  apply,
  BUNDLED_SKILL_RANK,
  defaultSkillRoot,
  name,
  normalizeOmoConfig,
  parseSkillDocument,
  SkillDocumentError,
} from "../index.js"

function createContext() {
  const providers = []
  const warnings = []
  const ctx = {
    skills: {
      registerProvider(create) {
        providers.push(create({ signal: new AbortController().signal, invalidate() {} }))
        return () => undefined
      },
    },
    logger: { info() {}, warn: (message) => warnings.push(message) },
  }
  return { ctx, providers, warnings }
}

function temporaryRoot(prefix) {
  return mkdtempSync(join(tmpdir(), prefix))
}

test("registers one provider named omo in the skill registry", () => {
  const fake = createContext()
  const instance = apply(fake.ctx)
  assert.equal(name, "omo")
  assert.equal(instance.provider.name, "omo")
  assert.equal(fake.providers.length, 1)
  assert.ok(defaultSkillRoot().endsWith("skills"))
})

test("lists the bundled omo skills with the bundled rank", async () => {
  const { ctx } = createContext()
  const instance = apply(ctx)
  const candidates = await instance.provider.list({})
  assert.equal(candidates.length, 18)
  assert.deepEqual(
    candidates.map((candidate) => candidate.name).sort(),
    [
      "ast-grep",
      "coding-agent-sessions",
      "data-scientist",
      "debugging",
      "eval-integrity",
      "frontend",
      "git-master",
      "init-deep",
      "lsp-setup",
      "programming",
      "refactor",
      "remove-ai-slops",
      "review-work",
      "ultimate-browsing",
      "ulw-execute",
      "ulw-plan",
      "ulw-research",
      "visual-qa",
    ],
  )
  for (const candidate of candidates) {
    assert.equal(candidate.rank, BUNDLED_SKILL_RANK)
    assert.equal(candidate.provider, "omo")
    assert.equal(candidate.invocation.modelInvocable, true)
    assert.equal(candidate.invocation.userInvocable, true)
  }
})

test("loads a skill body and points resourceBase at the skill directory", async () => {
  const { ctx } = createContext()
  const instance = apply(ctx)
  const candidates = await instance.provider.list({})
  const plan = candidates.find((candidate) => candidate.name === "ulw-plan")
  assert.ok(plan)
  const definition = await instance.provider.get(plan, {})
  assert.ok(definition)
  assert.ok(definition.content.length > 1000)
  assert.equal(definition.content.startsWith("#"), true)
  assert.equal(definition.resourceBase.kind, "directory")
  assert.ok(definition.resourceBase.path.endsWith(join("skills", "ulw-plan")))
})

test("hides disabled skills from the catalog and from get", async () => {
  const { ctx } = createContext()
  const instance = apply(ctx, { disabled: ["ultimate-browsing", "visual-qa"] })
  const candidates = await instance.provider.list({})
  assert.equal(candidates.length, 16)
  assert.equal(candidates.some((candidate) => candidate.name === "ultimate-browsing"), false)
  assert.equal(await instance.provider.get({ name: "ultimate-browsing", locator: {} }, {}), undefined)
})

test("reads a custom skill root and its invocation policy", async () => {
  const root = temporaryRoot("dsh-plugin-omo-test-")
  try {
    mkdirSync(join(root, "demo"), { recursive: true })
    writeFileSync(
      join(root, "demo", "SKILL.md"),
      "---\nname: demo\ndescription: A demo skill.\ndisable-model-invocation: true\n---\n\n# Demo\n",
    )
    const { ctx } = createContext()
    const instance = apply(ctx, { skillDir: root })
    const candidates = await instance.provider.list({})
    assert.equal(candidates.length, 1)
    assert.equal(candidates[0].invocation.modelInvocable, false)
    assert.equal(candidates[0].invocation.userInvocable, true)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test("does not ship a skill whose vendored runtime is absent", async () => {
  const manifest = JSON.parse(readFileSync(new URL("../skills/manifest.json", import.meta.url), "utf8"))
  assert.equal(manifest.skills.length, 18)
  assert.deepEqual(
    manifest.skipped.map((skip) => skip.name),
    ["browser"],
  )
  assert.match(manifest.skipped[0].reason, /runtime/)
  const { ctx } = createContext()
  const instance = apply(ctx)
  const candidates = await instance.provider.list({})
  assert.equal(candidates.some((candidate) => candidate.name === "browser"), false)
})

test("fails loudly on a malformed skill document and on invalid configuration", () => {
  assert.throws(() => parseSkillDocument("---\nname: Bad_Name\ndescription: x\n---\n", "probe"), SkillDocumentError)
  assert.throws(() => normalizeOmoConfig({ unknownKey: true }), /unknown keys/)
  assert.throws(() => normalizeOmoConfig({ providerName: "runtime" }), /reserved/)
  assert.throws(() => normalizeOmoConfig({ rank: -1 }), /non-negative integer/)
})
