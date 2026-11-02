// Settings and progress in this browser's localStorage. Nothing leaves the device.
// Call init(key, extraSettings) once, first thing in app.js.

const BASE_SETTINGS = {
  readAloud: true, // say every step out loud (for kids still learning to read)
  sounds: true, // sound effects
  ttsSource: "auto", // auto | server | browser
  voice: "thalia", // Workers AI (Deepgram Aura-2) English voice
  browserVoice: "",
  slow: false,
  passcode: "", // only if APP_PASSCODE is set on the Worker
};

let KEY = "app:v1";
let DEFAULTS = { settings: { ...BASE_SETTINGS }, levels: {}, stickers: [], solved: 0 };
let state = structuredClone(DEFAULTS);

export function init(key, extraSettings = {}) {
  KEY = key;
  DEFAULTS = { settings: { ...BASE_SETTINGS, ...extraSettings }, levels: {}, stickers: [], solved: 0 };
  state = load();
}

function load() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) ?? "null");
    if (s) return { ...structuredClone(DEFAULTS), ...s, settings: { ...DEFAULTS.settings, ...s.settings } };
  } catch { /* private mode or corrupted: start fresh */ }
  return structuredClone(DEFAULTS);
}
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* storage blocked */ }
}

export const settings = () => state.settings;
export function setSetting(k, v) { state.settings[k] = v; save(); }

export const progress = (id) => state.levels[id] ?? { plays: 0, done: 0, stars: 0 };
export const stickers = () => state.stickers;
export const solved = () => state.solved;
export function solvedOne() { state.solved++; save(); }

/** Record a finished level (keeps the best stars). Returns the sticker if one was earned. */
export function finishLevel(id, stars, sticker) {
  const p = (state.levels[id] ??= { plays: 0, done: 0, stars: 0 });
  const first = !p.done;
  p.plays++;
  p.done++;
  p.stars = Math.max(p.stars, stars);
  p.at = Date.now();
  let earned = null;
  if (sticker && (first || stars === 3)) { state.stickers.push(sticker); earned = sticker; }
  save();
  return earned;
}
export function resetProgress() { state.levels = {}; state.stickers = []; state.solved = 0; save(); }
