// Shared screens and bits: escaping, stars, the "Next" button, the finish screen with stickers,
// the grown-ups settings card, and a click sound for every button.

import * as S from "./store.js";
import { speak, stop, browserVoices } from "./tts.js";
import { health } from "./api.js";
import { sfx } from "./sound.js";
import { confetti } from "./fx.js";
import { spoken } from "./speech.js";

const ESC = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
export const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ESC[c]);
export const pick = (a) => a[Math.floor(Math.random() * a.length)];
export const STICKERS = ["🦄", "🚀", "🦖", "🌈", "🍕", "🐙", "⚽", "🎈", "🦋", "🍩", "🐢", "🌟", "🐝", "🍦", "🦕", "🐼", "🏆", "🎸", "🐬", "🍉"];

export const starsHtml = (n) => `<span class="stars" aria-label="${n} of 3 stars">${"★".repeat(n)}<span class="off">${"★".repeat(3 - n)}</span></span>`;
export const starsFor = (mistakes) => (mistakes <= 1 ? 3 : mistakes <= 4 ? 2 : 1);

/** A big pulsing button in the dock; resolves when pressed (or Enter). */
export function nextButton(dock, label) {
  dock.innerHTML = `<button class="btn big primary pulse" data-next>${label}</button>`;
  return new Promise((resolve) => {
    const go = () => { document.removeEventListener("keydown", onKey); resolve(); };
    const onKey = (e) => { if (e.key === "Enter") go(); };
    dock.querySelector("[data-next]").onclick = go;
    document.addEventListener("keydown", onKey);
  });
}

/** Show a message in the speech bubble and say it. */
export function say(bubble, text) {
  const p = bubble.querySelector(".say");
  p.innerHTML = text;
  bubble.lastSaid = spoken(text);
  bubble.animate?.([{ transform: "scale(1)" }, { transform: "scale(1.03)" }, { transform: "scale(1)" }], { duration: 300 });
  speak(bubble.lastSaid);
}

/** Stars, a sticker, confetti and "play again / next". */
export function showFinish(app, { id, stars, mistakes, title, done, again, next, onAgain }) {
  document.body.classList.remove("in-game");
  const sticker = S.finishLevel(id, stars, pick(STICKERS));
  sfx.fanfare();
  confetti(90);
  app.innerHTML = `
    <section class="finish">
      <div class="big-stars">${starsHtml(stars)}</div>
      <h1>${title}</h1>
      ${sticker ? `<p class="new-sticker"><span>${sticker}</span><br>New sticker!</p>` : ""}
      <p class="muted">${mistakes === 0 ? "No mistakes at all. Wow!" : done}</p>
      <div class="row center">
        <a class="btn big" href="${again}" data-again>🔁 Play again</a>
        ${next ? `<a class="btn big primary" href="${next.href}">${next.label}</a>` : `<a class="btn big primary" href="#/">🏠 Home</a>`}
      </div>
    </section>`;
  speak(sticker ? "You did it! You got a new sticker!" : "You did it!");
  if (onAgain) app.querySelector("[data-again]").onclick = (e) => { e.preventDefault(); onAgain(); };
}

export function stickerBook() {
  const st = S.stickers();
  return `<section class="sticker-book">
      <h2>My stickers <small>${S.solved()} solved</small></h2>
      ${st.length ? `<div class="stickers">${st.map((s) => `<span>${s}</span>`).join("")}</div>` : `<p class="muted small">Finish a level to get your first sticker!</p>`}
    </section>`;
}

/** The grown-ups page: settings shared by every app, plus an app-specific "how it teaches" note. */
export async function viewGrownups(app, { extraToggles = [], about = "" } = {}) {
  const s = S.settings();
  const toggle = (k, label, sub) => `<label class="set"><span><b>${label}</b>${sub ? `<br><span class="muted small">${sub}</span>` : ""}</span><input type="checkbox" data-k="${k}" ${s[k] ? "checked" : ""}></label>`;
  app.innerHTML = `
    <section>
      <h1>For grown-ups</h1>
      <div class="card">
        ${toggle("readAloud", "Read aloud", "Says every step out loud, for kids who are still learning to read.")}
        ${toggle("slow", "Slower voice", "")}
        ${toggle("sounds", "Sound effects", "")}
        ${extraToggles.map(([k, label, sub]) => toggle(k, label, sub)).join("")}
        <label class="set"><span><b>Voice</b><br><span class="muted small" data-voice-status>Checking…</span></span>
          <select data-k="ttsSource"><option value="auto">Best available</option><option value="server">Cloudflare voice</option><option value="browser">This device's voice</option></select></label>
        <label class="set"><span><b>Passcode</b><br><span class="muted small">Only if APP_PASSCODE is set on the Worker.</span></span><input type="password" data-k="passcode" value="${esc(s.passcode)}" autocomplete="off"></label>
        <div class="row"><button class="btn small" data-test>🔊 Test the voice</button><button class="btn small danger" data-reset>Reset progress</button></div>
      </div>
      ${about ? `<h2>How it teaches</h2><div class="card prose">${about}</div>` : ""}
      <p class="muted small">Progress is saved in this browser only. Nothing is sent anywhere except the sentences read aloud, if the Cloudflare voice is on (they aren't stored).</p>
    </section>`;
  app.querySelector('[data-k="ttsSource"]').value = s.ttsSource;
  app.querySelectorAll("[data-k]").forEach((el) => {
    el.onchange = () => S.setSetting(el.dataset.k, el.type === "checkbox" ? el.checked : el.value);
  });
  app.querySelector("[data-test]").onclick = () => speak("Hello! Let's learn something fun.", { force: true });
  app.querySelector("[data-reset]").onclick = () => {
    if (confirm("Reset all stars and stickers?")) { S.resetProgress(); location.hash = "#/"; }
  };
  const h = await health();
  const st = app.querySelector("[data-voice-status]");
  if (st) st.textContent = h.tts ? "Cloudflare voice is available." : `Using this device's voice${browserVoices().length ? "" : " (if it has one)"}.`;
}

/** Every button and link clicks, except ones that make their own sound (mark them data-own-sound). */
export function installClickSounds(skip = "[data-own-sound], .key, .choice-card, .toggle") {
  document.addEventListener("click", (e) => {
    const el = e.target.closest("button, a");
    if (!el || el.matches(skip) || el.disabled) return;
    sfx.click();
  }, true);
}

/** A voice / read-aloud toggle button. */
export function wireVoiceToggle(btn) {
  btn.setAttribute("aria-pressed", S.settings().readAloud);
  btn.onclick = () => {
    const on = !S.settings().readAloud;
    S.setSetting("readAloud", on);
    btn.setAttribute("aria-pressed", on);
    sfx.toggle();
    if (!on) stop();
  };
}
