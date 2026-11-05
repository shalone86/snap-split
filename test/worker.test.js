// The Worker's voice tiers: Aura-2 for single words, MeloTTS for sentences, with edge caching.
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
const b64 = () => btoa(String.fromCharCode(...mp3()));
// A fake Workers AI: Aura-2 answers a raw response, MeloTTS answers { audio: base64 }.
const ai = ({ auraStatus = 200, melo = "ok" } = {}) => ({
  calls: [],
  async run(model, input, opts) {
    this.calls.push({ model, input, opts });
    if (model.includes("melotts")) {
      if (melo === "fail") throw new Error("melo down");
      return { audio: b64() };
    }
    return new Response(auraStatus === 200 ? mp3() : "x", { status: auraStatus });
  },
});

test("single words and numbers use Aura-2 with the chosen voice", async () => {
  const AI = ai();
  for (const text of ["seventeen", "twenty%20one"]) {
    const r = await call({ AI }, `/api/tts?text=${text}&voice=luna`);
    assert.equal(r.headers.get("x-voice-source"), "aura");
  }
  assert.deepEqual(AI.calls.map((c) => c.model), ["@cf/deepgram/aura-2-en", "@cf/deepgram/aura-2-en"]);
  assert.equal(AI.calls[0].input.speaker, "luna");
  assert.equal(AI.calls[0].input.container, "wav");
});

test("sentences use MeloTTS, and different voices share one cached clip", async () => {
  const AI = ai();
  const r = await call({ AI }, "/api/tts?text=The%20dog%20runs%20fast&voice=luna");
  assert.equal(r.headers.get("x-voice-source"), "melo");
  assert.equal((await r.arrayBuffer()).byteLength, 2000);
  assert.equal(r.headers.get("content-type"), "audio/mpeg");
  assert.deepEqual(AI.calls[0].input, { prompt: "The dog runs fast", lang: "en" });
  const again = await call({ AI }, "/api/tts?text=The%20dog%20runs%20fast&voice=orion");
  assert.equal(again.headers.get("x-voice-source"), "melo");
  assert.equal(AI.calls.length, 1, "second time comes from the cache");
});

test("a sentence falls back to Aura-2 if MeloTTS fails", async () => {
  const AI = ai({ melo: "fail" });
  const r = await call({ AI }, "/api/tts?text=The%20dog%20runs%20fast");
  assert.equal(r.headers.get("x-voice-source"), "aura");
  assert.equal(AI.calls.length, 2);
});

test("errors let the app use the device voice; health reports the voice", async () => {
  const limited = await call({ AI: ai({ auraStatus: 429 }) }, "/api/tts?text=Hello");
  assert.equal(limited.status, 502);
  assert.equal((await call({}, "/api/tts?text=Hello")).status, 503);
  const health = await (await call({ AI: ai() }, "/api/health")).json();
  assert.equal(health.tts, true);
  assert.equal(health.backend, "Cloudflare Workers AI");
  assert.equal((await call({}, "/api/tts")).status, 400);
});

test("WAV clips from MeloTTS are labeled audio/wav", async () => {
  const wav = new Uint8Array(2000); wav.set([0x52, 0x49, 0x46, 0x46]);
  const AI = { async run() { return { audio: btoa(String.fromCharCode(...wav)) }; } };
  const r = await call({ AI }, "/api/tts?text=Tap%20each%20block%20please");
  assert.equal(r.headers.get("content-type"), "audio/wav");
});
