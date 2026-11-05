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
// Bright, clear Aura-2 English voices that suit young kids; the default first.
const TTS_VOICE_LIST = ["thalia", "helena", "luna", "asteria", "aurora", "iris", "cora", "delia", "harmonia", "apollo", "arcas", "orion"];
const TTS_VOICES = new Set(TTS_VOICE_LIST);
const MAX_TEXT = 300;

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


async function tts(url, env, ctx) {
  const text = (url.searchParams.get("text") ?? "").trim().slice(0, MAX_TEXT);
  if (!text) return json({ error: "missing text" }, 400);
  if (!env.AI) return json({ error: "no voice available" }, 503);
  const voice = TTS_VOICES.has(url.searchParams.get("voice")) ? url.searchParams.get("voice") : TTS_VOICE_LIST[0];
  // Everything uses Aura-2 (the nicer voice), as 24 kHz WAV: Safari won't reliably play its
  // very short mp3 clips (single numbers).
  const cache = caches.default;
  const key = new Request(`https://tts.cache/v3/aura/${voice}/${encodeURIComponent(text)}`);
  const hit = await cache.match(key);
  if (hit) return hit;
  const raw = await env.AI.run(WORD_MODEL, { text, speaker: voice, encoding: "linear16", container: "wav", sample_rate: 24000 }, { returnRawResponse: true });
  if (!raw.ok) return json({ error: `tts failed (${raw.status})` }, 502);
  const res = new Response(await raw.arrayBuffer(), {
    headers: { "content-type": "audio/wav", "cache-control": "public, max-age=2592000", "x-voice-source": "aura" },
  });
  ctx.waitUntil(cache.put(key, res.clone()));
  return res;
}




const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
