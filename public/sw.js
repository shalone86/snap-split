// Offline support: network first for the app (updates show right away), cache first for fonts
// and voice clips. Bump VERSION when you change files, and list new files in ASSETS.

const VERSION = "v9";
// Cache names start with the app id: several apps can share one site (angelio.org/regroup/, /snap/…),
// and each must only clean up its own caches.
const APP = "snap";
const SHELL = `${APP}-shell-${VERSION}`;
const RUNTIME = `${APP}-runtime-v1`;

const ASSETS = [
  "./", "index.html", "manifest.webmanifest", "icon.svg", "icons/icon-192.png", "icons/apple-touch-icon.png",
  "css/base.css", "css/app.css", "js/app.js", "js/problems.js", "js/kit/lesson.js", "js/kit/vary.js", "js/kit/stickers.js", "js/kit/jingle.js",
  "js/kit/api.js", "js/kit/dock.js", "js/kit/fx.js", "js/kit/router.js", "js/kit/sound.js", "js/kit/speech.js",
  "js/kit/store.js", "js/kit/tts.js", "js/kit/ui.js",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(SHELL).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => (k.startsWith(`${APP}-`) || /^(shell|runtime)-/.test(k)) && k !== SHELL && k !== RUNTIME).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});
async function networkFirst(req) {
  const cache = await caches.open(SHELL);
  try {
    const res = await fetch(req);
    if (res.ok) cache.put(req, res.clone());
    return res;
  } catch {
    return (await cache.match(req, { ignoreSearch: true })) ?? (await cache.match("index.html")) ?? Response.error();
  }
}
async function cacheFirst(req) {
  const cache = await caches.open(RUNTIME);
  const hit = await cache.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok || res.type === "opaque") cache.put(req, res.clone());
  return res;
}
self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin === location.origin && url.pathname.endsWith("/api/tts")) return e.respondWith(cacheFirst(req));
  if (url.origin === location.origin && url.pathname.includes("/api/")) return;
  if (/fonts\.(googleapis|gstatic)\.com$/.test(url.hostname)) return e.respondWith(cacheFirst(req));
  if (url.origin === location.origin) e.respondWith(networkFirst(req));
});
