// Keep the bottom bar (answers, buttons) on screen when a child pinch-zooms.
// iOS and Android leave position:fixed bars at the bottom of the *unzoomed* page, so a zoomed-in
// child can't see the number pad. We move and shrink the bar to sit at the bottom of what's
// actually visible (the visual viewport), at a normal size.

export function keepDockVisible() {
  const vv = window.visualViewport;
  if (!vv) return;
  let raf = 0;
  const place = () => {
    raf = 0;
    const dock = document.querySelector(".dock");
    if (!dock) return;
    const s = vv.scale || 1;
    if (s <= 1.01 && Math.abs(vv.offsetTop) < 1) { dock.style.transform = ""; dock.style.width = ""; return; }
    const layoutH = document.documentElement.clientHeight;
    const layoutW = document.documentElement.clientWidth;
    dock.style.transformOrigin = "0 100%";
    dock.style.width = `${layoutW}px`;
    dock.style.transform = `translate(${vv.offsetLeft}px, ${vv.offsetTop + vv.height - layoutH}px) scale(${1 / s})`;
  };
  const schedule = () => { if (!raf) raf = requestAnimationFrame(place); };
  vv.addEventListener("resize", schedule);
  vv.addEventListener("scroll", schedule);
  window.addEventListener("hashchange", schedule);
  new MutationObserver(schedule).observe(document.getElementById("app")?.parentElement ?? document.body, { childList: true, subtree: false });
}
