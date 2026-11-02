// Little sound effects made with Web Audio (no files to download).

import { settings } from "./store.js";

let ctx;
function ac() {
  if (!settings().sounds) return null;
  try {
    ctx ??= new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  } catch { return null; }
}

function tone(freq, { at = 0, dur = 0.12, type = "sine", vol = 0.18, slide = 0 } = {}) {
  const c = ac();
  if (!c) return;
  const t = c.currentTime + at;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(freq * slide, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(c.destination);
  o.start(t);
  o.stop(t + dur + 0.02);
}

// A different sound for each kind of thing that happens, so kids can "hear" what the game did.
const SCALE = [523, 587, 659, 698, 784, 880, 988, 1047, 1175, 1319]; // C major, one note per digit

export const sfx = {
  // presses
  click: () => tone(880, { dur: 0.05, type: "triangle", vol: 0.08 }), // any ordinary button
  key: (n = 0) => tone(SCALE[Number(n) % 10], { dur: 0.09, type: "square", vol: 0.05 }), // number pad: each digit its own note
  back: () => tone(300, { dur: 0.08, type: "triangle", vol: 0.1, slide: 0.7 }), // delete
  submit: () => tone(740, { dur: 0.07, type: "triangle", vol: 0.1 }), // ✓
  select: () => { tone(600, { dur: 0.06, type: "triangle", vol: 0.1 }); tone(900, { at: 0.05, dur: 0.06, type: "triangle", vol: 0.08 }); }, // a choice button
  tap: () => tone(1046, { dur: 0.05, type: "sine", vol: 0.12 }), // tapping something on the board
  toggle: () => { tone(500, { dur: 0.04, type: "square", vol: 0.04 }); tone(700, { at: 0.04, dur: 0.04, type: "square", vol: 0.04 }); },
  // things moving
  pop: () => tone(520, { dur: 0.09, type: "triangle", slide: 1.8 }), // a block appears
  add: (n = 0) => tone(400 + Math.min(n, 19) * 30, { dur: 0.08, type: "triangle", vol: 0.12, slide: 1.4 }), // add a block (higher as it fills)
  whoosh: () => tone(300, { dur: 0.35, type: "sawtooth", vol: 0.05, slide: 3 }), // something flies
  slide: () => tone(900, { dur: 0.35, type: "sine", vol: 0.1, slide: 0.45 }), // a number slides down
  lift: () => tone(400, { dur: 0.2, type: "sine", vol: 0.12, slide: 2 }), // pick up 1 ten
  land: () => tone(200, { dur: 0.12, type: "triangle", vol: 0.18, slide: 0.6 }), // a digit lands
  snap: () => { tone(880, { dur: 0.08, type: "square", vol: 0.06 }); tone(1320, { at: 0.06, dur: 0.1, type: "triangle" }); }, // 10 snap into 1
  crack: () => { tone(700, { dur: 0.06, type: "square", vol: 0.06 }); tone(350, { at: 0.05, dur: 0.12, type: "triangle", slide: 0.6 }); }, // 1 breaks into 10
  away: (n = 0) => tone(700 - Math.min(n, 12) * 35, { dur: 0.12, type: "sine", vol: 0.12, slide: 0.5 }), // take a block away (lower each time)
  // results
  right: () => { tone(660, { dur: 0.1 }); tone(990, { at: 0.09, dur: 0.18 }); },
  oops: () => tone(220, { dur: 0.22, type: "triangle", vol: 0.14, slide: 0.8 }),
  win: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, { at: i * 0.11, dur: 0.22, type: "triangle", vol: 0.16 })),
  fanfare: () => [523, 659, 784, 659, 784, 1047, 1319].forEach((f, i) => tone(f, { at: i * 0.12, dur: i === 6 ? 0.5 : 0.16, type: "triangle", vol: 0.16 })),
};
