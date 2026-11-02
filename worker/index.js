// Cloudflare Worker: serves the static game (public/) and a small API for the read-aloud voice.
// Same shape in every app built from the template.
//
//   GET /api/health                 → { tts, backend, voices }
//   GET /api/tts?text=…&voice=thalia → audio/mpeg (Deepgram Aura-2 English on Workers AI)
//
// The app itself needs no server: without the AI binding it falls back to the device's voice.
// Optional secret APP_PASSCODE: when set, API calls need header x-app-passcode.

const TTS_MODEL = "@cf/deepgram/aura-2-en";
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
  if (!env.AI) return json({ error: "no AI binding" }, 503);
  const text = (url.searchParams.get("text") ?? "").trim().slice(0, MAX_TEXT);
  if (!text) return json({ error: "missing text" }, 400);
  const voice = TTS_VOICES.has(url.searchParams.get("voice")) ? url.searchParams.get("voice") : TTS_VOICE_LIST[0];

  // Same text + voice → same audio, so cache it at the edge. The game repeats the same
  // sentences a lot ("Push the ones together!"), so most clips come from the cache.
  const cacheKey = new Request(`https://tts.cache/aura-2-en/${voice}/${encodeURIComponent(text)}`);
  const cache = caches.default;
  const hit = await cache.match(cacheKey);
  if (hit) return hit;

  const raw = await env.AI.run(TTS_MODEL, { text, speaker: voice, encoding: "mp3" }, { returnRawResponse: true });
  if (!raw.ok) return json({ error: `tts failed (${raw.status})` }, 502);
  const res = new Response(raw.body, {
    headers: { "content-type": "audio/mpeg", "cache-control": "public, max-age=2592000" },
  });
  ctx.waitUntil(cache.put(cacheKey, res.clone()));
  return res;
}

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
