// Shared screens and bits: escaping, stars, the "Next" button, the finish screen with stickers,
// the grown-ups settings card, and a click sound for every button.

import * as S from "./store.js";
import { speak, stop, browserVoices } from "./tts.js";
import { health } from "./api.js";
import { sfx } from "./sound.js";
import { confetti } from "./fx.js";
import { spoken } from "./speech.js";
import { vary } from "./vary.js";
import { STICKER_WORLD } from "./stickers.js";

const ESC = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
export const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ESC[c]);
export const pick = (a) => a[Math.floor(Math.random() * a.length)];
// Things that are fun to place in the Sticker World: animals, vehicles, buildings, nature, treats.
export const STICKERS = ["🦄", "🚀", "🦖", "🌈", "🐙", "🎈", "🦋", "🐢", "🌟", "🐝", "🦕", "🐼", "🐬", "🐶", "🐱", "🐴", "🐑", "🐸",
  "🦉", "🐞", "🦊", "🐻", "🐧", "🐳", "🦒", "🐘", "🐰", "🦆", "🚂", "🚁", "⛵", "🚒", "🚜", "🎠", "🏰", "🏡", "⛪", "🌳", "🌻",
  "🍄", "🌷", "⛲", "🧸", "🪁", "🍩", "🍦", "🍉", "🕊️", "👼", "🐟",
  // From our faith (about one sticker in four): church, cross, rosary, candle, praying hands, bread and
  // grapes, the Lamb, a bell, a rose for Mary, the star of Bethlehem, the ox and donkey at the manger.
  "⛪", "✝️", "📿", "🕯️", "🙏", "🍞", "🍇", "🐑", "🔔", "🌹", "🌟", "🐂", "🫏", "👼", "🕊️",
  // Our own drawings (emoji have no Mary, chalice or Sacred Heart): angelio.org/stickers/art/
  "art:mary", "art:baby-jesus", "art:sacred-heart", "art:chalice", "art:monstrance", "art:bible", "art:lily",
  "art:st-joseph", "art:st-francis", "art:guardian-angel", "art:holy-family", "art:rosary", "art:agnus-dei", "art:advent-wreath", "art:loaves-fishes"];

/** A sticker as HTML: an emoji, or one of our drawings ("art:mary"). Sized by font-size, like emoji. */
const ART = { mary: "Mary", "baby-jesus": "Baby Jesus", "sacred-heart": "Sacred Heart", chalice: "Chalice", monstrance: "Monstrance", bible: "Holy Bible", lily: "Lily",
  "st-joseph": "St. Joseph", "st-francis": "St. Francis", "guardian-angel": "Guardian angel", "holy-family": "The Holy Family", rosary: "Rosary", "agnus-dei": "Lamb of God", "advent-wreath": "Advent wreath", "loaves-fishes": "Loaves and fishes" };
export const stickerHtml = (e) => (String(e).startsWith("art:")
  ? `<img class="art-sticker" src="https://angelio.org/stickers/art/${esc(e.slice(4))}.svg" alt="${esc(ART[e.slice(4)] ?? "sticker")}" draggable="false">`
  : esc(e));

export const starsHtml = (n) => `<span class="stars" aria-label="${n} of 3 stars">${"★".repeat(n)}<span class="off">${"★".repeat(3 - n)}</span></span>`;
// 3 stars only with no mistakes, matching the giant sticker (any mistake: a mini sticker and a yellow dot).
export const starsFor = (mistakes) => (mistakes === 0 ? 3 : mistakes <= 3 ? 2 : 1);

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

/** Mark a progress dot: green when solved alone, yellow when it needed a mistake or a hint. */
export function markDot(root, k, helped) {
  const d = root.querySelector(`[data-dot="${k}"]`);
  d?.classList.remove("now");
  d?.classList.add(helped ? "assisted" : "done");
}

/**
 * Stars, the level's sticker, confetti and "play again / next". One sticker per level: giant
 * with no mistakes, mini otherwise; a mini sticker grows into a giant one after a perfect replay.
 */
export function showFinish(app, { id, stars, mistakes, title, done, again, next, onAgain }) {
  document.body.classList.remove("in-game");
  const perfect = mistakes === 0;
  const st = S.finishLevel(id, stars, pick(STICKERS), perfect);
  sfx.fanfare();
  confetti(perfect ? 100 : 45);
  const line = st.grew ? "Your sticker grew into a GIANT sticker!"
    : st.isNew && st.big ? "A giant sticker! No mistakes at all!"
    : st.isNew ? "A mini sticker! Play again with no mistakes to make it giant."
    : st.big ? (perfect ? "No mistakes at all. Wow!" : done)
    : perfect ? "" : "No mistakes next time, and your mini sticker grows giant!";
  const label = st.grew ? "It grew! 🌟" : st.isNew ? (st.big ? "Giant sticker!" : "Mini sticker!") : st.big ? "Your giant sticker" : "Your mini sticker";
  app.innerHTML = `
    <section class="finish">
      <div class="big-stars">${starsHtml(stars)}</div>
      <h1>${perfect ? vary("perfect", ["Perfect!", "No mistakes!", "Super star!"]) : title}</h1>
      <p class="new-sticker ${st.big ? "big-sticker" : "mini-sticker"}${st.grew ? " grew" : ""}"><span>${stickerHtml(st.e)}</span><br>${label}</p>
      ${line ? `<p class="muted">${esc(line)}</p>` : ""}
      <div class="row center">
        <a class="btn big${st.big ? "" : " primary"}" href="${again}" data-again>🔁 ${st.big ? "Play again" : "Try for giant!"}</a>
        ${next ? `<a class="btn big${st.big ? " primary" : ""}" href="${next.href}">${next.label}</a>` : `<a class="btn big${st.big ? " primary" : ""}" href="#/">🏠 Home</a>`}
      </div>
      ${STICKER_WORLD ? `<p><a class="btn world-link" href="${STICKER_WORLD}">🌍 Play in Sticker World</a></p>` : ""}
    </section>`;
  speak(st.grew ? "Wow! Your sticker grew into a giant sticker!"
    : st.isNew && st.big ? vary("giant", ["You did it with no mistakes! You got a giant sticker!", "Perfect! Here's a giant sticker!"])
    : st.isNew ? vary("mini", ["You did it! You got a mini sticker. Play again with no mistakes to make it giant!", "Nice work! Here's a mini sticker. No mistakes next time makes it giant!"])
    : perfect ? "You did it! No mistakes!" : "You did it!");
  if (onAgain) app.querySelector("[data-again]").onclick = (e) => { e.preventDefault(); onAgain(); };
}

export function stickerBook() {
  const st = S.stickers();
  return `<section class="sticker-book">
      <h2>My stickers <small>${S.solved()} solved</small></h2>
      ${st.length ? `<div class="stickers">${st.map((s) => `<span class="${s.big ? "big" : "mini"}" title="${s.big ? "giant" : "mini"} sticker">${stickerHtml(s.e)}</span>`).join("")}</div>`
        : `<p class="muted small">Finish a level to get your first sticker! No mistakes makes it a giant one.</p>`}
      ${STICKER_WORLD && st.length ? `<a class="btn world-link" href="${STICKER_WORLD}">🌍 Play in Sticker World</a>` : ""}
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
        <label class="set"><span><b>Cloudflare Voice Character</b><br><span class="muted small">Aura-2 Neural Voice (Helena is warm & clear for single numbers)</span></span>
          <select data-k="voice">
            <option value="helena">Helena (Warm & Natural)</option>
            <option value="thalia">Thalia (Clear & Bright)</option>
            <option value="luna">Luna (Gentle & Calm)</option>
            <option value="asteria">Asteria (Lively)</option>
            <option value="aurora">Aurora (Expressive)</option>
            <option value="apollo">Apollo (Friendly)</option>
            <option value="orion">Orion (Deep)</option>
          </select></label>
        <label class="set"><span><b>Passcode</b><br><span class="muted small">Only if APP_PASSCODE is set on the Worker.</span></span><input type="password" data-k="passcode" value="${esc(s.passcode)}" autocomplete="off"></label>
        <div class="row"><button class="btn small" data-test>🔊 Test the voice</button><button class="btn small danger" data-reset>Reset progress</button></div>
      </div>
      ${about ? `<h2>How it teaches</h2><div class="card prose">${about}</div>` : ""}
      <p class="muted small">Progress is saved in this browser only. Nothing is sent anywhere except the sentences read aloud, if the Cloudflare voice is on (they aren't stored).</p>
    </section>`;
  app.querySelector('[data-k="ttsSource"]').value = s.ttsSource;
  const voiceSelect = app.querySelector('[data-k="voice"]');
  if (voiceSelect && s.voice) voiceSelect.value = s.voice;
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
