// A short "logo sound" (under about a second) when someone arrives, like a little opening chime.
// Browsers only allow sound after the first tap or key press, so it plays on that first touch,
// once per visit (per browser tab), and never when sounds are switched off.
//
//   import { jingleOnce } from "./kit/jingle.js";
//   jingleOnce("fractions", () => S.settings().sounds);
//
// Each Angelio app has its own: the hub a halo shimmer, Fraction Feast four quick "slices", etc.
// Add yours to JINGLES (times in seconds from the start).

let ctx = null;
const audio = () => (ctx ??= new (window.AudioContext || window.webkitAudioContext)());

function tone(t, f, { dur = 0.25, type = "sine", vol = 0.12, to = null, attack = 0.008, vib = 0 } = {}) {
  const a = audio(), o = a.createOscillator(), g = a.createGain(), at = a.currentTime + 0.03 + t;
  o.type = type;
  o.frequency.setValueAtTime(f, at);
  if (to) o.frequency.exponentialRampToValueAtTime(to, at + dur);
  if (vib) {
    const l = a.createOscillator(), lg = a.createGain();
    l.frequency.value = 6; lg.gain.value = vib; l.connect(lg).connect(o.frequency); l.start(at); l.stop(at + dur + 0.05);
  }
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(vol, at + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  o.connect(g).connect(a.destination);
  o.start(at); o.stop(at + dur + 0.05);
}
function noise(t, { dur = 0.05, vol = 0.12, freq = 2500, q = 1.5 } = {}) {
  const a = audio(), at = a.currentTime + 0.03 + t;
  const buf = a.createBuffer(1, Math.ceil(a.sampleRate * dur), a.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
  const src = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain();
  src.buffer = buf; f.type = "bandpass"; f.frequency.value = freq; f.Q.value = q; g.gain.value = vol;
  src.connect(f).connect(g).connect(a.destination);
  src.start(at);
}
const bell = (t, f, vol = 0.1, dur = 0.9) => { tone(t, f, { dur, vol }); tone(t, f * 2.01, { dur: dur * 0.6, vol: vol * 0.3 }); };

export const JINGLES = {
  // Any app without its own: a simple three-note chime.
  default() { [784, 988, 1175].forEach((f, i) => tone(i * 0.09, f, { dur: 0.35, type: "triangle", vol: 0.08 })); },
  // Angelio hub: a soft halo shimmer, a rising major chord with a sparkle on top.
  angelio() {
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => { tone(i * 0.07, f, { dur: 1.1, vol: 0.07, attack: 0.04 }); tone(i * 0.07, f * 1.004, { dur: 1.1, vol: 0.04, attack: 0.04 }); });
    [2093, 2637, 3136].forEach((f, i) => tone(0.32 + i * 0.06, f, { dur: 0.5, vol: 0.025, type: "triangle" }));
  },
  // Regroup!: two blocks clack together, then a bright ding.
  regroup() { noise(0, { freq: 900, vol: 0.2 }); noise(0.11, { freq: 1300, vol: 0.2 }); bell(0.24, 1567.98, 0.09, 0.7); },
  // Snap & Split: a snap and a quick pop upward.
  snap() { noise(0, { dur: 0.03, freq: 3500, vol: 0.25 }); tone(0.06, 400, { to: 950, dur: 0.16, type: "triangle", vol: 0.1 }); tone(0.24, 1318.5, { dur: 0.35, vol: 0.07 }); },
  // Doubles: the same note twice, then its double (an octave up).
  doubles() { tone(0, 659.25, { dur: 0.16, type: "triangle", vol: 0.1 }); tone(0.15, 659.25, { dur: 0.16, type: "triangle", vol: 0.1 }); bell(0.32, 1318.5, 0.09, 0.6); },
  // Grammar!: three typewriter taps and the bell at the end of the line.
  grammar() { [0, 0.08, 0.16].forEach((t) => noise(t, { dur: 0.025, freq: 4200, vol: 0.18 })); bell(0.28, 2093, 0.07, 0.8); },
  // Fraction Feast: a quick slice, then four pieces (a fourth each) climbing up.
  fractions() { noise(0, { dur: 0.12, freq: 6000, q: 0.7, vol: 0.08 }); [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(0.12 + i * 0.075, f, { dur: 0.2, type: "triangle", vol: 0.09 })); },
  // Articulate: two sung "la-la" notes with a little vibrato.
  articulate() { tone(0, 783.99, { dur: 0.22, vol: 0.1, vib: 6, attack: 0.03 }); tone(0.2, 1046.5, { dur: 0.45, vol: 0.1, vib: 8, attack: 0.03 }); },
  // Sticker World: a playset lid opening, with sparkles.
  stickers() { tone(0, 220, { to: 440, dur: 0.25, type: "triangle", vol: 0.08 }); [1318.5, 1567.98, 2093].forEach((f, i) => tone(0.2 + i * 0.06, f, { dur: 0.4, vol: 0.05 })); },
};

/** Play a jingle now (call from a tap). */
export function playJingle(name) {
  try { audio().resume?.(); (JINGLES[name] ?? JINGLES.default)(); } catch { /* no audio */ }
}

/** Play the jingle on the first tap or key press of this visit, once per tab. */
export function jingleOnce(name, soundsOn = () => true) {
  const key = `angelio:jingle:${name}`;
  try { if (sessionStorage.getItem(key)) return; } catch { /* storage blocked: play anyway */ }
  const go = () => {
    removeEventListener("pointerdown", go, true);
    removeEventListener("keydown", go, true);
    try { sessionStorage.setItem(key, "1"); } catch { /* ignore */ }
    if (soundsOn()) playJingle(name);
  };
  addEventListener("pointerdown", go, true);
  addEventListener("keydown", go, true);
}
