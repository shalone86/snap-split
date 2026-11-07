// "How it works" card shown before the first question of a level (the onboarding from Grammar
// and Doubles): a title, a one-line rule, a small example that animates, and the explanation
// read aloud. Kids who already know it can skip.
//
//   await showLesson(container, {
//     emoji: "🐸", title: "Trading 10 ones for 1 ten",
//     rule: "When you have <b>10 ones</b>, trade them for <b>1 ten</b>.",
//     exampleHtml: `... <span class="lesson-focus">…</span> ...`,   // .lesson-focus parts pop in
//     voice: "When you have ten ones, ...",
//   });

import { speak, stop } from "./tts.js";
import { sfx } from "./sound.js";

export function showLesson(container, intro) {
  if (!intro) return Promise.resolve();
  container.innerHTML = `
    <div class="lesson-card" role="dialog" aria-label="How it works">
      <div class="lesson-head">
        <span class="lesson-emoji" aria-hidden="true">${intro.emoji ?? "💡"}</span>
        <div class="lesson-titles">
          <div class="lesson-kicker">How it works</div>
          <h2 class="lesson-title">${intro.title}</h2>
        </div>
        <button type="button" class="btn small ghosty" data-lesson-skip>Skip ⏭</button>
      </div>
      <p class="lesson-rule">${intro.rule}</p>
      ${intro.exampleHtml ? `<div class="lesson-example"><div class="lesson-example-label">✨ Example</div>${intro.exampleHtml}</div>` : ""}
      <div class="lesson-actions">
        <button type="button" class="btn" data-lesson-listen>🔊 Listen again</button>
        <button type="button" class="btn big primary pulse" data-lesson-start>Start ▶</button>
      </div>
    </div>`;

  const timers = [];
  const animate = () => {
    timers.splice(0).forEach(clearTimeout);
    const parts = [...container.querySelectorAll(".lesson-focus")];
    parts.forEach((f) => f.classList.remove("lesson-focus-on"));
    parts.forEach((f, i) => timers.push(setTimeout(() => {
      if (!f.isConnected) return;
      f.classList.add("lesson-focus-on");
      sfx.pop();
    }, 900 + i * 700)));
  };
  animate();
  speak(intro.voice);

  return new Promise((resolve) => {
    const done = () => {
      timers.splice(0).forEach(clearTimeout);
      document.removeEventListener("keydown", onKey);
      stop();
      container.innerHTML = "";
      resolve();
    };
    const onKey = (e) => { if (e.key === "Enter") done(); };
    document.addEventListener("keydown", onKey);
    container.querySelector("[data-lesson-start]").onclick = done;
    container.querySelector("[data-lesson-skip]").onclick = done;
    container.querySelector("[data-lesson-listen]").onclick = () => { animate(); speak(intro.voice, { force: true }); };
  });
}
