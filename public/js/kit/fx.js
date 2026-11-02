// Motion helpers for moving things around the screen (from Regroup's block animations).
//
// The "ghost" trick: measure where things are, update the real page right away (new things
// hidden with class "incoming"), then fly look-alike ghosts in a fixed overlay from the old
// spots to the new ones, and reveal the real things when they land. The page is always the truth.

import { sfx } from "./sound.js";

const reduced = () => typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;
let slowFactor = 1;
/** Lessons that play themselves can run a little slower. */
export const setSlow = (f) => { slowFactor = f; };
export const speed = () => (reduced() ? 0.35 : slowFactor);
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms * speed()));

export function fxLayer() {
  let el = document.getElementById("fx");
  if (!el) {
    el = document.createElement("div");
    el.id = "fx";
    el.setAttribute("aria-hidden", "true");
    document.body.append(el);
  }
  return el;
}
export const clearFx = () => fxLayer().replaceChildren();

export const rectOf = (el) => { const r = el.getBoundingClientRect(); return { left: r.left, top: r.top, width: r.width, height: r.height }; };
export function union(rects) {
  const left = Math.min(...rects.map((r) => r.left)), top = Math.min(...rects.map((r) => r.top));
  const right = Math.max(...rects.map((r) => r.left + r.width)), bottom = Math.max(...rects.map((r) => r.top + r.height));
  return { left, top, width: right - left, height: bottom - top };
}
export const centered = (box, w, h) => ({ left: box.left + box.width / 2 - w / 2, top: box.top + box.height / 2 - h / 2, width: w, height: h });

/** Ghosts live outside their container, so copy its CSS size variables onto the overlay. */
export function syncVars(el, names = ["--u", "--cube", "--flat", "--dot"]) {
  const cs = getComputedStyle(el);
  const fx = fxLayer();
  for (const v of names) { const val = cs.getPropertyValue(v); if (val) fx.style.setProperty(v, val); }
}

/** Put an element in the overlay at a viewport rect. */
export function ghostAt(el, r) {
  el.classList.add("ghost");
  el.classList.remove("incoming");
  Object.assign(el.style, { left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px` });
  fxLayer().append(el);
  return el;
}
/** A ghost copy of an element, placed exactly over it. */
export const ghostOf = (el) => ghostAt(el.cloneNode(true), rectOf(el));

/** Fly a ghost (placed at rect `from`) to rect `to`, optionally along an arc. */
export function move(g, from, to, { dur = 600, arc = 0, delay = 0, easing = "cubic-bezier(.45,.05,.3,1)" } = {}) {
  const dx = to.left - from.left, dy = to.top - from.top;
  const sx = to.width / from.width || 1, sy = to.height / from.height || 1;
  const frames = [{ transform: "translate(0,0) scale(1,1)" }];
  if (arc) frames.push({ transform: `translate(${dx / 2}px, ${dy / 2 - arc}px) scale(${(1 + sx) / 2}, ${(1 + sy) / 2})`, offset: 0.5 });
  frames.push({ transform: `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})` });
  const k = speed();
  return g.animate(frames, { duration: dur * k, delay: delay * k, easing, fill: "forwards" }).finished.catch(() => {});
}

/**
 * Move real elements to new places with animation:
 *   const before = capture(els); <change the DOM>; await flip(before);
 * Each element (by identity) animates from where it was to where it is now.
 */
export const capture = (els) => els.map((el) => [el, rectOf(el)]);
export async function flip(before, { dur = 600, arc = 0, stagger = 0 } = {}) {
  const k = speed();
  await Promise.all(before.map(([el, a], j) => {
    if (!el.isConnected) return null;
    const b = rectOf(el);
    const dx = a.left - b.left, dy = a.top - b.top;
    if (!dx && !dy) return null;
    const frames = [{ transform: `translate(${dx}px, ${dy}px)` }];
    if (arc) frames.push({ transform: `translate(${dx / 2}px, ${dy / 2 - arc}px)`, offset: 0.5 });
    frames.push({ transform: "translate(0,0)" });
    return el.animate(frames, { duration: dur * k, delay: j * stagger * k, easing: "cubic-bezier(.45,.05,.3,1)" }).finished.catch(() => {});
  }));
}

export function pop(el, scale = 1.25) {
  el?.animate?.([{ transform: "scale(1)" }, { transform: `scale(${scale})` }, { transform: "scale(1)" }], { duration: 380 * speed(), easing: "ease-out" });
}
export function shake(el) {
  el?.animate?.([{ transform: "translateX(0)" }, { transform: "translateX(-8px)" }, { transform: "translateX(8px)" }, { transform: "translateX(-5px)" }, { transform: "translateX(0)" }], { duration: 380 });
}

/** One thing floats away (taking away). k = how many so far (the sound gets lower each time). */
export async function vanish(el, k = 0) {
  const g = ghostOf(el);
  el.style.visibility = "hidden";
  sfx.away(k);
  await g.animate([
    { transform: "translate(0,0) rotate(0) scale(1)", opacity: 1 },
    { transform: "translate(0,-50px) rotate(25deg) scale(.5)", opacity: 0 },
  ], { duration: 450 * speed(), easing: "ease-in", fill: "forwards" }).finished.catch(() => {});
  g.remove();
}

/** Fly some html (a digit, a chip) from one element to another; resolves when it lands. */
export async function flyHtml(fromEl, toEl, html, cls = "", { arc = 50, dur = 900, size = 44 } = {}) {
  if (!fromEl || !toEl) return;
  const g = document.createElement("span");
  g.className = `fly-chip ${cls}`;
  g.innerHTML = html;
  const from = centered(rectOf(fromEl), size, size), to = centered(rectOf(toEl), size, size);
  ghostAt(g, from);
  pop(g, 1.4);
  await sleep(250);
  await move(g, from, to, { dur, arc });
  g.remove();
}

/** A burst of confetti from the top of the screen. */
export function confetti(n = 60, colors = ["var(--blue)", "var(--green)", "var(--red)", "var(--purple)", "var(--yellow)"]) {
  if (reduced()) return;
  for (let k = 0; k < n; k++) {
    const c = document.createElement("i");
    c.className = "confetti";
    c.style.left = `${Math.random() * 100}vw`;
    c.style.background = colors[k % colors.length];
    fxLayer().append(c);
    c.animate([
      { transform: "translate(0,-20px) rotate(0)", opacity: 1 },
      { transform: `translate(${(Math.random() - 0.5) * 160}px, ${60 + Math.random() * 40}vh) rotate(${Math.random() * 720}deg)`, opacity: 0.9 },
    ], { duration: 1400 + Math.random() * 1200, delay: Math.random() * 300, easing: "cubic-bezier(.2,.6,.4,1)", fill: "forwards" })
      .finished.then(() => c.remove(), () => c.remove());
  }
}
