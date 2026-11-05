// Cloudflare Worker: serves the static app (public/) and a small API for the read-aloud voice.
// Same shape in every app built from the template.
//
//   GET /api/health                  → { tts, backend, voices }
//   GET /api/tts?text=…&voice=thalia → audio/mpeg
//
// Everything runs on Cloudflare Workers AI, with two tiers (each clip is cached at the edge, so it's made once):
//   - Single words and numbers (one or two words, like "seventeen"): Deepgram Aura-2, the best tier.
//     Says isolated words correctly and clearly. $0.03 per 1,000 characters after the free daily allowance.
//   - Sentences (three or more words): MyShell MeloTTS, about 100 times cheaper.
//     It has one voice, so the `voice` setting only applies to words. If MeloTTS fails, Aura-2 covers it.
// If both fail (for example, the free daily allowance is used up), the API returns an error and the
// app uses the device's own voice.
//
// Settings (optional; set with `npx wrangler secret put NAME`):
//   APP_PASSCODE     when set, API calls need header x-app-passcode

const WORD_MODEL = "@cf/deepgram/aura-2-en";
const SENTENCE_MODEL = "@cf/myshell-ai/melotts";
// Bright, clear Aura-2 English voices that suit young kids; the default first.
const TTS_VOICE_LIST = ["thalia", "helena", "luna", "asteria", "aurora", "iris", "cora", "delia", "harmonia", "apollo", "arcas", "orion"];
const TTS_VOICES = new Set(TTS_VOICE_LIST);
const MAX_TEXT = 300;
const MAX_WORD_COUNT = 2; // up to this many words uses the word tier

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith("/api/")) return env.ASSETS.fetch(request);

    if (env.APP_PASSCODE && request.headers.get("x-app-passcode") !== env.APP_PASSCODE) {
      return json({ error: "passcode required" }, 401);
    }
    try {
      switch (`${request.method} ${url.pathname}`) {
        case "GET /api/health":
          return json({ tts: !!env.AI, backend: "Cloudflare Workers AI", voices: TTS_VOICE_LIST });
        case "GET /api/tts":
          return await tts(url, env, ctx);
        default:
          return json({ error: "not found" }, 404);
      }
    } catch (e) {
      console.error(e);
      return json({ error: String(e?.message ?? e) }, 500);
    }
  },
};

/** "seventeen" or "twenty one" → "word"; anything longer → "sentence". */
const tierFor = (text) => (text.split(/\s+/).length <= MAX_WORD_COUNT ? "word" : "sentence");

async function tts(url, env, ctx) {
  const text = (url.searchParams.get("text") ?? "").trim().slice(0, MAX_TEXT);
  if (!text) return json({ error: "missing text" }, 400);
  if (!env.AI) return json({ error: "no voice available" }, 503);
  const voice = TTS_VOICES.has(url.searchParams.get("voice")) ? url.searchParams.get("voice") : TTS_VOICE_LIST[0];
  const tier = tierFor(text);
  const cache = caches.default;
  // Sentences sound the same whatever voice is chosen, so they share one cache entry.
  const key = new Request(`https://tts.cache/${tier}/${tier === "word" ? voice : "melo"}/${encodeURIComponent(text)}`);
  const hit = await cache.match(key);
  if (hit) return hit;

  let res;
  if (tier === "sentence") {
    try {
      const bytes = await melotts(text, env);
      res = audioResponse(bytes, "melo", audioType(bytes));
    } catch (e) {
      console.warn("MeloTTS failed, using Aura-2:", String(e?.message ?? e));
    }
  }
  if (!res) {
    const raw = await env.AI.run(WORD_MODEL, { text, speaker: voice, encoding: "mp3" }, { returnRawResponse: true });
    if (!raw.ok) return json({ error: `tts failed (${raw.status})` }, 502);
    res = audioResponse(raw.body, "aura");
  }
  ctx.waitUntil(cache.put(key, res.clone()));
  return res;
}

// MeloTTS answers { audio: "<base64 mp3>" }, or the raw mp3 itself. Handle both.
async function melotts(text, env) {
  const out = await env.AI.run(SENTENCE_MODEL, { prompt: text, lang: "en" });
  let bytes;
  if (typeof out?.audio === "string") {
    bytes = Uint8Array.from(atob(out.audio), (c) => c.charCodeAt(0));
  } else if (out instanceof ReadableStream || out instanceof ArrayBuffer || ArrayBuffer.isView(out)) {
    bytes = new Uint8Array(await new Response(out).arrayBuffer());
  } else {
    throw new Error("unexpected MeloTTS output");
  }
  if (bytes.byteLength < 500) throw new Error("MeloTTS sent an empty clip");
  return bytes;
}

/** MeloTTS sends WAV ("RIFF…"), not mp3. Label each clip by its real format so Safari plays it. */
const audioType = (b) => (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 ? "audio/wav" : "audio/mpeg");

const audioResponse = (body, source, type = "audio/mpeg") => new Response(body, {
  headers: { "content-type": type, "cache-control": "public, max-age=2592000", "x-voice-source": source },
});

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
