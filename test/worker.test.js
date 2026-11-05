// The Worker's voice: Aura-2 for everything, as WAV, with edge caching.
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import worker from "../worker/index.js";

let store;
beforeEach(() => {
  store = new Map();
  globalThis.caches = { default: { match: async (r) => store.get(r.url)?.clone(), put: async (r, res) => { store.set(r.url, res); } } };
});
const ctx = { waits: [], waitUntil(p) { this.waits.push(p); } };
const call = async (env, path) => {
  const res = await worker.fetch(new Request(`https://app.test${path}`), env, ctx);
  await Promise.all(ctx.waits.splice(0));
  return res;
};
const ai = (status = 200) => ({ calls: [], async run(model, input) { this.calls.push({ model, input }); return new Response(status === 200 ? new Uint8Array(2000) : "x", { status }); } });

test("words and sentences both use Aura-2 as WAV, with the chosen voice, cached", async () => {
  const AI = ai();
  for (const t of ["seventeen", "Tap%20the%20ones%20to%20trade"]) {
    const r = await call({ AI }, `/api/tts?text=${t}&voice=luna`);
    assert.equal(r.headers.get("content-type"), "audio/wav");
    assert.equal(r.headers.get("x-voice-source"), "aura");
  }
  await call({ AI }, "/api/tts?text=seventeen&voice=luna");
  assert.equal(AI.calls.length, 2, "repeat comes from the cache");
  assert.ok(AI.calls.every((c) => c.model === "@cf/deepgram/aura-2-en" && c.input.speaker === "luna" && c.input.container === "wav"));
});

test("errors let the app use the device voice", async () => {
  assert.equal((await call({ AI: ai(429) }, "/api/tts?text=Hello")).status, 502);
  assert.equal((await call({}, "/api/tts?text=Hello")).status, 503);
  assert.equal((await call({ AI: ai() }, "/api/tts")).status, 400);
  assert.equal((await (await call({ AI: ai() }, "/api/health")).json()).tts, true);
});
