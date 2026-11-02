// Snap & Split levels and problems (pure, tested in Node).
//   count: how many blocks?            join: a + b (snap two groups together)
//   split: whole − take (take some away and see what's left)

export const LEVELS = [
  { id: "count-5", type: "count", max: 5, title: "Count to 5", emoji: "🐣" },
  { id: "snap-5", type: "join", max: 5, title: "Snap to 5", emoji: "🧲" },
  { id: "split-5", type: "split", max: 5, title: "Split from 5", emoji: "✂️" },
  { id: "count-10", type: "count", max: 10, title: "Count to 10", emoji: "🐥" },
  { id: "snap-10", type: "join", max: 10, title: "Snap to 10", emoji: "🧲" },
  { id: "split-10", type: "split", max: 10, title: "Split from 10", emoji: "✂️" },
  { id: "mix-10", type: "mix", max: 10, title: "Snap or split", emoji: "🔀" },
];
export const levelById = (id) => LEVELS.find((l) => l.id === id);
export const PER_LEVEL = 5;

/** Small seeded random generator so a level can be replayed (and tested). */
export function seeded(seed) {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}
const randInt = (rand, lo, hi) => lo + Math.floor(rand() * (hi - lo + 1));

/** Problem `index` of a level. Early problems use smaller numbers. */
export function makeProblem(level, index, rand = Math.random) {
  const type = level.type === "mix" ? (index % 2 ? "split" : "join") : level.type;
  const max = level.max;
  const big = max > 5 && index >= 2; // the first two of a "10" level stay small
  if (type === "count") {
    const n = max > 5 ? randInt(rand, big ? 6 : 4, max) : randInt(rand, 1 + Math.min(index, 2), max);
    return { type, n, answer: n };
  }
  if (type === "join") {
    const total = max > 5 ? randInt(rand, big ? 6 : 4, max) : randInt(rand, 2 + Math.min(index, 2), max);
    const a = randInt(rand, 1, total - 1);
    return { type, a, b: total - a, answer: total };
  }
  const whole = max > 5 ? randInt(rand, big ? 6 : 4, max) : randInt(rand, 2 + Math.min(index, 2), max);
  const take = randInt(rand, 1, whole - 1);
  return { type: "split", whole, take, answer: whole - take };
}

export function makeLevel(level, seed = Date.now()) {
  const rand = seeded(seed);
  const out = [];
  for (let i = 0; i < PER_LEVEL; i++) {
    let p, tries = 0;
    do p = makeProblem(level, i, rand);
    while (tries++ < 50 && out.some((q) => JSON.stringify(q) === JSON.stringify(p)));
    out.push(p);
  }
  return out;
}

/** Three different answer choices near the answer, from 0 to max, in order. */
export function choicesFor(answer, max, rand = Math.random) {
  const set = new Set([answer]);
  const near = [answer - 1, answer + 1, answer - 2, answer + 2].filter((x) => x >= 1 && x <= max);
  while (set.size < 3 && near.length) set.add(near.splice(Math.floor(rand() * near.length), 1)[0]);
  for (let x = 1; set.size < 3 && x <= max; x++) set.add(x);
  return [...set].sort((a, b) => a - b);
}

/** The number sentence for a problem: "3 + 2 = 5" or "5 − 2 = 3" (null for counting). */
export function sentence(p) {
  if (p.type === "join") return `${p.a} + ${p.b} = ${p.answer}`;
  if (p.type === "split") return `${p.whole} − ${p.take} = ${p.answer}`;
  return null;
}
