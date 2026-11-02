// A tiny hash router: #/ , #/play/3 … Each view may return a cleanup function, which runs before
// the next view. (Lesson learned in Regroup: an async view returns a Promise, not a cleanup,
// so only real functions are kept, and a failing cleanup can never block navigation.)

export function createRouter(routes, { before } = {}) {
  let cleanup = null;
  function route() {
    try { cleanup?.(); } catch (e) { console.warn(e); }
    cleanup = null;
    try { before?.(); } catch (e) { console.warn(e); }
    const path = location.hash.replace(/^#\/?/, "");
    for (const [re, fn] of routes) {
      const m = path.match(re);
      if (!m) continue;
      document.querySelectorAll("[data-nav]").forEach((a) => a.classList.toggle("active", a.dataset.nav === (path.split("/")[0] || "home")));
      const out = fn(...m.slice(1));
      cleanup = typeof out === "function" ? out : null;
      if (out && typeof out.then === "function") out.catch((e) => console.error(e));
      window.scrollTo(0, 0);
      return;
    }
    location.hash = "#/";
  }
  window.addEventListener("hashchange", route);
  return route;
}
