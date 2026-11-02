// The Worker's voice chain: your server first, then Workers AI, with edge caching.
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import worker from "../worker/index.js";

let store;
beforeEach(() => {
  store = new Map();
  globalThis.caches = {
    default: {
      match: async (req) => store.get(req.url)?.clone(),
      put: async (req, res) => { store.set(req.url, res); },
    },
  };
});

const ctx = { waits: [], waitUntil(p) { this.waits.push(p); } };
const call = async (env, path) => {
  const res = await worker.fetch(new Request(`https://app.test${path}`), env, ctx);
  await Promise.all(ctx.waits.splice(0));
  return res;
};
const mp3 = () => new Uint8Array(2000).fill(7);
const aura = (status = 200) => ({ calls: 0, async run() { this.calls++; return new Response(status === 200 ? mp3() : "x", { status }); } });

test("uses your voice server first, and caches the clip", async () => {
  const seen = [];
  globalThis.fetch = async (url, init) => { seen.push([url, JSON.parse(init.body), init.headers]); return new Response(mp3(), { headers: { "content-type": "audio/mpeg" } }); };
  const AI = aura();
  const env = { AI, TTS_ORIGIN: "https://voice.test/", TTS_TOKEN: "tok" };
  const r1 = await call(env, "/api/tts?text=Hello&voice=thalia");
  assert.equal(r1.headers.get("x-voice-source"), "own");
  assert.equal(seen[0][0], "https://voice.test/v1/audio/speech");
  assert.deepEqual(seen[0][1], { model: "kokoro", input: "Hello", voice: "af_heart", response_format: "mp3", speed: 1 });
  assert.equal(seen[0][2].authorization, "Bearer tok");
  await call(env, "/api/tts?text=Hello&voice=thalia");
  assert.equal(seen.length, 1, "second time comes from the cache");
  assert.equal(AI.calls, 0);
});

test("falls back to Workers AI when your server is down or sends junk", async () => {
  for (const bad of [() => { throw new Error("offline"); }, () => new Response("<html>", { headers: { "content-type": "text/html" } })]) {
    store.clear();
    globalThis.fetch = async () => bad();
    const AI = aura();
    const r = await call({ AI, TTS_ORIGIN: "https://voice.test" }, "/api/tts?text=Hi");
    assert.equal(r.headers.get("x-voice-source"), "aura");
    assert.equal(AI.calls, 1);
  }
});

test("without a voice server it works as before; errors let the app use the device voice", async () => {
  const r = await call({ AI: aura() }, "/api/tts?text=Hi");
  assert.equal(r.headers.get("x-voice-source"), "aura");
  const limited = await call({ AI: aura(429) }, "/api/tts?text=Hello%20again");
  assert.equal(limited.status, 502);
  const health = await (await call({ TTS_ORIGIN: "https://voice.test" }, "/api/health")).json();
  assert.equal(health.tts, true);
});
