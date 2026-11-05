// Talks to the Cloudflare Worker (only used for the read-aloud voice; the game itself is offline).

import { settings } from "./store.js";

const headers = () => (settings().passcode ? { "x-app-passcode": settings().passcode } : {});

let healthCache;
/** { tts: bool, voices: string[] }. Never throws. */
export async function health(force = false) {
  if (healthCache && !force) return healthCache;
  try {
    const r = await fetch("api/health", { headers: headers() });
    healthCache = r.ok ? await r.json() : { tts: false, error: `HTTP ${r.status}` };
  } catch {
    healthCache = { tts: false, error: "No backend reachable (static hosting?)" };
  }
  return healthCache;
}

/** Fetch server TTS audio as a Blob (or throw). */
export async function serverTts(text, voice) {
  // Audio is cached for a month; bump v when the server's voice output changes.
  const q = new URLSearchParams({ text, voice: voice || "", v: "2" });
  const r = await fetch(`api/tts?${q}`, { headers: headers() });
  if (!r.ok) throw new Error(`TTS ${r.status}`);
  return r.blob();
}
