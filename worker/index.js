// Cloudflare Worker: serves the static app (public/) and a small API for the read-aloud voice.
// Same shape in every app built from the template.
//
//   GET /api/health                  → { tts, backend, voices }
//   GET /api/tts?text=…&voice=thalia → audio/mpeg
//
// Where the voice comes from, in order (each clip is cached at the edge, so it's made once):
//   1. Your own voice server (e.g. Kokoro on a Mac), if TTS_ORIGIN is set. Free and unlimited.
//      It must speak the OpenAI-style API:  POST {TTS_ORIGIN}/v1/audio/speech
//      { model, input, voice, response_format: "mp3" } → audio/mpeg   (Kokoro-FastAPI does this)
//   2. Workers AI, Deepgram Aura-2 (free daily allowance, then $0.03 per 1,000 characters).
//   3. If both fail, the API returns an error and the app uses the device's own voice.
//
// Settings (all optional; set with `npx wrangler secret put NAME`):
//   TTS_ORIGIN       https://voice.example.com   (no trailing slash)
//   TTS_VOICE        the voice on your server, default "af_heart"
//   TTS_MODEL        default "kokoro"
//   TTS_TOKEN        sent as "Authorization: Bearer …" to your server
//   TTS_ACCESS_ID / TTS_ACCESS_SECRET   Cloudflare Access service token for your server
//   APP_PASSCODE     when set, API calls need header x-app-passcode

const AURA_MODEL = "@cf/deepgram/aura-2-en";
// Bright, clear Aura-2 English voices that suit young kids; the default first.
const TTS_VOICE_LIST = ["thalia", "helena", "luna", "asteria", "aurora", "iris", "cora", "delia", "harmonia", "apollo", "arcas", "orion"];
const TTS_VOICES = new Set(TTS_VOICE_LIST);
const MAX_TEXT = 300;
const ORIGIN_TIMEOUT_MS = 8000; // a sleeping Mac shouldn't keep a child waiting

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
          return json({
            tts: !!(env.AI || env.TTS_ORIGIN),
            backend: env.TTS_ORIGIN ? "Your voice server, then Cloudflare Workers AI" : "Cloudflare Workers AI",
            voices: TTS_VOICE_LIST,
          });
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
  const voice = TTS_VOICES.has(url.searchParams.get("voice")) ? url.searchParams.get("voice") : TTS_VOICE_LIST[0];
  const cache = caches.default;

  // 1. Your own voice server.
  if (env.TTS_ORIGIN) {
    const own = env.TTS_VOICE || "af_heart";
    const key = new Request(`https://tts.cache/own/${encodeURIComponent(own)}/${encodeURIComponent(text)}`);
    const hit = await cache.match(key);
    if (hit) return hit;
    try {
      const audio = await fromOrigin(text, own, env);
      const res = audioResponse(audio, "own");
      ctx.waitUntil(cache.put(key, res.clone()));
      return res;
    } catch (e) {
      console.warn("voice server unavailable, using Workers AI:", String(e?.message ?? e));
    }
  }

  // 2. Workers AI (Aura-2).
  if (!env.AI) return json({ error: "no voice available" }, 503);
  const key = new Request(`https://tts.cache/aura-2-en/${voice}/${encodeURIComponent(text)}`);
  const hit = await cache.match(key);
  if (hit) return hit;
  const raw = await env.AI.run(AURA_MODEL, { text, speaker: voice, encoding: "mp3" }, { returnRawResponse: true });
  if (!raw.ok) return json({ error: `tts failed (${raw.status})` }, 502);
  const res = audioResponse(raw.body, "aura");
  ctx.waitUntil(cache.put(key, res.clone()));
  return res;
}

async function fromOrigin(text, voice, env) {
  const headers = { "content-type": "application/json" };
  if (env.TTS_TOKEN) headers.authorization = `Bearer ${env.TTS_TOKEN}`;
  if (env.TTS_ACCESS_ID) {
    headers["CF-Access-Client-Id"] = env.TTS_ACCESS_ID;
    headers["CF-Access-Client-Secret"] = env.TTS_ACCESS_SECRET ?? "";
  }
  const r = await fetch(`${env.TTS_ORIGIN.replace(/\/+$/, "")}/v1/audio/speech`, {
    method: "POST",
    headers,
    body: JSON.stringify({ model: env.TTS_MODEL || "kokoro", input: text, voice, response_format: "mp3", speed: 1 }),
    signal: AbortSignal.timeout(ORIGIN_TIMEOUT_MS),
  });
  const type = r.headers.get("content-type") ?? "";
  if (!r.ok || !/audio|octet-stream/.test(type)) throw new Error(`voice server answered ${r.status} ${type}`);
  const buf = await r.arrayBuffer();
  if (buf.byteLength < 500) throw new Error("voice server sent an empty clip");
  return buf;
}

const audioResponse = (body, source) => new Response(body, {
  headers: { "content-type": "audio/mpeg", "cache-control": "public, max-age=2592000", "x-voice-source": source },
});

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
