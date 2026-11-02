// Read-aloud: the server voice (Workers AI / Deepgram Aura-2 English) when it's there,
// otherwise the browser's own English voice. Young kids hear every step instead of reading it.
//
// Reliability fixes carried over from the articulation app:
// - Chrome's speechSynthesis can get stuck: speak() right after cancel() is dropped, or onend
//   never fires. We keep a reference to the utterance, wait a beat after cancel(), and time out.
// - One <audio> element is reused, and every playback promise settles (ended, paused, error or
//   timeout), so a failed clip can never block the game.

import { settings } from "./store.js";
import { health, serverTts } from "./api.js";

const cache = new Map(); // `${voice}|${text}` → Promise<object URL>
const player = typeof Audio !== "undefined" ? new Audio() : null;
let playId = 0;
let utterance; // Chrome drops events for garbage-collected utterances

export function browserVoices() {
  if (typeof speechSynthesis === "undefined") return [];
  return speechSynthesis.getVoices().filter((v) => v.lang?.toLowerCase().startsWith("en"));
}

function pickVoice() {
  const voices = browserVoices();
  return voices.find((v) => v.name === settings().browserVoice)
    ?? voices.find((v) => /en[-_]US/i.test(v.lang) && /natural|neural|enhanced|premium|google|samantha/i.test(v.name))
    ?? voices.find((v) => /en[-_]US/i.test(v.lang)) ?? voices[0] ?? null;
}

// When the Cloudflare voice fails (for example the free daily allowance is used up), use the
// device voice for a while instead of trying (and waiting for) the server before every sentence.
const RETRY_SERVER_MS = 10 * 60 * 1000;
let serverFailedAt = 0;

async function useServer() {
  const src = settings().ttsSource;
  if (src === "browser") return false;
  if (Date.now() - serverFailedAt < RETRY_SERVER_MS) return false;
  if (src === "server") return true;
  return !!(await health()).tts;
}

function serverUrl(text, voice) {
  const key = `${voice}|${text}`;
  if (!cache.has(key)) {
    const p = serverTts(text, voice).then((blob) => URL.createObjectURL(blob));
    p.catch(() => cache.delete(key));
    cache.set(key, p);
  }
  return cache.get(key);
}

/**
 * Fetch clips in the background so common words play instantly (the first tap on a number
 * otherwise waits for the voice server). Quietly gives up if the server isn't answering.
 */
export function preload(texts) {
  if (!player || typeof fetch === "undefined") return;
  const queue = [...new Set(texts)];
  let failures = 0;
  const worker = async () => {
    while (queue.length && failures < 3) {
      const text = queue.shift();
      if (!settings().readAloud || !(await useServer())) return;
      try { await serverUrl(text, settings().voice); } catch { failures++; }
    }
  };
  setTimeout(() => { for (let i = 0; i < 3; i++) worker(); }, 1500);
}

export function stop() {
  playId++;
  if (player && !player.paused) player.pause();
  if (typeof speechSynthesis !== "undefined" && (speechSynthesis.speaking || speechSynthesis.pending)) speechSynthesis.cancel();
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function playThrough(url, rate) {
  return new Promise((resolve, reject) => {
    const done = () => { player.onended = player.onpause = player.onerror = null; clearTimeout(timer); resolve(); };
    player.onended = player.onpause = done;
    player.onerror = () => { done(); reject(new Error("Audio could not be played.")); };
    const timer = setTimeout(done, 20000);
    player.src = url;
    player.preservesPitch = true;
    player.playbackRate = rate;
    player.play().catch((e) => { done(); reject(e); });
  });
}

async function speakBrowser(text, rate, id) {
  if (typeof speechSynthesis === "undefined") return;
  const synth = speechSynthesis;
  if (synth.speaking || synth.pending) { synth.cancel(); await sleep(80); }
  if (id !== playId) return;
  synth.resume();
  await new Promise((resolve) => {
    const u = new SpeechSynthesisUtterance(text);
    utterance = u;
    const v = pickVoice();
    if (v) u.voice = v;
    u.lang = v?.lang ?? "en-US";
    u.rate = rate;
    u.pitch = 1.1;
    let started = false;
    const finish = () => { clearTimeout(t1); clearTimeout(t2); resolve(); };
    u.onstart = () => { started = true; };
    u.onend = u.onerror = finish;
    const t1 = setTimeout(() => !started && finish(), 1500);
    const t2 = setTimeout(finish, 2500 + text.length * 110 / rate);
    synth.speak(u);
  });
}

/** Say text aloud (if read-aloud is on, or force). Resolves when it's done. Never throws. */
export async function speak(text, { force = false } = {}) {
  if (!text || (!settings().readAloud && !force)) return;
  stop();
  const id = playId;
  const rate = settings().slow ? 0.8 : 1;
  try {
    if (player && (await useServer())) {
      try {
        const url = await serverUrl(text, settings().voice);
        if (id !== playId) return;
        return await playThrough(url, rate);
      } catch (e) {
        if (!/play/i.test(String(e?.message))) serverFailedAt = Date.now();
        if (id !== playId) return;
        console.warn("Server voice failed, using the device voice", e);
      }
    }
    await speakBrowser(text, rate * 0.95, id);
  } catch (e) { console.warn(e); }
}

if (typeof speechSynthesis !== "undefined") speechSynthesis.getVoices();
