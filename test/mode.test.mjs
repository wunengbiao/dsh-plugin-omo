import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { test } from "node:test"

import { MODE_ROUTE, OMO_MODES, modeDirective, sharedModeStore } from "../index.js"
import { apply as applyUi, inject as uiInject } from "../lib/ui.js"

function fakeResponse() {
  return {
    status: 0,
    body: "",
    writeHead(status) {
      this.status = status
    },
    end(body) {
      this.body = body ?? ""
    },
  }
}

function fakeRequest(method, url, body = "") {
  return {
    method,
    url,
    on(event, listener) {
      if (event === "data" && body !== "") queueMicrotask(() => listener(body))
      if (event === "end") queueMicrotask(() => listener())
    },
  }
}

test("native is the default and injects nothing", () => {
  const store = sharedModeStore()
  store.set(undefined, "native")
  assert.equal(store.get("unknown-session"), "native")
  assert.equal(modeDirective("native"), "")
  for (const mode of ["sisyphus", "hephaestus", "prometheus", "atlas"]) {
    assert.ok(modeDirective(mode).toLowerCase().includes(mode))
  }
})

test("the ui entry requires the web server and serves the mode route", async () => {
  assert.deepEqual(uiInject, ["webServer"])
  assert.throws(() => applyUi({ logger: { info() {}, warn() {} } }), /webServer/)

  const routes = []
  const instance = applyUi({
    webServer: {
      register(route) {
        routes.push(route)
        return () => undefined
      },
    },
    logger: { info() {}, warn() {} },
    effect: (execute) => execute(),
  })
  assert.equal(instance.route.path, MODE_ROUTE)
  assert.deepEqual(routes.map((route) => route.path), [MODE_ROUTE])

  const response = fakeResponse()
  await routes[0].handler(fakeRequest("POST", MODE_ROUTE, JSON.stringify({ sessionId: "s1", mode: "atlas" })), response)
  assert.equal(response.status, 200)
  assert.equal(sharedModeStore().get("s1"), "atlas")

  const read = fakeResponse()
  await routes[0].handler(fakeRequest("GET", MODE_ROUTE + "?sessionId=s1"), read)
  assert.equal(JSON.parse(read.body).mode, "atlas")
  assert.deepEqual(JSON.parse(read.body).modes, [...OMO_MODES])

  sharedModeStore().set("s1", "native")
})

test("the client bundle registers the composer slot and offers Native plus the four agents", () => {
  const source = readFileSync(new URL("../client.js", import.meta.url), "utf8")
  for (const marker of ["conversation.input.left", "Native", "Sisyphus", "Hephaestus", "Prometheus", "Atlas", MODE_ROUTE]) {
    assert.ok(source.includes(marker), "client bundle is missing " + marker)
  }
})
