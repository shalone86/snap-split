// Family codes and daily safety limits for the paid AI features (speech checks, the nicer voice).
//
// Everything lives in one Workers KV namespace, bound as CODES in every Worker that uses it:
//   code:<CODE>            → { name, limit, created, revoked }      a family code (limit = checks per month)
//   use:<CODE>:<YYYY-MM>   → number                                  checks used this month
//   free:<hash>:<YYYY-MM-DD> → number                                free checks used today by one network
//   cap:<kind>:<YYYY-MM-DD>  → number                                all uses of a feature today, site-wide
//
// Settings (wrangler.jsonc "vars"):
//   REQUIRE_CODE = "true"      speech checks need a family code (after FREE_PER_DAY free tries a day)
//   FREE_PER_DAY = "3"         free speech checks a day without a code (per network)
//   SPEECH_DAILY_CAP = "500"   at most this many speech checks a day on the whole site
//   TTS_DAILY_CAP = "3000"     at most this many new voice clips a day on the whole site (cached ones are free)
//
// KV counters aren't exact under heavy simultaneous use (a few extra uses can slip through);
// that's fine for safety limits on a family site.
// Without a CODES binding nothing is limited, so the template still works anywhere.

const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // no 0/O, 1/I/L: easy to read aloud and type
export const CODE_RE = /^[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/;

export const day = (d = new Date()) => d.toISOString().slice(0, 10);
export const month = (d = new Date()) => d.toISOString().slice(0, 7);

/** "wing 7kq4m2xp" → "WING-7KQ4-M2XP" (typed codes can have spaces, dashes, lowercase). */
export function normalizeCode(s) {
  const raw = String(s ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (raw.length !== 12) return null;
  const c = `${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8)}`;
  return CODE_RE.test(c) ? c : null;
}

/** A new random code like "K7QM-4XPA-2NWD". */
export function newCode(randomBytes = (n) => crypto.getRandomValues(new Uint8Array(n))) {
  const b = randomBytes(12);
  const s = Array.from(b, (x) => ALPHABET[x % ALPHABET.length]).join("");
  return `${s.slice(0, 4)}-${s.slice(4, 8)}-${s.slice(8)}`;
}

const num = async (kv, k) => Number((await kv.get(k)) ?? 0);
const bump = (kv, k, ttl, by = 1) => num(kv, k).then((n) => kv.put(k, String(n + by), ttl ? { expirationTtl: ttl } : undefined));

/** { valid, name, limit, used, left, revoked } for a code (valid: false when unknown). */
export async function codeStatus(env, code, now = new Date()) {
  const c = normalizeCode(code);
  if (!c || !env.CODES) return { valid: false };
  const rec = await env.CODES.get(`code:${c}`, "json");
  if (!rec) return { valid: false };
  const used = await num(env.CODES, `use:${c}:${month(now)}`);
  return { valid: !rec.revoked, revoked: !!rec.revoked, code: c, name: rec.name, limit: rec.limit, used, left: Math.max(0, rec.limit - used) };
}

async function hashNet(request, today) {
  const ip = request.headers.get("cf-connecting-ip") ?? "unknown";
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${ip}|${today}`));
  return Array.from(new Uint8Array(d).slice(0, 8), (x) => x.toString(16).padStart(2, "0")).join("");
}

/**
 * May this request make a speech check? Returns { ok: true, charge } (call charge() after the check
 * worked, so failed checks aren't counted) or { ok: false, status, body } to send back.
 * The code comes in header x-angelio-code.
 */
export async function checkSpeech(request, env, now = new Date()) {
  const noop = { ok: true, charge: async () => {} };
  if (env.REQUIRE_CODE !== "true") return noop;
  if (!env.CODES) return { ok: false, status: 503, body: { error: "speech checks aren't set up", reason: "setup" } };
  const kv = env.CODES, today = day(now);
  const capKey = `cap:speech:${today}`;
  if (await num(kv, capKey) >= Number(env.SPEECH_DAILY_CAP ?? 500)) {
    return { ok: false, status: 503, body: { error: "speech checks are resting for today", reason: "busy" } };
  }
  const sent = request.headers.get("x-angelio-code");
  if (sent) {
    const st = await codeStatus(env, sent, now);
    if (!st.valid) return { ok: false, status: 402, body: { error: "that family code doesn't work", reason: st.revoked ? "revoked" : "bad-code" } };
    if (st.left <= 0) return { ok: false, status: 402, body: { error: "this month's speech checks are used up", reason: "limit", limit: st.limit } };
    return { ok: true, left: st.left - 1, charge: () => Promise.all([bump(kv, `use:${st.code}:${month(now)}`, 60 * 60 * 24 * 400), bump(kv, capKey, 60 * 60 * 72)]) };
  }
  const freeKey = `free:${await hashNet(request, today)}:${today}`;
  const free = Number(env.FREE_PER_DAY ?? 3);
  if (await num(kv, freeKey) >= free) {
    return { ok: false, status: 402, body: { error: "a family code is needed for more speech checks today", reason: "need-code", free } };
  }
  return { ok: true, charge: () => Promise.all([bump(kv, freeKey, 60 * 60 * 48), bump(kv, capKey, 60 * 60 * 72)]) };
}

/** Site-wide daily safety cap for a feature (e.g. "tts"). { ok, charge }: ok is false when today's cap is reached. */
export async function dailyCap(env, kind, cap, now = new Date()) {
  if (!env.CODES || !cap) return { ok: true, charge: async () => {} };
  const k = `cap:${kind}:${day(now)}`;
  const ok = (await num(env.CODES, k)) < cap;
  return { ok, charge: (by = 1) => bump(env.CODES, k, 60 * 60 * 72, by) };
}
