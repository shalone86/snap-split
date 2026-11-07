// Snap & Split: PreK adding and taking away with blocks that snap together and split apart.
// Built on the learning-app template (see js/kit/). Plain ES modules, no build step.

import * as S from "./kit/store.js";
S.init("snapsplit:v1", { sentences: true });

import { createRouter } from "./kit/router.js";
import { speak, stop, preload } from "./kit/tts.js";
import { sfx } from "./kit/sound.js";
import * as FX from "./kit/fx.js";
import { keepDockVisible } from "./kit/dock.js";
import { showLesson } from "./kit/lesson.js";
import { vary, leadIn, praise } from "./kit/vary.js";
import { esc, pick, starsHtml, starsFor, nextButton, say, showFinish, stickerBook, viewGrownups, installClickSounds, wireVoiceToggle } from "./kit/ui.js";
import { LEVELS, levelById, PER_LEVEL, makeLevel, choicesFor, sentence } from "./problems.js";

const app = document.getElementById("app");
const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

const route = createRouter([
  [/^$/, viewHome],
  [/^play\/([\w-]+)$/, viewPlay],
  [/^free$/, viewFree],
  [/^grownups$/, () => viewGrownups(app, {
    extraToggles: [["sentences", "Show number sentences", "After each problem, show 3 + 2 = 5 under the blocks."]],
    about: `<p>Snap & Split is for ages 3 to 5: counting, putting together and taking apart, up to 10. Everything is said out loud, so no reading is needed.</p>
      <p><b>Snap:</b> a blue group and a yellow group. Kids tap the blocks and they snap together into a ten-frame (two rows of five). The colors stay, so they can still see the 3 and the 2 inside the 5.</p>
      <p><b>Split:</b> kids tap blocks to take them away. Each one moves into the "take away" box, so both parts stay visible.</p>
      <p><b>Counting:</b> tapping a block counts it out loud (one, two, three…). Answer buttons show the number and its dots.</p>
      <p>A wrong answer gets "count them one at a time", and after a second try the game shows the answer. Levels go from 5 to 10.</p>`,
  })],
], { before() { stop(); FX.clearFx(); document.body.classList.remove("in-game"); } });

// ───────────────────────── pieces ─────────────────────────

const blocksHtml = (n, color) => Array.from({ length: n }, () => `<span class="blk ${color}"></span>`).join("");
const frameHtml = (cells) => `<div class="frame f${cells}">${Array.from({ length: cells }, () => `<span class="cell"></span>`).join("")}</div>`;
const dotsHtml = (n) => `<span class="mini-dots">${"<i></i>".repeat(n)}</span>`;

/** Fill the first empty cells of a frame with these block elements, with a snap animation. */
async function moveInto(blocks, cells, { arc = 40 } = {}) {
  const before = FX.capture(blocks);
  blocks.forEach((b, i) => cells[i]?.append(b));
  sfx.whoosh();
  await FX.flip(before, { dur: 650, arc, stagger: 60 });
}

// ───────────────────────── "how it works" cards ─────────────────────────

const LESSONS = {
  count: {
    emoji: "🐣", title: "Counting blocks",
    rule: "Tap each block <b>one time</b> as you count. The <b>last number</b> you say tells how many!",
    exampleHtml: `<div class="lesson-row">${blocksHtml(3, "a")}</div>
      <p class="lesson-say"><span class="lesson-focus">1…</span> <span class="lesson-focus">2…</span> <span class="lesson-focus">3 blocks!</span></p>`,
    voice: "Tap each block one time as you count. One, two, three. The last number you say tells how many. Three blocks!",
  },
  join: {
    emoji: "🧲", title: "Snap them together",
    rule: "Two groups <b>snap together</b> into one bigger group. Then count them <b>all</b>!",
    exampleHtml: `<div class="lesson-row">${blocksHtml(2, "a")}<span class="snap-plus">+</span>${blocksHtml(1, "b")}</div>
      <p class="lesson-say"><span class="lesson-focus">Snap!</span> <span class="lesson-focus">2 and 1 make <b>3</b>.</span></p>`,
    voice: "Two groups snap together into one bigger group. Two blue blocks and one yellow block. Snap! Then count them all. Two and one make three!",
  },
  split: {
    emoji: "✂️", title: "Split some away",
    rule: "Tap blocks to <b>take them away</b>. Then count how many are <b>left</b>.",
    exampleHtml: `<div class="lesson-row">${blocksHtml(3, "a")}<span class="lesson-focus">${blocksHtml(1, "a taken")}</span></div>
      <p class="lesson-say"><span class="lesson-focus">4 take away 1…</span> <span class="lesson-focus"><b>3</b> are left!</span></p>`,
    voice: "Tap blocks to take them away. Then count how many are left. Four blocks, take away one. Three are left!",
  },
};
LESSONS.mix = {
  emoji: "🔀", title: "Snap or split?",
  rule: "Listen carefully! Sometimes you <b>snap</b> groups together, and sometimes you <b>split</b> some away.",
  exampleHtml: `${LESSONS.join.exampleHtml}${LESSONS.split.exampleHtml}`,
  voice: "Listen carefully! Sometimes you snap groups together and count them all. Sometimes you take some away and count what's left.",
};
const introFor = (level) => LESSONS[level.type];

// ───────────────────────── home ─────────────────────────

function nextLevel() {
  return LEVELS.find((l) => !S.progress(l.id).done) ?? LEVELS.find((l) => S.progress(l.id).stars < 3) ?? LEVELS[0];
}

function viewHome() {
  const next = nextLevel();
  app.innerHTML = `
    <section class="hero">
      <h1 class="title" aria-label="Snap and Split"><span class="cb">Snap</span> <span class="amp">&amp;</span> <span class="cy">Split</span></h1>
      <div class="hero-blocks" aria-hidden="true">${blocksHtml(3, "a")}<span class="snap-plus">+</span>${blocksHtml(2, "b")}</div>
      <p class="lede">Snap blocks together. Split them apart. Count them all!</p>
      <a class="btn big primary play-btn" href="#/play/${next.id}">▶ Play</a>
      <p class="muted small">${next.emoji} ${esc(next.title)}</p>
    </section>
    <div class="level-grid">
      ${LEVELS.map((l) => `<a class="level-card${l.id === next.id ? " next" : ""}" href="#/play/${l.id}"><span class="emoji">${l.emoji}</span>${esc(l.title)}${starsHtml(S.progress(l.id).stars)}</a>`).join("")}
      <a class="level-card free" href="#/free"><span class="emoji">🧱</span>Free play</a>
    </div>
    ${stickerBook()}`;
}

// ───────────────────────── a level ─────────────────────────

function viewPlay(id) {
  const level = levelById(id);
  if (!level) { location.hash = "#/"; return; }
  document.body.classList.add("in-game");
  app.innerHTML = `
    <section class="play">
      <div class="play-top">
        <a class="icon-btn" href="#/" aria-label="Exit">✕</a>
        <div class="dots">${Array.from({ length: PER_LEVEL }, (_, k) => `<i data-dot="${k}"></i>`).join("")}</div>
        <button class="icon-btn toggle" data-voice title="Read aloud">🔊</button>
      </div>
      <div class="bubble" aria-live="polite"><span class="mascot" aria-hidden="true">🐻</span><p class="say"></p>
        <button class="icon-btn replay" aria-label="Say it again">🔁</button></div>
      <div class="stage max${level.max}"></div>
    </section>
    <div class="dock"></div>`;
  wireVoiceToggle(app.querySelector("[data-voice]"));
  const bubble = app.querySelector(".bubble"), dock = app.querySelector(".dock"), stage = app.querySelector(".stage");
  bubble.querySelector(".replay").onclick = () => speak(bubble.lastSaid, { force: true });
  let alive = true, mistakes = 0;
  const problems = makeLevel(level, Date.now());
  const ctx = { bubble, dock, stage, max: level.max, alive: () => alive, miss: () => { mistakes++; } };

  (async () => {
    // "How it works" card first (Listen / Skip / Start), like Grammar and Doubles.
    bubble.querySelector(".say").textContent = "Here's how it works!";
    await showLesson(stage, introFor(level));
    for (let k = 0; k < problems.length; k++) {
      if (!alive) return;
      app.querySelectorAll("[data-dot]").forEach((d) => d.classList.toggle("now", +d.dataset.dot === k));
      ctx.k = k;
      await runProblem(problems[k], ctx);
      if (!alive) return;
      app.querySelector(`[data-dot="${k}"]`)?.classList.add("done");
      S.solvedOne();
      await nextButton(dock, k < problems.length - 1 ? "Next ▶" : "Finish 🏁");
    }
    if (!alive) return;
    const nx = LEVELS[LEVELS.indexOf(level) + 1];
    showFinish(app, {
      id: level.id, stars: starsFor(mistakes), mistakes, title: pick(["You did it!", "Super snapping!", "Great counting!", "Wow!"]),
      done: `${PER_LEVEL} done.`, again: `#/play/${level.id}`, onAgain: route,
      next: nx ? { href: `#/play/${nx.id}`, label: `Next: ${nx.emoji} ${nx.title} ▶` } : null,
    });
  })();
  return () => { alive = false; };
}

/** Wait for a tap inside any of `targets`. */
function tapOn(targets, ctx) {
  targets.forEach((t) => t.classList.add("tap-here"));
  return new Promise((resolve) => {
    const on = (e) => {
      if (!targets.some((t) => t.contains(e.target))) return;
      ctx.stage.removeEventListener("click", on);
      targets.forEach((t) => t.classList.remove("tap-here"));
      sfx.tap();
      resolve();
    };
    ctx.stage.addEventListener("click", on);
  });
}

/**
 * Count by tapping: each tap on the frame counts the next block (the tapped one if it isn't
 * counted yet), shows its number and says it. Returns a function that turns counting off.
 */
function countByTapping(frame, ctx) {
  let n = 0;
  frame.classList.add("counting");
  const on = (e) => {
    if (!frame.contains(e.target)) return;
    const live = [...frame.querySelectorAll(".blk:not(.gone)")];
    let b = e.target.closest(".blk");
    if (!b || b.classList.contains("gone") || b.dataset.n) b = live.find((x) => !x.dataset.n);
    if (!b) { // all counted: start again
      live.forEach((x) => { delete x.dataset.n; x.classList.remove("counted"); });
      n = 0;
      b = live[0];
      if (!b) return;
    }
    n++;
    b.dataset.n = n;
    b.classList.add("counted");
    FX.pop(b, 1.25);
    sfx.key(n);
    speak(String(n));
  };
  ctx.stage.addEventListener("click", on);
  return () => { ctx.stage.removeEventListener("click", on); frame.classList.remove("counting"); };
}

/** The number buttons. Resolves once the right one is picked (or shown after 2 misses). */
function askNumber(answer, ctx, hint) {
  const opts = choicesFor(answer, ctx.max);
  ctx.dock.innerHTML = `<div class="choices">${opts.map((v) => `<button class="choice-card num-choice" data-v="${v}"><b>${v}</b>${dotsHtml(v)}</button>`).join("")}</div>`;
  let tries = 0;
  return new Promise((resolve) => {
    ctx.dock.querySelectorAll("[data-v]").forEach((btn) => {
      btn.onclick = () => {
        const v = +btn.dataset.v;
        sfx.select();
        if (v === answer) {
          btn.classList.add("right");
          ctx.dock.querySelectorAll("[data-v]").forEach((b) => { b.disabled = true; });
          sfx.right();
          FX.confetti(20);
          return resolve(true);
        }
        tries++;
        ctx.miss();
        btn.classList.add("wrong");
        btn.disabled = true;
        FX.shake(btn);
        sfx.oops();
        if (tries >= 2) {
          const right = ctx.dock.querySelector(`[data-v="${answer}"]`);
          right?.classList.add("right");
          say(ctx.bubble, `It's ${answer}. Let's count together!`);
          return resolve(false);
        }
        say(ctx.bubble, hint);
      };
    });
  });
}

async function runProblem(p, ctx) {
  const { stage, bubble, dock, max } = ctx;
  // Later problems start with a different lead-in ("How about this one?") instead of the same line.
  const opener = ctx.k > 0 ? `${leadIn()} ` : "";
  const cells = max > 5 ? 10 : 5;
  dock.innerHTML = "";

  if (p.type === "count") {
    stage.innerHTML = `${frameHtml(cells)}`;
    const frame = stage.querySelector(".frame");
    const fc = [...frame.querySelectorAll(".cell")];
    for (let i = 0; i < p.n; i++) fc[i].innerHTML = `<span class="blk ${i % 2 ? "b" : "a"} pop-in"></span>`;
    say(bubble, `${opener}${vary("count", ["How many blocks? Tap each one to count, then pick the number.", "Let's count! Tap each block, then pick the number.", "How many blocks do you see? Tap them to count.", "Count the blocks! Tap each one, then choose the number."])}`);
    const off = countByTapping(frame, ctx);
    await askNumber(p.answer, ctx, "Count them one at a time. Tap each block!");
    off();
    say(bubble, `${praise()} ${plural(p.n, "block")}.`);
    return;
  }

  if (p.type === "join") {
    stage.innerHTML = `
      <div class="plates"><div class="plate pa">${blocksHtml(p.a, "a")}</div><span class="snap-plus">+</span><div class="plate pb">${blocksHtml(p.b, "b")}</div></div>
      ${frameHtml(cells)}
      <p class="sentence"></p>`;
    const plates = [...stage.querySelectorAll(".plate")];
    say(bubble, `${opener}${plural(p.a, "blue block")} and ${plural(p.b, "yellow block")}. ${vary("snap", ["Tap them to snap them together!", "Snap them together! Tap the blocks.", "Can you snap them together? Tap them!", "Let's put them together. Tap the blocks!"])}`);
    dock.innerHTML = `<p class="hint">👆 Tap the blocks</p>`;
    await tapOn(plates, ctx);
    if (!ctx.alive()) return;
    dock.innerHTML = "";
    const frame = stage.querySelector(".frame");
    await moveInto([...stage.querySelectorAll(".plate .blk")], [...frame.querySelectorAll(".cell")]);
    sfx.snap();
    stage.querySelector(".plates").classList.add("empty");
    if (!ctx.alive()) return;
    say(bubble, `Snap! ${vary("count-all", ["How many blocks now? Tap each one to count, then pick the number.", "How many blocks are there all together? Count them!", "Let's count them all! Tap each block.", "How many in all? Tap to count, then pick."])}`);
    const off = countByTapping(frame, ctx);
    await askNumber(p.answer, ctx, "Count them one at a time. Tap each block!");
    off();
    showSentence(stage, p);
    say(bubble, `${praise()} ${p.a} and ${p.b} make ${p.answer}.`);
    return;
  }

  // split
  stage.innerHTML = `
    ${frameHtml(cells)}
    <div class="away-wrap"><span class="away-label">✋ Take away</span><div class="plate away"></div></div>
    <p class="sentence"></p>`;
  const frame = stage.querySelector(".frame");
  const fc = [...frame.querySelectorAll(".cell")];
  for (let i = 0; i < p.whole; i++) fc[i].innerHTML = `<span class="blk a"></span>`;
  const away = stage.querySelector(".away");
  say(bubble, `${opener}${plural(p.whole, "block")}. ${vary("take", [`Take away ${p.take}! Tap ${p.take} ${p.take === 1 ? "block" : "blocks"}.`, `Let's take ${p.take} away. Tap ${p.take === 1 ? "one block" : `${p.take} blocks`}.`, `Can you take away ${p.take}? Tap them!`])}`);
  let left = p.take;
  dock.innerHTML = `<p class="take-left"><b>${left}</b> to take away</p>`;
  frame.classList.add("tap-here");
  await new Promise((resolve) => {
    let busy = false;
    const on = async (e) => {
      if (busy || !frame.contains(e.target) || left <= 0) return;
      const live = [...frame.querySelectorAll(".blk")];
      let b = e.target.closest(".blk") ?? live.at(-1);
      if (!b) return;
      busy = true;
      left--;
      const counter = dock.querySelector(".take-left b");
      if (counter) { counter.textContent = left; FX.pop(counter, 1.5); }
      const before = FX.capture([b]);
      away.append(b);
      b.classList.add("taken");
      sfx.away(p.take - left);
      await FX.flip(before, { dur: 550, arc: 30 });
      busy = false;
      if (left === 0) { ctx.stage.removeEventListener("click", on); frame.classList.remove("tap-here"); resolve(); }
    };
    ctx.stage.addEventListener("click", on);
  });
  if (!ctx.alive()) return;
  // Slide what's left to the start of the ten-frame, the usual way to read one.
  await FX.sleep(250);
  await moveInto([...frame.querySelectorAll(".blk")], fc, { arc: 0 });
  say(bubble, vary("left", ["How many are left? Tap each one to count, then pick the number.", "How many blocks are left? Count them!", "Let's count what's left. Tap each block.", "How many stayed? Tap to count, then pick."]));
  const off = countByTapping(frame, ctx);
  await askNumber(p.answer, ctx, "Count the blocks that are left, one at a time!");
  off();
  showSentence(stage, p);
  say(bubble, `${praise()} ${p.whole} take away ${p.take} is ${p.answer}.`);
}

function showSentence(stage, p) {
  if (!S.settings().sentences) return;
  const el = stage.querySelector(".sentence");
  if (!el) return;
  el.innerHTML = p.type === "join"
    ? `<b class="cb">${p.a}</b> + <b class="cy">${p.b}</b> = <b>${p.answer}</b>`
    : `<b class="cb">${p.whole}</b> − <b class="cg">${p.take}</b> = <b>${p.answer}</b>`;
  FX.pop(el, 1.15);
}

// ───────────────────────── free play ─────────────────────────

function viewFree() {
  let a = 2, b = 3, snapped = false, busy = false;
  app.innerHTML = `
    <section class="free-view">
      <h1>Free play</h1>
      <p class="muted">Add blue and yellow blocks, then snap them together. Split them to start again.</p>
      <div class="stage max10">
        <div class="plates">
          <div class="plate-col"><div class="plate pa"></div><div class="pm"><button class="btn small" data-own-sound data-add="a" aria-label="Add a blue block">＋</button><button class="btn small" data-own-sound data-sub="a" aria-label="Remove a blue block">－</button></div></div>
          <span class="snap-plus">+</span>
          <div class="plate-col"><div class="plate pb"></div><div class="pm"><button class="btn small" data-own-sound data-add="b" aria-label="Add a yellow block">＋</button><button class="btn small" data-own-sound data-sub="b" aria-label="Remove a yellow block">－</button></div></div>
        </div>
        ${frameHtml(10)}
        <p class="sentence"></p>
      </div>
      <div class="row center"><button class="btn big primary" data-snap>🧲 Snap!</button><a class="btn big" href="#/">🏠 Done</a></div>
    </section>`;
  const $ = (s) => app.querySelector(s);
  const paint = () => {
    $(".pa").innerHTML = snapped ? "" : blocksHtml(a, "a");
    $(".pb").innerHTML = snapped ? "" : blocksHtml(b, "b");
    if (!snapped) $(".frame").querySelectorAll(".cell").forEach((c) => { c.innerHTML = ""; });
    $("[data-snap]").textContent = snapped ? "✂️ Split!" : "🧲 Snap!";
    app.querySelectorAll("[data-add]").forEach((x) => { x.disabled = snapped || a + b >= 10; });
    app.querySelectorAll("[data-sub]").forEach((x) => { x.disabled = snapped || (x.dataset.sub === "a" ? a : b) <= 0; });
    $(".sentence").innerHTML = snapped ? `<b class="cb">${a}</b> + <b class="cy">${b}</b> = <b>${a + b}</b>` : "";
  };
  const onClick = async (e) => {
    const t = e.target.closest("button");
    if (!t || busy) return;
    if (t.dataset.add) { t.dataset.add === "a" ? a++ : b++; sfx.add(a + b); paint(); FX.pop($(`.p${t.dataset.add} .blk:last-child`), 1.4); speak(String(a + b)); }
    if (t.dataset.sub) { const last = $(`.p${t.dataset.sub} .blk:last-child`); if (last) await FX.vanish(last, 1); t.dataset.sub === "a" ? a-- : b--; paint(); }
    if (t.matches("[data-snap]")) {
      busy = true;
      if (!snapped) {
        await moveInto([...app.querySelectorAll(".plate .blk")], [...$(".frame").querySelectorAll(".cell")]);
        sfx.snap();
        snapped = true;
        speak(`${a} and ${b} make ${a + b}!`);
        $(".sentence").innerHTML = `<b class="cb">${a}</b> + <b class="cy">${b}</b> = <b>${a + b}</b>`;
        $("[data-snap]").textContent = "✂️ Split!";
        app.querySelectorAll("[data-add],[data-sub]").forEach((x) => { x.disabled = true; });
      } else {
        const blocks = [...$(".frame").querySelectorAll(".blk")];
        const before = FX.capture(blocks);
        blocks.forEach((bl) => (bl.classList.contains("a") ? $(".pa") : $(".pb")).append(bl));
        sfx.crack();
        await FX.flip(before, { dur: 600, arc: 30, stagger: 40 });
        snapped = false;
        paint();
      }
      busy = false;
    }
  };
  app.addEventListener("click", onClick);
  paint();
  return () => app.removeEventListener("click", onClick);
}

installClickSounds();
route();
keepDockVisible();
if ("serviceWorker" in navigator && location.protocol === "https:") navigator.serviceWorker.register("sw.js").catch(() => {});

// Warm the voice for the words said over and over (counting, praise, the usual instructions).
preload([
  ...Array.from({ length: 11 }, (_, n) => String(n)),
  "Yes!", "That's right!", "You got it!", "Great counting!", "You did it!", "Super snapping!", "Wow!",
  "How many blocks? Tap each one to count, then pick the number.",
  "Snap! How many blocks now? Tap each one to count, then pick the number.",
  "How many are left? Tap each one to count, then pick the number.",
  "You did it! You got a new sticker!",
  ...Array.from({ length: 10 }, (_, a) => Array.from({ length: 11 - a }, (_, b) => `${a} and ${b} make ${a + b}!`)).flat(),
]);
