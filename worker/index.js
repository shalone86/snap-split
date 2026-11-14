// Cloudflare Worker: serves the static app (public/) and a small API for the read-aloud voice.
// Same shape in every app built from the template.
//
//   GET /api/health                  → { tts, backend, voices }
//   GET /api/tts?text=…&voice=thalia → audio/wav
//
// Everything runs on Cloudflare Workers AI with Deepgram Aura-2 (the nicer voice), sent as WAV so
// Safari plays even single numbers. Each clip is cached at the edge, so it's made once.
// If it fails, the API returns an error and the
// app uses the device's own voice.
//
// Settings (optional; set with `npx wrangler secret put NAME`):
//   APP_PASSCODE     when set, API calls need header x-app-passcode

const WORD_MODEL = "@cf/deepgram/aura-2-en";
// Bright, clear Aura-2 English voices that suit young kids; the default (helena) first.
const TTS_VOICE_LIST = ["helena", "thalia", "luna", "asteria", "aurora", "iris", "cora", "delia", "harmonia", "apollo", "arcas", "orion"];
const TTS_VOICES = new Set(TTS_VOICE_LIST);
const MAX_TEXT = 300;

import { movedResponse } from "./moved.js";
import { dailyCap } from "./codes.js";
import { louder } from "./loud.js";

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    // Old address (e.g. …shalonely.com): carry progress over to the new one.
    const moved = movedResponse(url, env);
    if (moved) return moved;
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


async function tts(url, env, ctx) {
  const text = (url.searchParams.get("text") ?? "").trim().slice(0, MAX_TEXT);
  if (!text) return json({ error: "missing text" }, 400);
  if (!env.AI) return json({ error: "no voice available" }, 503);
  const voice = TTS_VOICES.has(url.searchParams.get("voice")) ? url.searchParams.get("voice") : TTS_VOICE_LIST[0];
  // Everything uses Aura-2 (the nicer voice), as 24 kHz WAV: Safari won't reliably play its
  // very short mp3 clips (single numbers).
  const cache = caches.default;
  const key = new Request(`https://tts.cache/v4/aura/${voice}/${encodeURIComponent(text)}`);
  const hit = await cache.match(key);
  if (hit) return hit;
  const store = await savedClip(env, "v4", voice, text);
  const saved = await store.get();
  if (saved) {
    const res = new Response(saved, { headers: { "content-type": "audio/wav", "cache-control": "public, max-age=2592000", "x-voice-source": "saved" } });
    ctx.waitUntil(cache.put(key, res.clone()));
    return res;
  }
  // Site-wide safety caps on NEW clips a day, shared by all apps (saved clips are free): a number of clips,
  // and a number of characters, which is what the voice costs ($0.03 per 1,000 characters; about the first
  // 3,600 a day are free). Past either one, the apps use the device's own voice until midnight UTC.
  const cap = await dailyCap(env, "tts", Number(env.TTS_DAILY_CAP ?? 3000));
  const chars = await dailyCap(env, "ttschars", Number(env.TTS_DAILY_CHARS ?? 15000));
  if (!cap.ok || !chars.ok) return json({ error: "voice is resting for today" }, 503);
  const raw = await env.AI.run(WORD_MODEL, { text, speaker: voice, encoding: "linear16", container: "wav", sample_rate: 24000 }, { returnRawResponse: true });
  if (!raw.ok) return json({ error: `tts failed (${raw.status})` }, 502);
  const wav = louder(await raw.arrayBuffer()); // steady, louder level for every voice
  const res = new Response(wav, {
    headers: { "content-type": "audio/wav", "cache-control": "public, max-age=2592000", "x-voice-source": "aura" },
  });
  ctx.waitUntil(Promise.all([cache.put(key, res.clone()), store.put(wav), cap.charge(), chars.charge(text.length)]));
  return res;
}




// Every new clip is also saved in the shared KV store, so a line is made (and paid for) once, for every
// app and every Cloudflare data center. The edge cache is only per data center, and it can forget.
async function savedClip(env, prefix, voice, text) {
  if (!env.CODES) return { get: async () => null, put: async () => {} };
  const h = [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${voice}|${text}`)))]
    .map((b) => b.toString(16).padStart(2, "0")).join("");
  const k = `tts:${prefix}:${h}`;
  return { get: () => env.CODES.get(k, "arrayBuffer"), put: (buf) => env.CODES.put(k, buf) };
}

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
