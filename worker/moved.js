// When an app moves to a new address (e.g. regroup.shalonely.com → angelio.org/regroup/), its old
// address shows a tiny page that carries the child's saved progress (this browser's localStorage)
// to the new address and opens it. The app's index.html picks it up from "#migrate=…".
//
// Set in wrangler.jsonc "vars": HOME_URL (the new address, ending in "/") and STORE_KEY (the app's
// localStorage key). Requests that already arrive on HOME_URL's host are served normally.

export function movedResponse(url, env) {
  if (!env.HOME_URL) return null;
  const home = new URL(env.HOME_URL);
  if (url.hostname === home.hostname || url.pathname.startsWith("/api/")) return null;
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><title>We've moved!</title>
<style>body{font:18px/1.5 system-ui,sans-serif;text-align:center;padding:48px 16px;background:#fbf8f1;color:#2b2340}a{color:#1e3a8a;font-weight:700}</style>
</head><body><p>We've moved to <a href="${home.href}">${home.host}${home.pathname}</a>. Taking you there…</p>
<script>
(function () {
  var to = ${JSON.stringify(home.href)};
  try {
    var data = localStorage.getItem(${JSON.stringify(env.STORE_KEY ?? "")});
    if (data) to += "#migrate=" + encodeURIComponent(data);
  } catch (e) {}
  location.replace(to);
})();
</script></body></html>`;
  return new Response(html, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
}
