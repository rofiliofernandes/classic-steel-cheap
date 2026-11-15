import { Hono } from "hono";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";

type Env = {
  DB: D1Database;
  MEDIA?: R2Bucket;
  ASSETS: Fetcher;
  SESSION_SECRET: string;
  SESSION_KEY?: string;
  TOKEN_ENCRYPTION_KEY?: string;
  RESEND_API_KEY?: string;
  RESEND_FROM_EMAIL?: string;
  ADMIN_OWNER_EMAIL?: string;
  SITE_NAME: string;
  PHONE: string;
  MAPS_URL: string;
  ADMIN_HOST?: string;
  INSTAGRAM_ACCESS_TOKEN?: string;
  INSTAGRAM_USER_ID?: string;
  INSTAGRAM_GRAPH_VERSION?: string;
  INSTAGRAM_APP_ID?: string;
  INSTAGRAM_APP_SECRET?: string;
  INSTAGRAM_REDIRECT_URI?: string;
  STORAGE_LIMIT_GB?: string;
};
const app = new Hono<{ Bindings: Env }>();
function hostMatchesConfiguredAdmin(c: any) {
  const configured = String(c.env.ADMIN_HOST || "")
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/$/, "");
  if (!configured) return false;
  const requestHost = new URL(c.req.url).host.toLowerCase();
  return requestHost === configured || requestHost.split(":")[0] === configured.split(":")[0];
}
app.use("*", async (c, next) => {
  const sensitive =
    c.req.path.startsWith("/admin") ||
    c.req.path.startsWith("/api/admin") ||
    ["/api/login", "/api/logout", "/api/me", "/api/setup", "/api/setup/status"].includes(c.req.path);
  if (sensitive && !hostMatchesConfiguredAdmin(c)) return c.notFound();
  if (
    c.req.method !== "GET" &&
    c.req.method !== "HEAD" &&
    c.req.method !== "OPTIONS" &&
    (c.req.path.startsWith("/api/admin") ||
      ["/api/login", "/api/logout", "/api/setup/request-code", "/api/setup/verify-code", "/api/setup/create"].includes(c.req.path)) &&
    !sameOriginRequest(c)
  )
    return c.json({ error: "Invalid request origin" }, 403);
  await next();
});
app.use("*", async (c, next) => {
  await next();
  c.header("X-Content-Type-Options", "nosniff");
  c.header("Referrer-Policy", "strict-origin-when-cross-origin");
  c.header("X-Frame-Options", "DENY");
  c.header("Permissions-Policy", "camera=(),microphone=(),geolocation=()");
  c.header(
    "Content-Security-Policy",
    "default-src 'self'; img-src 'self' data: https:; media-src 'self' https:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; script-src 'self'; frame-src https://www.google.com https://maps.google.com; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'",
  );
});
const enc = new TextEncoder();
async function hmac(env: Env, value: string) {
  if (!(env.SESSION_KEY || env.SESSION_SECRET) || (env.SESSION_KEY || env.SESSION_SECRET).length < 32) throw new Error("SESSION_SECRET is not configured correctly");
  const k = await crypto.subtle.importKey("raw", enc.encode((env.SESSION_KEY || env.SESSION_SECRET)), { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
    "verify",
  ]);
  return crypto.subtle.sign("HMAC", k, enc.encode(value)).then((x) => btoa(String.fromCharCode(...new Uint8Array(x))));
}
function b64u(bytes: ArrayBuffer | Uint8Array) {
  const a = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  return btoa(String.fromCharCode(...a))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}
function unb64u(s: string) {
  const t = s.replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(t + "=".repeat((4 - (t.length % 4)) % 4)), (x) => x.charCodeAt(0));
}
async function tokenKey(env: Env, legacy = false) {
  const secret = legacy || !env.TOKEN_ENCRYPTION_KEY ? (env.SESSION_KEY || env.SESSION_SECRET) : env.TOKEN_ENCRYPTION_KEY!;
  const digest = await crypto.subtle.digest("SHA-256", enc.encode(secret));
  return crypto.subtle.importKey("raw", digest, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
}
async function encryptToken(env: Env, value: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await tokenKey(env), enc.encode(value));
  return `${b64u(iv)}.${b64u(ct)}`;
}
async function decryptToken(env: Env, value: string) {
  const [ivS, ctS] = value.split(".");
  if (!ivS || !ctS) throw new Error("Invalid encrypted token");
  try {
    const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64u(ivS) }, await tokenKey(env), unb64u(ctS));
    return new TextDecoder().decode(pt);
  } catch (e) {
    if (env.TOKEN_ENCRYPTION_KEY) {
      const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64u(ivS) }, await tokenKey(env, true), unb64u(ctS));
      return new TextDecoder().decode(pt);
    }
    throw e;
  }
}
async function instagramRedirect(c: any) {
  return c.env.INSTAGRAM_REDIRECT_URI || new URL("/api/instagram/callback", c.req.url).toString();
}
async function getInstagramConnection(c: any) {
  const row: any = await c.env.DB.prepare("SELECT * FROM instagram_integrations WHERE provider=? LIMIT 1").bind("instagram").first();
  if (row?.access_token_enc) {
    try {
      return { ...row, access_token: await decryptToken(c.env, row.access_token_enc) };
    } catch {}
  }
  if (c.env.INSTAGRAM_ACCESS_TOKEN && c.env.INSTAGRAM_USER_ID)
    return {
      provider: "instagram",
      user_id: c.env.INSTAGRAM_USER_ID,
      access_token: c.env.INSTAGRAM_ACCESS_TOKEN,
      username: null,
      expires_at: null,
    };
  return null;
}
async function refreshInstagramToken(c: any, conn: any) {
  if (!conn?.access_token) return conn;
  const version = c.env.INSTAGRAM_GRAPH_VERSION || "v24.0";
  if (conn.expires_at && Number(conn.expires_at) - Date.now() > 7 * 86400000) return conn;
  if (!c.env.INSTAGRAM_APP_SECRET) return conn;
  const u = new URL(`https://graph.instagram.com/${version}/refresh_access_token`);
  u.searchParams.set("grant_type", "ig_refresh_token");
  u.searchParams.set("access_token", conn.access_token);
  const r = await fetch(u);
  const d: any = await r.json();
  if (!r.ok || !d.access_token) return conn;
  const expiresAt = Date.now() + Number(d.expires_in || 5184000) * 1000;
  await c.env.DB.prepare("UPDATE instagram_integrations SET access_token_enc=?,expires_at=?,updated_at=CURRENT_TIMESTAMP WHERE provider=?")
    .bind(await encryptToken(c.env, d.access_token), expiresAt, "instagram")
    .run();
  return { ...conn, access_token: d.access_token, expires_at: expiresAt };
}
async function refreshInstagramMediaUrl(c: any, mediaId: string): Promise<string | null> {
  try {
    const conn = await getInstagramConnection(c);
    if (!conn) return null;
    const fresh = await refreshInstagramToken(c, conn);
    const version = c.env.INSTAGRAM_GRAPH_VERSION || "v24.0";
    const u = new URL(`https://graph.instagram.com/${version}/${encodeURIComponent(mediaId)}`);
    u.searchParams.set("fields", "media_url");
    u.searchParams.set("access_token", fresh.access_token);
    const r = await fetch(u);
    const d: any = await r.json().catch(() => ({}));
    if (!r.ok || !d.media_url) return null;
    return String(d.media_url);
  } catch {
    return null;
  }
}
const PASSWORD_ITERATIONS = 100000;
const DEFAULT_STORAGE_LIMIT_GB = 10;
function storageLimitBytes(env: Env) {
  const gb = Number(env.STORAGE_LIMIT_GB || DEFAULT_STORAGE_LIMIT_GB);
  return Math.round((Number.isFinite(gb) && gb > 0 ? gb : DEFAULT_STORAGE_LIMIT_GB) * 1024 * 1024 * 1024);
}
const MAX_IMAGE_UPLOAD_BYTES = 30 * 1024 * 1024;
// Cloudflare Workers accept request bodies up to 100 MB on Free/Pro plans.
const MAX_VIDEO_UPLOAD_BYTES = 95 * 1024 * 1024;
const MAX_INSTAGRAM_VIDEO_BYTES = 300 * 1024 * 1024;
const VIDEO_TYPES: Record<string, string> = { "video/mp4": "mp4", "video/webm": "webm", "video/quicktime": "mov" };
const MAX_GALLERY_SLOTS = 21;
const MIN_GALLERY_SLOTS = 3;
const MAX_PINNED_SLOTS = 5;
const DEFAULT_GALLERY_CONFIG =
  '{"slots":[{"type":"category","category":"Other"},{"type":"category","category":"Other"},{"type":"category","category":"Other"},{"type":"category","category":"Other"},{"type":"category","category":"Other"},{"type":"category","category":"Other"},{"type":"category","category":"Other"},{"type":"category","category":"Other"},{"type":"category","category":"Other"},{"type":"category","category":"Other"},{"type":"category","category":"Other"},{"type":"category","category":"Other"},{"type":"category","category":"Other"},{"type":"category","category":"Other"},{"type":"category","category":"Other"}],"columns":3}';
const DEFAULT_ABOUT_TEXT =
  "Capital UPVC Windows & Doors focuses on custom openings for homes and buildings, combining modern profiles with practical everyday use.\n\nEvery opening is different. We work around the opening, the room, the view and the way the door or window needs to be used — so the result looks at home rather than feeling added on.";
async function hashPassword(p: string) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey("raw", enc.encode(p), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt, iterations: PASSWORD_ITERATIONS, hash: "SHA-256" }, key, 256);
  return `pbkdf2$${PASSWORD_ITERATIONS}$${btoa(String.fromCharCode(...salt))}$${btoa(String.fromCharCode(...new Uint8Array(bits)))}`;
}
async function verifyPassword(p: string, stored: string) {
  try {
    const [, it, s, b] = stored.split("$");
    const salt = Uint8Array.from(atob(s), (x) => x.charCodeAt(0));
    const key = await crypto.subtle.importKey("raw", enc.encode(p), "PBKDF2", false, ["deriveBits"]);
    const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt, iterations: Number(it), hash: "SHA-256" }, key, 256);
    return btoa(String.fromCharCode(...new Uint8Array(bits))) === b;
  } catch {
    return false;
  }
}
async function session(c: any, env: Env) {
  const id = getCookie(c, "ip_session");
  if (!id) return null;
  const sig = getCookie(c, "ip_sig");
  if (!sig || (await hmac(env, id)) !== sig) return null;
  return c.env.DB.prepare(
    "SELECT a.id,a.name,a.email,a.role FROM sessions s JOIN admins a ON a.id=s.admin_id WHERE s.id=? AND s.expires_at>? AND a.active=1",
  )
    .bind(id, Date.now())
    .first();
}
function uid() {
  return crypto.randomUUID();
}
function clientIp(c: any) {
  return (c.req.header("CF-Connecting-IP") || c.req.header("X-Forwarded-For") || "unknown").split(",")[0].trim().slice(0, 80);
}
function sameOriginRequest(c: any) {
  const origin = c.req.header("Origin");
  if (origin) {
    try {
      return new URL(origin).origin === new URL(c.req.url).origin;
    } catch {
      return false;
    }
  }
  const referer = c.req.header("Referer");
  if (referer) {
    try {
      return new URL(referer).origin === new URL(c.req.url).origin;
    } catch {
      return false;
    }
  }
  return true;
}
function textField(v: any, max: number) {
  return String(v ?? "")
    .trim()
    .slice(0, max);
}
function validEmail(v: any) {
  const e = String(v ?? "")
    .trim()
    .toLowerCase();
  return e.length <= 320 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
}
function boundedInt(v: any, min: number, max: number, def = 0) {
  const n = Number(v);
  return Number.isInteger(n) && n >= min && n <= max ? n : def;
}
function finiteNumber(v: any, min: number, max: number, def = 0) {
  const n = Number(v);
  return Number.isFinite(n) && n >= min && n <= max ? n : def;
}
function validMediaUrl(v: string) {
  if (!v) return true;
  if (v.startsWith("/media/")) return true;
  try {
    const u = new URL(v);
    return u.protocol === "https:" || u.protocol === "http:";
  } catch {
    return false;
  }
}
async function clearRateLimit(c: any, ...keys: string[]) {
  if (keys.length) await c.env.DB.batch(keys.map((k) => c.env.DB.prepare("DELETE FROM auth_rate_limits WHERE key=?").bind(k)));
}
async function rateLimit(c: any, key: string, max: number, windowMs: number, blockMs = windowMs) {
  const now = Date.now();
  const row: any = await c.env.DB.prepare("SELECT window_start,count,blocked_until FROM auth_rate_limits WHERE key=?").bind(key).first();
  if (row?.blocked_until && Number(row.blocked_until) > now) return false;
  const start = Number(row?.window_start || 0);
  if (!row || now - start >= windowMs) {
    await c.env.DB.prepare(
      "INSERT INTO auth_rate_limits(key,window_start,count,blocked_until) VALUES(?,?,1,0) ON CONFLICT(key) DO UPDATE SET window_start=excluded.window_start,count=1,blocked_until=0",
    )
      .bind(key, now)
      .run();
    return true;
  }
  const count = Number(row.count || 0) + 1;
  const blocked = count > max;
  await c.env.DB.prepare("UPDATE auth_rate_limits SET count=?,blocked_until=? WHERE key=?")
    .bind(count, blocked ? now + blockMs : 0, key)
    .run();
  return !blocked;
}
function setupOwnerEmails(env: Env) {
  return String(env.ADMIN_OWNER_EMAIL || "")
    .split(",")
    .map((x) => x.trim().toLowerCase())
    .filter(Boolean);
}
async function storageUsed(c: any) {
  const used: any = await c.env.DB.prepare(
    "SELECT (SELECT COALESCE(SUM(bytes),0) FROM photos WHERE r2_key IS NOT NULL)+(SELECT COALESCE(SUM(bytes),0) FROM videos WHERE thumbnail_url LIKE '/media/%')+(SELECT COALESCE(SUM(file_bytes),0) FROM videos WHERE media_url LIKE '/media/%') bytes",
  ).first();
  return Number(used?.bytes || 0);
}
async function reserveStorage(c: any, id: string, bytes: number) {
  if (!c.env.MEDIA) return true;
  const used = await storageUsed(c);
  const r = await c.env.DB.prepare("UPDATE storage_quota SET reserved_bytes=reserved_bytes+? WHERE id=1 AND reserved_bytes+?+?<=?")
    .bind(bytes, bytes, used, storageLimitBytes(c.env))
    .run();
  if (Number(r.meta?.changes || 0) !== 1) return false;
  try {
    await c.env.DB.prepare("INSERT INTO storage_reservations(id,bytes,expires_at) VALUES(?,?,?)")
      .bind(id, bytes, Date.now() + 20 * 60 * 1000)
      .run();
    return true;
  } catch (e) {
    await c.env.DB.prepare("UPDATE storage_quota SET reserved_bytes=MAX(0,reserved_bytes-?) WHERE id=1").bind(bytes).run();
    throw e;
  }
}
async function releaseStorage(c: any, id: string) {
  const row: any = await c.env.DB.prepare("SELECT bytes FROM storage_reservations WHERE id=?").bind(id).first();
  if (!row) return;
  await c.env.DB.batch([
    c.env.DB.prepare("DELETE FROM storage_reservations WHERE id=?").bind(id),
    c.env.DB.prepare("UPDATE storage_quota SET reserved_bytes=MAX(0,reserved_bytes-?) WHERE id=1").bind(Number(row.bytes || 0)),
  ]);
}
async function finalizeStorage(c: any, id: string) {
  return releaseStorage(c, id);
}

function normalizeInstagramHashtag(value: string) {
  return String(value || "")
    .trim()
    .replace(/^#+/, "")
    .toLowerCase();
}
function captionHashtags(caption: string) {
  return (caption.match(/#[\p{L}0-9_-]+/gu) || []).map(normalizeInstagramHashtag);
}
function matchedCategories(caption: string, serviceRows: any[], aliasRows: any[] = []): string[] {
  const tags = captionHashtags(caption);
  if (!tags.length) return [];
  const serviceMatches = new Set<string>();
  for (const row of serviceRows) {
    const aliases = String(row.instagram_hashtags || "")
      .split(/[,\n]+/)
      .map(normalizeInstagramHashtag)
      .filter(Boolean);
    if (aliases.some((alias) => alias && tags.some((tag) => tag.includes(alias)))) serviceMatches.add(String(row.title));
  }
  for (const row of aliasRows) {
    const alias = normalizeInstagramHashtag(String(row.hashtag || ""));
    if (alias && tags.some((tag) => tag.includes(alias))) serviceMatches.add(String(row.category));
  }
  if (serviceMatches.size) return Array.from(serviceMatches);
  const legacy: [string, string[]][] = [
    ["Windows", ["window", "casement"]],
    ["Doors", ["door"]],
    ["Wood-finish", ["wood"]],
    ["Large openings", ["largeopening", "facade", "glazing"]],
  ];
  const legacyMatches = new Set<string>();
  for (const [name, aliases] of legacy) {
    if (aliases.some((alias) => tags.some((tag) => tag.includes(alias)))) legacyMatches.add(name);
  }
  return Array.from(legacyMatches);
}
function instagramCategory(caption: string, serviceRows: any[]) {
  const m = matchedCategories(caption, serviceRows);
  return m[0] || "Other";
}
function unmatchedHashtags(caption: string, serviceRows: any[], aliasRows: any[] = []): string[] {
  const tags = captionHashtags(caption);
  if (!tags.length) return [];
  const known = new Set<string>();
  for (const row of serviceRows) {
    for (const a of String(row.instagram_hashtags || "")
      .split(/[,\n]+/)
      .map(normalizeInstagramHashtag)
      .filter(Boolean))
      known.add(a);
  }
  for (const row of aliasRows) {
    const alias = normalizeInstagramHashtag(String(row.hashtag || ""));
    if (alias) known.add(alias);
  }
  for (const a of ["beach", "birthday", "family", "maternity", "portfolio", "prewedding", "wedding"]) known.add(a);
  const knownList = Array.from(known);
  return Array.from(new Set(tags.filter((tag) => tag && !knownList.some((alias) => alias && tag.includes(alias)))));
}
async function ensureCategoryAliasSchema(c: any) {
  await c.env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS category_hashtag_aliases (hashtag TEXT PRIMARY KEY,category TEXT NOT NULL,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
  ).run();
}
async function ensureHashtagSightingsSchema(c: any) {
  await c.env.DB.batch([
    c.env.DB.prepare(
      `CREATE TABLE IF NOT EXISTS hashtag_sightings (hashtag TEXT PRIMARY KEY,count INTEGER NOT NULL DEFAULT 1,last_seen TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,sample_caption TEXT DEFAULT '',dismissed INTEGER NOT NULL DEFAULT 0)`,
    ),
  ]);
}
async function requireAuth(c: any, next: any) {
  const a = await session(c, c.env);
  if (!a) return c.json({ error: "Unauthorized" }, 401);
  c.set("admin", a);
  await next();
}
async function instagramAuthorize(c: any) {
  if (!c.env.INSTAGRAM_APP_ID) return c.text("Instagram connection is not configured on this Worker.", 500);
  const state = uid();
  const sig = await hmac(c.env, state);
  setCookie(c, "ig_oauth_state", `${state}.${sig}`, { httpOnly: true, secure: true, sameSite: "Lax", path: "/api/instagram", maxAge: 600 });
  const u = new URL("https://www.instagram.com/oauth/authorize");
  u.searchParams.set("force_reauth", "true");
  u.searchParams.set("client_id", c.env.INSTAGRAM_APP_ID);
  u.searchParams.set("redirect_uri", await instagramRedirect(c));
  u.searchParams.set("response_type", "code");
  u.searchParams.set("scope", "instagram_business_basic");
  u.searchParams.set("state", state);
  return c.redirect(u.toString(), 302);
}
app.get("/api/instagram/connect", requireAuth, async (c) => instagramAuthorize(c));
app.post("/api/admin/instagram/connect-link", requireAuth, async (c) => {
  if (!c.env.INSTAGRAM_APP_ID || !c.env.INSTAGRAM_APP_SECRET)
    return c.json({ error: "Instagram app credentials are not configured on this Worker." }, 500);
  const raw = b64u(crypto.getRandomValues(new Uint8Array(32)));
  const tokenHash = await sha256(raw);
  const expiresAt = Date.now() + 30 * 60 * 1000;
  await c.env.DB.prepare("DELETE FROM instagram_connection_links WHERE expires_at<=? OR used_at IS NOT NULL").bind(Date.now()).run();
  await c.env.DB.prepare("INSERT INTO instagram_connection_links(token_hash,expires_at) VALUES(?,?)").bind(tokenHash, expiresAt).run();
  const url = new URL(`/api/instagram/connect-link/${raw}`, c.req.url).toString();
  return c.json({ ok: true, url, expiresAt });
});
app.get("/api/instagram/connect-link/:token", async (c) => {
  const token = c.req.param("token");
  if (!/^[A-Za-z0-9_-]{40,60}$/.test(token)) return c.text("Invalid connection link.", 400);
  const row: any = await c.env.DB.prepare("SELECT expires_at,used_at FROM instagram_connection_links WHERE token_hash=?")
    .bind(await sha256(token))
    .first();
  if (!row || row.used_at || Number(row.expires_at) <= Date.now())
    return c.html("<h2>Connection link expired</h2><p>Please ask the website admin to create a new Instagram connection link.</p>", 410);
  return c.html(
    `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Connect Instagram · Capital UPVC</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#080c0f;color:#f5f7f8;font-family:Arial,sans-serif}.card{width:min(460px,88vw);padding:32px;border:1px solid #273137;border-radius:20px;background:#11181d;text-align:center}.eyebrow{color:#e5c38d;font-size:11px;letter-spacing:.2em;font-weight:800}.card h1{font:600 36px Georgia,serif;margin:12px 0}.card p{color:#9da8ae;line-height:1.6}.btn{display:inline-block;margin-top:12px;padding:13px 20px;border-radius:999px;background:#f5f7f8;color:#080c0f;text-decoration:none;font-weight:700;border:0;cursor:pointer}</style></head><body><main class="card"><div class="eyebrow">CAPITAL UPVC</div><h1>Connect Instagram</h1><p>This secure link lets you authorize the Capital UPVC website to access your Instagram media. You will log in to Instagram yourself. Your password is never shared with the website.</p><form method="post" action="/api/instagram/connect-link/${token}/start" target="_blank" rel="noopener noreferrer"><button class="btn" type="submit">Continue in Browser</button></form><p>This link expires in 30 minutes and is consumed only after Instagram is connected successfully. Instagram will open in a new browser tab so you can complete the authorization on the web. If you cancel or go back, you can try again with the same link while it is still valid.</p></main></body></html>`,
  );
});
app.post("/api/instagram/connect-link/:token/start", async (c) => {
  const token = c.req.param("token");
  if (!/^[A-Za-z0-9_-]{40,60}$/.test(token)) return c.text("Invalid connection link.", 400);
  const now = Date.now();
  const row: any = await c.env.DB.prepare("SELECT expires_at,used_at FROM instagram_connection_links WHERE token_hash=?")
    .bind(await sha256(token))
    .first();
  if (!row || row.used_at || Number(row.expires_at) <= now)
    return c.html("<h2>Connection link expired</h2><p>Please ask the website admin to create a new Instagram connection link.</p>", 410);
  setCookie(c, "ig_connect_token", token, { httpOnly: true, secure: true, sameSite: "Lax", path: "/api/instagram", maxAge: 600 });
  return instagramAuthorize(c);
});
app.get("/api/instagram/callback", async (c) => {
  const err = c.req.query("error");
  const connectToken = getCookie(c, "ig_connect_token");
  if (err)
    return c.html(
      `<h2>Instagram connection cancelled</h2><p>The connection was not completed, so your invitation link is still valid.</p><p>You can close this window and use the same link again while it is within its 30-minute validity period.</p>`,
    );
  let code = c.req.query("code");
  if (code) code = code.replace(/#_$/, "").replace(/%23_$/i, "").trim();
  const state = c.req.query("state");
  const saved = getCookie(c, "ig_oauth_state");
  deleteCookie(c, "ig_oauth_state", { path: "/api/instagram" });
  if (!code) return c.text("Instagram did not return an authorization code.", 400);
  if (!state || !saved) {
    return c.text("Instagram connection state is missing. Please start again from the connection link.", 400);
  }
  const [savedState, savedSig] = saved.split(".");
  if (state !== savedState || savedSig !== (await hmac(c.env, state)))
    return c.text("Instagram connection state could not be verified. Please start again.", 400);
  if (!c.env.INSTAGRAM_APP_ID || !c.env.INSTAGRAM_APP_SECRET)
    return c.text("Instagram app credentials are not configured on this Worker.", 500);
  const redirectUri = await instagramRedirect(c);
  try {
    const shortResp = await fetch("https://api.instagram.com/oauth/access_token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: c.env.INSTAGRAM_APP_ID,
        client_secret: c.env.INSTAGRAM_APP_SECRET,
        grant_type: "authorization_code",
        redirect_uri: redirectUri,
        code,
      }),
    });
    const short: any = await shortResp.json();
    if (!shortResp.ok || !short.access_token)
      throw new Error(short?.error_message || short?.error?.message || "Instagram token exchange failed");
    const longUrl = new URL("https://graph.instagram.com/access_token");
    longUrl.searchParams.set("grant_type", "ig_exchange_token");
    longUrl.searchParams.set("client_secret", c.env.INSTAGRAM_APP_SECRET);
    longUrl.searchParams.set("access_token", short.access_token);
    const longResp = await fetch(longUrl);
    const long: any = await longResp.json();
    if (!longResp.ok || !long.access_token)
      throw new Error(long?.error?.message || long?.error_message || "Instagram long-lived token exchange failed");
    const version = c.env.INSTAGRAM_GRAPH_VERSION || "v24.0";
    const meUrl = new URL(`https://graph.instagram.com/${version}/me`);
    meUrl.searchParams.set("fields", "id,username");
    meUrl.searchParams.set("access_token", long.access_token);
    const meResp = await fetch(meUrl);
    const me: any = await meResp.json();
    if (!meResp.ok || !me.id) throw new Error(me?.error?.message || "Could not read the connected Instagram account");
    const expiresAt = Date.now() + Number(long.expires_in || 5184000) * 1000;
    await c.env.DB.prepare(
      `INSERT INTO instagram_integrations(provider,user_id,username,access_token_enc,expires_at,created_at,updated_at) VALUES(?,?,?,?,?,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP) ON CONFLICT(provider) DO UPDATE SET user_id=excluded.user_id,username=excluded.username,access_token_enc=excluded.access_token_enc,expires_at=excluded.expires_at,updated_at=CURRENT_TIMESTAMP`,
    )
      .bind("instagram", String(me.id), String(me.username || ""), await encryptToken(c.env, String(long.access_token)), expiresAt)
      .run();
    if (connectToken) {
      const consumed: any = await c.env.DB.prepare(
        "UPDATE instagram_connection_links SET used_at=? WHERE token_hash=? AND used_at IS NULL AND expires_at>?",
      )
        .bind(Date.now(), await sha256(connectToken), Date.now())
        .run();
      if (Number(consumed.meta?.changes || 0) !== 1) {
        console.error("INSTAGRAM_CONNECT_LINK_CONSUME_FAILED");
      }
    }
    deleteCookie(c, "ig_connect_token", { path: "/api/instagram" });
    return c.html(
      `<h2>Instagram connected successfully</h2><p>Connected account: <strong>${String(me.username || me.id).replace(/[<>]/g, "")}</strong></p><p>You can close this window and return to the website.</p>`,
    );
  } catch (e: any) {
    console.error("INSTAGRAM_OAUTH_ERROR", e?.name || "Error", e?.message || String(e));
    return c.html(
      `<h2>Instagram connection failed</h2><p>We could not complete the Instagram connection. Please start again.</p><p>You can close this window and return to the website.</p>`,
      500,
    );
  }
});
app.get("/api/instagram/status", requireAuth, async (c) => {
  const conn = await getInstagramConnection(c);
  return c.json({ connected: Boolean(conn), username: conn?.username || null });
});
function pickGallerySlotGroups(slots: any[], published: any[]): ({ photos: any[] } | null)[] {
  const groupKey = (p: any) => String(p?.group_id || p?.id);
  const autoPool = published.filter((p) => !p.excluded_from_auto);
  const groups = new Map<string, any[]>();
  for (const p of autoPool) {
    const key = groupKey(p);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(p);
  }
  for (const list of groups.values()) list.sort((a, b) => Number(a.group_order || 0) - Number(b.group_order || 0));
  const rep = (key: string) =>
    groups
      .get(key)!
      .slice()
      .sort((a, b) => Number(b.total_score || 0) - Number(a.total_score || 0))[0];
  const byCategory = new Map<string, string[]>();
  for (const key of groups.keys()) {
    const cat = String(rep(key).category || rep(key).occasion || "Other");
    if (!byCategory.has(cat)) byCategory.set(cat, []);
    byCategory.get(cat)!.push(key);
  }
  for (const list of byCategory.values()) list.sort((a, b) => Number(rep(b).total_score || 0) - Number(rep(a).total_score || 0));
  const allSortedKeys = [...groups.keys()].sort((a, b) => Number(rep(b).total_score || 0) - Number(rep(a).total_score || 0));
  const byId = new Map(published.map((p) => [String(p.id), p]));
  const dayBucket = Math.floor(Date.now() / 86400000);
  const used = new Set<string>();
  const result: ({ photos: any[] } | null)[] = [];
  for (const slot of slots || []) {
    if (slot?.type === "pinned") {
      const p = byId.get(String(slot.photo_id));
      if (p && !used.has(groupKey(p))) {
        const key = groupKey(p);
        used.add(key);
        result.push({ photos: groups.get(key) || [p] });
      } else result.push(null);
      continue;
    }
    const cat = String(slot?.category || "Other");
    let pool = (byCategory.get(cat) || []).filter((k) => !used.has(k));
    if (!pool.length) pool = allSortedKeys.filter((k) => !used.has(k));
    if (!pool.length) {
      result.push(null);
      continue;
    }
    const topN = pool.slice(0, Math.min(5, pool.length));
    const pickKey = topN[dayBucket % topN.length];
    used.add(pickKey);
    result.push({ photos: groups.get(pickKey) || [] });
  }
  return result;
}
function resolveGallerySlots(slots: any[], published: any[]): any[] {
  return pickGallerySlotGroups(slots, published).flatMap((g) => (g ? g.photos : []));
}
function resolveGallerySlotsAligned(slots: any[], published: any[]): any[] {
  return pickGallerySlotGroups(slots, published).map((g) => (g ? g.photos[0] : null));
}
async function ensureInterimTestimonialsTable(c: any) {
  await c.env.DB.prepare(
    "CREATE TABLE IF NOT EXISTS testimonials (id TEXT PRIMARY KEY,source TEXT NOT NULL DEFAULT 'manual',author_name TEXT NOT NULL,rating INTEGER NOT NULL DEFAULT 5,review_text TEXT NOT NULL DEFAULT '',relative_time TEXT DEFAULT '',verified INTEGER NOT NULL DEFAULT 1,active INTEGER NOT NULL DEFAULT 1,sort_order INTEGER NOT NULL DEFAULT 0,image_url TEXT DEFAULT '',created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)",
  ).run();
}
async function getInterimTestimonials(c: any, googleError?: boolean) {
  await ensureInterimTestimonialsTable(c);
  const rows: any = await c.env.DB.prepare(
    "SELECT id,author_name,rating,review_text,relative_time,verified,image_url FROM testimonials WHERE active=1 ORDER BY sort_order,created_at DESC LIMIT 8",
  ).all();
  const reviews = rows.results || [];
  if (!reviews.length) return { configured: false, aggregate: null, reviews: [], googleError: !!googleError };
  const agg: any = await c.env.DB.prepare("SELECT AVG(rating) avgr,COUNT(*) n FROM testimonials WHERE active=1").first();
  return {
    configured: false,
    aggregate: {
      rating: Math.round(Number(agg?.avgr || 5) * 10) / 10,
      count: Number(agg?.n || reviews.length),
      source_label: "Client reviews",
      source: "interim",
    },
    reviews,
    googleError: !!googleError,
  };
}
const FESTIVAL_COPY: Record<string, { kicker: string; title: string; copy: string; accent: string }> = {
  ganesh: {
    kicker: "WISHING YOU",
    title: "Happy Ganesh Chaturthi!",
    copy: "May Lord Ganesha bless you and your family with happiness, prosperity and safe journeys.",
    accent: "#e07b1f",
  },
  diwali: {
    kicker: "WISHING YOU",
    title: "Happy Diwali!",
    copy: "May the festival of lights fill your home with happiness, peace and prosperity. Wishing you a joyful Diwali.",
    accent: "#c9a15f",
  },
  christmas: {
    kicker: "WISHING YOU",
    title: "Merry Christmas!",
    copy: "May the joy of this season fill your heart with love, peace and happiness. Wishing you and your family a wonderful Christmas.",
    accent: "#e2544f",
  },
  eid: {
    kicker: "WISHING YOU",
    title: "Eid Mubarak!",
    copy: "Wishing you and your family peace, happiness and good health this Eid.",
    accent: "#4fb37e",
  },
  newyear: {
    kicker: "WISHING YOU",
    title: "Happy New Year!",
    copy: "May the new year bring new beginnings, happiness and many wonderful moments. Here\u2019s to a great year ahead.",
    accent: "#c9a15f",
  },
  independence: {
    kicker: "WISHING YOU",
    title: "Happy Independence Day!",
    copy: "Wishing everyone a proud and meaningful Independence Day.",
    accent: "#e07b1f",
  },
  anniversary: {
    kicker: "WISHING YOU",
    title: "Celebrating Another Year!",
    copy: "Today marks another year of Capital UPVC Windows & Doors \u2014 thank you to every home and business that trusted us with their openings. Here\u2019s to many more.",
    accent: "#c9a15f",
  },
};
// Business anniversary banner. Set the month/day and founding year to enable it (null = no anniversary banner).
const ANNIVERSARY: { month: number; day: number; foundingYear: number } | null = null;
const FOUNDING_YEAR = ANNIVERSARY?.foundingYear || new Date().getUTCFullYear() - 1;
function ordinal(n: number): string {
  const j = n % 10,
    k = n % 100;
  if (j === 1 && k !== 11) return n + "st";
  if (j === 2 && k !== 12) return n + "nd";
  if (j === 3 && k !== 13) return n + "rd";
  return n + "th";
}
function anniversaryCopy(now: Date = istNow()) {
  const years = now.getUTCFullYear() - FOUNDING_YEAR;
  return {
    kicker: "WISHING YOU",
    title: `Happy ${ordinal(years)} Anniversary!`,
    copy: `Today marks ${years} years of Capital UPVC Windows & Doors \u2014 thank you to every home and business that trusted us with their openings. Here's to many more.`,
    accent: "#c9a15f",
  };
}
function festivalCopyFor(key: string): { kicker: string; title: string; copy: string; accent: string } {
  return key === "anniversary" ? anniversaryCopy() : FESTIVAL_COPY[key];
}
function istNow(): Date {
  return new Date(Date.now() + 5.5 * 3600000);
}
const DEFAULT_FESTIVAL_DATES: Record<string, { start: string; end: string }> = {
  ganesh: { start: "2026-09-14", end: "2026-09-16" },
  diwali: { start: "2026-11-06", end: "2026-11-10" },
  eid: { start: "2026-03-20", end: "2026-03-22" },
};
function getActiveFestivalKey(now: Date = istNow(), movableDates: Record<string, { start?: string; end?: string }> = {}): string | null {
  const y = now.getUTCFullYear(),
    m = now.getUTCMonth() + 1,
    d = now.getUTCDate();
  const key = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  if (m === 1 && d <= 2) return "newyear";
  if (m === 8 && d === 15) return "independence";
  if (ANNIVERSARY && m === ANNIVERSARY.month && d === ANNIVERSARY.day) return "anniversary";
  if (m === 12 && d >= 24 && d <= 26) return "christmas";
  for (const k of ["ganesh", "diwali", "eid"]) {
    const range = movableDates[k] || DEFAULT_FESTIVAL_DATES[k];
    if (range?.start && range?.end && key >= range.start && key <= range.end) return k;
  }
  return null;
}
app.get("/api/public", async (c) => {
  await ensureV3Schema(c);
  const [s, v, p, settings, igRow, reviewsData] = await Promise.all([
    c.env.DB.prepare(
      "SELECT id,title,description,image_url,active,sort_order,instagram_hashtags FROM services WHERE active=1 ORDER BY sort_order,id",
    ).all(),
    c.env.DB.prepare(
      "SELECT id,title,platform,category,thumbnail_url,media_url,source_url,sort_order FROM videos WHERE active=1 AND platform IN ('upload','instagram') AND media_url IS NOT NULL AND media_url<>'' AND (platform='upload' OR media_url LIKE '/media/%') ORDER BY sort_order,id",
    ).all(),
    c.env.DB.prepare(
      "SELECT id,source,source_id,image_url,caption,occasion,category,created_at,group_id,group_order,total_score,focal_x,focal_y,focal_zoom,focal_x_mobile,focal_y_mobile,focal_zoom_mobile,focal_x_hero,focal_y_hero,focal_zoom_hero,focal_x_hero_mobile,focal_y_hero_mobile,focal_zoom_hero_mobile,excluded_from_auto FROM photos WHERE published=1 ORDER BY created_at DESC LIMIT 300",
    ).all(),
    c.env.DB.prepare("SELECT key,value FROM site_settings").all(),
    c.env.DB.prepare("SELECT username FROM instagram_integrations WHERE provider='instagram'")
      .first<any>()
      .catch(() => null),
    getInterimTestimonials(c),
  ]);
  const cfg: any = {};
  for (const row of settings.results || []) {
    try {
      cfg[row.key] = JSON.parse(row.value);
    } catch {
      cfg[row.key] = row.value;
    }
  }
  const published = (p.results || []) as any[];
  const byId = new Map(published.map((x) => [String(x.id), x]));
  const resolve = (ids: any[]) => ids.map((id) => byId.get(String(id))).filter(Boolean);
  const heroCfg = cfg.hero_config
    ? { count: 4, source: "latest_instagram", photo_ids: [], interval: 7, transition: "normal", scrollReveal: false, ...cfg.hero_config }
    : { count: 4, source: "latest_instagram", photo_ids: [], interval: 7, transition: "normal", scrollReveal: false };
  const galleryCfg = cfg.gallery_config || JSON.parse(DEFAULT_GALLERY_CONFIG);
  const stripPhotos = resolve(cfg.strip_config?.photo_ids || []);
  const stripIds = new Set(stripPhotos.map((x: any) => String(x.id)));
  const latestInstagram = published
    .filter((x) => String(x.source || "").toLowerCase() === "instagram" && !x.excluded_from_auto && !stripIds.has(String(x.id)))
    .slice(0, Number(heroCfg.count || 4));
  const aboutCfg = { photo_id: null, text: DEFAULT_ABOUT_TEXT, ...(cfg.about_config || {}) };
  const aboutPhoto = aboutCfg.photo_id ? byId.get(String(aboutCfg.photo_id)) || null : null;
  const activeFestivalKey = getActiveFestivalKey(istNow(), (cfg.festival_config || {}).dates || {});
  let festival = null;
  if (activeFestivalKey)
    festival = {
      key: activeFestivalKey,
      ...festivalCopyFor(activeFestivalKey),
      scrollReveal: activeFestivalKey === "anniversary" && !!(cfg.festival_config || {}).anniversaryScrollReveal,
      photo: {
        image_url: FESTIVAL_IMAGE_PATHS[activeFestivalKey],
        image_url_mobile: FESTIVAL_IMAGE_PATHS_MOBILE[activeFestivalKey] || FESTIVAL_IMAGE_PATHS[activeFestivalKey],
        focal_x: 50,
        focal_y: 50,
      },
    };
  return c.json({
    services: s.results,
    videos: v.results,
    instagramUsername: igRow?.username || "",
    photos: published,
    phone: c.env.PHONE,
    maps: c.env.MAPS_URL,
    testimonials: reviewsData.reviews || [],
    reviewsAggregate: reviewsData.aggregate || null,
    festival,
    homepage: {
      hero: heroCfg,
      gallery: galleryCfg,
      strip: cfg.strip_config ? { interval: 7, transition: "normal", reveal: "none", ...cfg.strip_config } : null,
      about: aboutCfg,
      heroPhotos: heroCfg.source === "manual" ? resolve(heroCfg.photo_ids || []) : latestInstagram,
      galleryPhotos: resolveGallerySlots(galleryCfg.slots || [], published),
      stripPhotos,
      aboutPhoto,
    },
  });
});
async function sha256(value: string) {
  const d = await crypto.subtle.digest("SHA-256", enc.encode(value));
  return b64u(d);
}
async function setupSignature(id: string, env: Env) {
  return hmac(env, `setup:${id}`);
}
function emailWrapper(bodyHtml: string) {
  return `<div style="background:#f5f1e8;padding:32px 16px;font-family:Arial,sans-serif"><div style="max-width:520px;margin:auto;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #e5ddd0"><div style="background:#14181b;padding:26px 32px;text-align:center"><div style="color:#ffffff;font-family:Georgia,'Times New Roman',serif;font-size:14px;letter-spacing:3px;text-transform:uppercase">Capital UPVC Windows &amp; Doors</div></div><div style="padding:32px;color:#2b2f33;font-size:15px;line-height:1.6">${bodyHtml}</div><div style="padding:16px 32px;background:#f8f5ef;color:#8a8478;font-size:12px;text-align:center">Capital UPVC Windows &amp; Doors · Majorda, Goa</div></div></div>`;
}
async function sendSetupCode(c: any, email: string, code: string) {
  if (!c.env.RESEND_API_KEY || !c.env.RESEND_FROM_EMAIL)
    throw new Error("Email verification is not configured. Add RESEND_API_KEY and RESEND_FROM_EMAIL to the Worker.");
  const body = emailWrapper(
    `<h2 style="margin:0 0 6px;font-family:Georgia,serif;font-size:20px;color:#14181b">Verify your email</h2><p style="margin:0 0 18px;color:#5b6167">Use this code to create the Owner account for your private admin area.</p><div style="text-align:center;margin:24px 0"><span style="display:inline-block;background:#f5f1e8;border:1px solid #e5ddd0;border-radius:10px;padding:14px 28px;font-size:30px;font-weight:700;letter-spacing:10px;color:#14181b">${code}</span></div><p style="margin:0;color:#8a8478;font-size:13px">This code expires in 10 minutes. If you didn't request this, you can safely ignore this email.</p>`,
  );
  const resp = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${c.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: c.env.RESEND_FROM_EMAIL,
      to: [email],
      subject: "Your Capital UPVC admin verification code",
      html: body,
    }),
  });
  if (!resp.ok) {
    const detail = await resp.text().catch(() => "");
    throw new Error(detail || "Could not send verification email");
  }
}
async function sendAdminInvitation(c: any, email: string, url: string) {
  if (!c.env.RESEND_API_KEY || !c.env.RESEND_FROM_EMAIL)
    throw new Error("Email invitations are not configured. Add RESEND_API_KEY and RESEND_FROM_EMAIL to the Worker.");
  const body = emailWrapper(
    `<h2 style="margin:0 0 6px;font-family:Georgia,serif;font-size:20px;color:#14181b">You're invited</h2><p style="margin:0 0 22px;color:#5b6167">You've been invited to join the Capital UPVC website admin team. Click below to verify your email and set your own password.</p><div style="text-align:center;margin:26px 0"><a href="${url}" style="display:inline-block;background:#14181b;color:#ffffff;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;letter-spacing:.5px">Verify email &amp; create account</a></div><p style="margin:0;color:#8a8478;font-size:13px">This invitation expires in 12 hours. If you didn't expect this, you can safely ignore this email.</p>`,
  );
  const payload = {
    from: c.env.RESEND_FROM_EMAIL,
    to: [email],
    subject: "You've been invited to Capital UPVC Admin",
    html: body,
  };
  for (let attempt = 0; attempt < 3; attempt++) {
    const resp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${c.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (resp.ok) return;
    const detail = await resp.text().catch(() => "");
    if (resp.status !== 429 || attempt === 2) throw new Error(detail || "Could not send invitation email");
    const retry = Number(resp.headers.get("retry-after") || "1");
    await new Promise((r) => setTimeout(r, Math.min(3000, Math.max(500, retry * 1000))));
  }
}
async function ensureAdminInvitationsSchema(c: any) {
  await c.env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS admin_invitations (id TEXT PRIMARY KEY,email TEXT NOT NULL,token_hash TEXT UNIQUE NOT NULL,expires_at INTEGER NOT NULL,used_at INTEGER,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
  ).run();
  await c.env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_admin_invitations_email ON admin_invitations(email,created_at)").run();
  await c.env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_admin_invitations_expires ON admin_invitations(expires_at,used_at)").run();
}
app.get("/api/setup/status", async (c) => {
  const row: any = await c.env.DB.prepare("SELECT id FROM admins LIMIT 1").first();
  const ownerEmails = setupOwnerEmails(c.env);
  return c.json({
    available: !row && ownerEmails.length > 0,
    configured: Boolean(row),
    emailConfigured: Boolean(c.env.RESEND_API_KEY && c.env.RESEND_FROM_EMAIL),
    ownerEmailConfigured: ownerEmails.length > 0,
  });
});
app.post("/api/setup/request-code", async (c) => {
  const exists = await c.env.DB.prepare("SELECT id FROM admins LIMIT 1").first();
  if (exists) return c.json({ error: "Setup already completed" }, 409);
  let b: any;
  try {
    b = await c.req.json();
  } catch {
    return c.json({ error: "Invalid request" }, 400);
  }
  const email = String(b.email || "")
    .trim()
    .toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return c.json({ error: "Enter a valid email address" }, 400);
  if (!setupOwnerEmails(c.env).includes(email))
    return c.json({ error: "This email is not authorized to initialize the Owner account." }, 403);
  if (!c.env.RESEND_API_KEY || !c.env.RESEND_FROM_EMAIL) return c.json({ error: "Email verification is not configured yet" }, 503);
  const ip = clientIp(c);
  if (
    !(await rateLimit(c, `setup-ip:${ip}`, 5, 60 * 60 * 1000, 60 * 60 * 1000)) ||
    !(await rateLimit(c, `setup-email:${email}`, 3, 60 * 60 * 1000, 60 * 60 * 1000)) ||
    !(await rateLimit(c, "setup-global", 20, 60 * 60 * 1000, 60 * 60 * 1000))
  )
    return c.json({ error: "Too many setup requests. Please try again later." }, 429);
  const recent: any = await c.env.DB.prepare("SELECT created_at FROM setup_verifications WHERE email=? ORDER BY created_at DESC LIMIT 1")
    .bind(email)
    .first();
  if (recent && Date.now() - Date.parse(String(recent.created_at)) < 60000)
    return c.json({ error: "Please wait a minute before requesting another code" }, 429);
  const random = new Uint32Array(1);
  crypto.getRandomValues(random);
  const code = String(100000 + (random[0] % 900000));
  const id = uid();
  const expiresAt = Date.now() + 10 * 60 * 1000;
  await c.env.DB.prepare("INSERT INTO setup_verifications(id,email,code_hash,expires_at,attempts) VALUES(?,?,?,?,0)")
    .bind(id, email, await sha256(`${email}:${code}`), expiresAt)
    .run();
  try {
    await sendSetupCode(c, email, code);
  } catch (e: any) {
    await c.env.DB.prepare("DELETE FROM setup_verifications WHERE id=?").bind(id).run();
    return c.json({ error: e?.message || "Could not send verification email" }, 502);
  }
  return c.json({ ok: true });
});
app.post("/api/setup/verify-code", async (c) => {
  const exists = await c.env.DB.prepare("SELECT id FROM admins LIMIT 1").first();
  if (exists) return c.json({ error: "Setup already completed" }, 409);
  let b: any;
  try {
    b = await c.req.json();
  } catch {
    return c.json({ error: "Invalid request" }, 400);
  }
  const email = String(b.email || "")
      .trim()
      .toLowerCase(),
    code = String(b.code || "").trim();
  if (!setupOwnerEmails(c.env).includes(email))
    return c.json({ error: "This email is not authorized to initialize the Owner account." }, 403);
  if (!email || !/^[0-9]{6}$/.test(code)) return c.json({ error: "Enter the 6-digit verification code" }, 400);
  if (
    !(await rateLimit(c, `verify-ip:${clientIp(c)}`, 15, 15 * 60 * 1000, 15 * 60 * 1000)) ||
    !(await rateLimit(c, `verify-email:${email}`, 10, 15 * 60 * 1000, 15 * 60 * 1000))
  )
    return c.json({ error: "Too many verification attempts. Please try again later." }, 429);
  const row: any = await c.env.DB.prepare(
    "SELECT * FROM setup_verifications WHERE email=? AND used_at IS NULL ORDER BY created_at DESC LIMIT 1",
  )
    .bind(email)
    .first();
  if (!row) return c.json({ error: "Verification code not found. Request a new code." }, 400);
  if (Number(row.expires_at) < Date.now()) return c.json({ error: "That code has expired. Request a new code." }, 400);
  if (Number(row.attempts) >= 5) return c.json({ error: "Too many incorrect attempts. Request a new code." }, 429);
  await c.env.DB.prepare("UPDATE setup_verifications SET attempts=attempts+1 WHERE id=?").bind(row.id).run();
  if ((await sha256(`${email}:${code}`)) !== row.code_hash) return c.json({ error: "Incorrect verification code" }, 400);
  await c.env.DB.prepare("UPDATE setup_verifications SET verified_at=? WHERE id=?").bind(Date.now(), row.id).run();
  const sig = await setupSignature(row.id, c.env);
  setCookie(c, "ip_setup_verified", `${row.id}.${sig}`, {
    httpOnly: true,
    secure: true,
    sameSite: "Strict",
    path: "/api/setup",
    maxAge: 900,
  });
  return c.json({ ok: true });
});
app.post("/api/setup/create", async (c) => {
  const exists = await c.env.DB.prepare("SELECT id FROM admins LIMIT 1").first();
  if (exists) return c.json({ error: "Setup already completed" }, 409);
  const cookie = getCookie(c, "ip_setup_verified");
  if (!cookie) return c.json({ error: "Verify your email first" }, 403);
  const [id, sig] = cookie.split(".");
  if (!id || !sig || sig !== (await setupSignature(id, c.env))) return c.json({ error: "Verification expired. Start again." }, 403);
  const row: any = await c.env.DB.prepare("SELECT * FROM setup_verifications WHERE id=? AND used_at IS NULL").bind(id).first();
  if (
    !row ||
    !row.verified_at ||
    Date.now() - Number(row.verified_at) > 15 * 60 * 1000 ||
    !setupOwnerEmails(c.env).includes(String(row.email).toLowerCase())
  )
    return c.json({ error: "Verification expired. Start again." }, 403);
  let b: any;
  try {
    b = await c.req.json();
  } catch {
    return c.json({ error: "Invalid request" }, 400);
  }
  const name = String(b.name || "").trim(),
    email = String(b.email || "")
      .trim()
      .toLowerCase(),
    password = String(b.password || ""),
    confirm = String(b.confirmPassword || "");
  if (!name || !email || !password || !confirm) return c.json({ error: "All fields are required" }, 400);
  if (email !== row.email) return c.json({ error: "Verified email does not match" }, 400);
  if (password !== confirm) return c.json({ error: "Passwords do not match" }, 400);
  if (password.length < 12) return c.json({ error: "Password must be at least 12 characters" }, 400);
  const adminId = uid();
  try {
    const passwordHash = await hashPassword(password);
    const result = await c.env.DB.batch([
      c.env.DB.prepare("INSERT INTO admins(id,name,email,password_hash,role) VALUES(?,?,?,?,?)").bind(
        adminId,
        name,
        email,
        passwordHash,
        "owner",
      ),
      c.env.DB.prepare("UPDATE setup_verifications SET used_at=? WHERE id=?").bind(Date.now(), id),
    ]);
    if (result.some((r: any) => r?.success === false)) throw new Error("Database batch returned an unsuccessful statement");
  } catch (e: any) {
    console.error("OWNER_CREATE_ERROR", e?.name || "Error", e?.message || String(e));
    return c.json({ error: "Owner account could not be created. Please try again." }, 500);
  }
  deleteCookie(c, "ip_setup_verified", { path: "/api/setup" });
  return c.json({ ok: true });
});
app.post("/api/login", async (c) => {
  let b: any;
  try {
    b = await c.req.json();
  } catch {
    return c.json({ error: "Invalid request" }, 400);
  }
  const email = String(b.email || "")
    .trim()
    .toLowerCase();
  const password = String(b.password || "");
  if (!email || !password) return c.json({ error: "Email and password are required" }, 400);
  const ip = clientIp(c);
  const ipOk = await rateLimit(c, `login-ip:${ip}`, 20, 15 * 60 * 1000, 15 * 60 * 1000);
  const emailOk = await rateLimit(c, `login-email:${email}`, 5, 15 * 60 * 1000, 15 * 60 * 1000);
  if (!ipOk || !emailOk) return c.json({ error: "Too many sign-in attempts. Please try again later." }, 429);
  const a: any = await c.env.DB.prepare("SELECT * FROM admins WHERE email=? AND active=1").bind(email).first();
  const valid = Boolean(a && (await verifyPassword(password, a.password_hash)));
  if (!valid) return c.json({ error: "Invalid credentials" }, 401);
  await clearRateLimit(c, `login-ip:${ip}`, `login-email:${email}`);
  if (Number(String(a.password_hash).split("$")[1] || 0) < PASSWORD_ITERATIONS) {
    try {
      await c.env.DB.prepare("UPDATE admins SET password_hash=? WHERE id=?")
        .bind(await hashPassword(password), a.id)
        .run();
    } catch (e) {
      console.error("PASSWORD_UPGRADE_ERROR", e?.name || "Error", e?.message || String(e));
    }
  }
  const id = uid();
  const exp = Date.now() + 1000 * 60 * 60 * 12;
  await c.env.DB.prepare("INSERT INTO sessions(id,admin_id,expires_at) VALUES(?,?,?)").bind(id, a.id, exp).run();
  const sig = await hmac(c.env, id);
  setCookie(c, "ip_session", id, { httpOnly: true, secure: true, sameSite: "Strict", path: "/", maxAge: 43200 });
  setCookie(c, "ip_sig", sig, { httpOnly: true, secure: true, sameSite: "Strict", path: "/", maxAge: 43200 });
  await logActivity(c, a.id, a.name || a.email, "Logged in");
  return c.json({ id: a.id, name: a.name, email: a.email, role: a.role });
});
app.post("/api/logout", async (c) => {
  const id = getCookie(c, "ip_session");
  if (id) await c.env.DB.prepare("DELETE FROM sessions WHERE id=?").bind(id).run();
  deleteCookie(c, "ip_session", { path: "/" });
  deleteCookie(c, "ip_sig", { path: "/" });
  return c.json({ ok: true });
});
app.get("/api/me", requireAuth, (c) => c.json(c.get("admin")));
app.get("/api/admin/dashboard", requireAuth, async (c) => {
  const [p, a, clicks, vids] = await Promise.all([
    c.env.DB.prepare("SELECT COUNT(*) n FROM photos").first<any>(),
    c.env.DB.prepare("SELECT * FROM analytics_daily ORDER BY day DESC LIMIT 31").all(),
    c.env.DB.prepare("SELECT action,SUM(count) n FROM analytics_clicks WHERE day>=date('now','-30 days') GROUP BY action").all(),
    c.env.DB.prepare("SELECT COUNT(*) n FROM videos").first<any>(),
  ]);
  const storageBytesUsed = await storageUsed(c);
  return c.json({
    photos: p?.n || 0,
    storageEnabled: Boolean(c.env.MEDIA),
    storageBytes: storageBytesUsed,
    videos: vids?.n || 0,
    storageLimit: storageLimitBytes(c.env),
    analytics: a.results,
    clicks: clicks.results || [],
  });
});
app.get("/api/admin/photos", requireAuth, async (c) => {
  const r = await c.env.DB.prepare("SELECT * FROM photos ORDER BY created_at DESC").all();
  return c.json(r.results);
});
app.post("/api/admin/photos", requireAuth, async (c) => {
  let b: any;
  try {
    b = await c.req.json();
  } catch {
    return c.json({ error: "Invalid request" }, 400);
  }
  const id = uid();
  const bytes = finiteNumber(b.bytes, 0, 30 * 1024 * 1024, 0);
  if (bytes < 0) return c.json({ error: "Invalid file size" }, 400);
  const caption = textField(b.caption, 2000),
    occasion = textField(b.occasion || b.category || "Other", 100),
    category = textField(b.category || b.occasion || "Other", 100);
  const status = ["pending", "approved", "rejected"].includes(String(b.status || "pending")) ? String(b.status || "pending") : "pending";
  if (String(b.caption || "").length > 2000 || String(b.category || b.occasion || "Other").length > 100)
    return c.json({ error: "Photo fields are too long" }, 400);
  const reservationId = String(b.reservation_id || "");
  if (b.r2_key && !reservationId) return c.json({ error: "R2-backed photos require a valid upload reservation" }, 400);
  if (reservationId) {
    const reservation: any = await c.env.DB.prepare("SELECT * FROM storage_reservations WHERE id=?").bind(reservationId).first();
    if (!reservation || Number(reservation.bytes) !== bytes || Number(reservation.expires_at) < Date.now())
      return c.json({ error: "Upload reservation expired. Please upload the photo again." }, 409);
    if (b.r2_key !== reservation.key) return c.json({ error: "Upload reservation does not match the photo" }, 400);
    try {
      await c.env.DB.batch([
        c.env.DB.prepare(
          `INSERT INTO photos(id,source,source_id,r2_key,image_url,caption,occasion,category,status,published,width,height,bytes,sharpness,brightness,exposure,contrast,clarity,color,composition,similarity,total_score,phash) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        ).bind(
          id,
          b.source || "upload",
          b.source_id || null,
          b.r2_key,
          b.image_url,
          caption,
          occasion,
          category,
          status,
          b.published ? 1 : 0,
          b.width || null,
          b.height || null,
          bytes,
          b.sharpness || 0,
          b.brightness || 0,
          b.exposure || 0,
          b.contrast || 0,
          b.clarity || 0,
          b.color || 0,
          b.composition || 0,
          b.similarity || 0,
          b.total_score || 0,
          b.phash || null,
        ),
        c.env.DB.prepare("DELETE FROM storage_reservations WHERE id=?").bind(reservationId),
        c.env.DB.prepare("UPDATE storage_quota SET reserved_bytes=MAX(0,reserved_bytes-?) WHERE id=1").bind(bytes),
        c.env.DB.prepare("DELETE FROM upload_nonces WHERE reservation_id=?").bind(reservationId),
      ]);
      return c.json({ id });
    } catch (e) {
      if (c.env.MEDIA && reservation.key) await c.env.MEDIA.delete(reservation.key).catch(() => {});
      await c.env.DB.batch([
        c.env.DB.prepare("DELETE FROM photos WHERE id=?").bind(id),
        c.env.DB.prepare("DELETE FROM storage_reservations WHERE id=?").bind(reservationId),
        c.env.DB.prepare("UPDATE storage_quota SET reserved_bytes=MAX(0,reserved_bytes-?) WHERE id=1").bind(bytes),
        c.env.DB.prepare("DELETE FROM upload_nonces WHERE reservation_id=?").bind(reservationId),
      ]).catch(() => {});
      return c.json({ error: "Photo record could not be created; the uploaded file was cleaned up." }, 500);
    }
  }
  const used = await storageUsed(c);
  if (Number(used) + bytes > storageLimitBytes(c.env)) return c.json({ error: "Storage limit reached" }, 413);
  await c.env.DB.prepare(
    `INSERT INTO photos(id,source,source_id,r2_key,image_url,caption,occasion,category,status,published,width,height,bytes,sharpness,brightness,exposure,contrast,clarity,color,composition,similarity,total_score,phash) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
  )
    .bind(
      id,
      b.source || "upload",
      b.source_id || null,
      b.r2_key || null,
      b.image_url || null,
      caption,
      occasion,
      category,
      status,
      b.published ? 1 : 0,
      b.width || null,
      b.height || null,
      bytes,
      b.sharpness || 0,
      b.brightness || 0,
      b.exposure || 0,
      b.contrast || 0,
      b.clarity || 0,
      b.color || 0,
      b.composition || 0,
      b.similarity || 0,
      b.total_score || 0,
      b.phash || null,
    )
    .run();
  return c.json({ id });
});
app.post("/api/admin/upload-url", requireAuth, async (c) => {
  if (!c.env.MEDIA) return c.json({ error: "Media storage is not enabled yet. Please connect R2 storage before uploading." }, 503);
  let b: any;
  try {
    b = await c.req.json();
  } catch {
    return c.json({ error: "Invalid request" }, 400);
  }
  const size = Number(b.size || 0);
  const contentType = String(b.contentType || "").toLowerCase();
  const isVideo = Boolean(VIDEO_TYPES[contentType]);
  const purpose = String(b.purpose || "photo");
  if (!isVideo && contentType !== "image/webp")
    return c.json({ error: "Photos must be converted to WebP first; videos must be MP4, WebM or MOV" }, 415);
  const maxBytes = isVideo ? MAX_VIDEO_UPLOAD_BYTES : MAX_IMAGE_UPLOAD_BYTES;
  if (!Number.isInteger(size) || size <= 0 || size > maxBytes)
    return c.json({ error: isVideo ? "Video must be smaller than 95 MB. Compress it and try again." : "File must be 1 byte–30 MB" }, 400);
  const reservationId = uid();
  if (!(await reserveStorage(c, reservationId, size))) return c.json({ error: "Storage limit reached" }, 413);
  const base = String(b.name || (isVideo ? "video" : "photo"))
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/\.[^.]+$/, "")
    .slice(0, 80);
  const day = new Date().toISOString().slice(0, 10);
  const key = isVideo
    ? `videos/uploads/${day}/${uid()}-${base}.${VIDEO_TYPES[contentType]}`
    : purpose === "video-poster"
      ? `videos/posters/${day}/${uid()}-${base}.webp`
      : `photos/${day}/${uid()}-${base}.webp`;
  const exp = Date.now() + (isVideo ? 30 * 60000 : 600000);
  const nonce = uid();
  await c.env.DB.prepare("UPDATE storage_reservations SET key=? WHERE id=?").bind(key, reservationId).run();
  try {
    await c.env.DB.prepare(
      "INSERT INTO upload_nonces(id,reservation_id,key,expected_size,content_type,expires_at,used_at) VALUES(?,?,?,?,?,?,NULL)",
    )
      .bind(nonce, reservationId, key, size, contentType, exp)
      .run();
  } catch (e) {
    await releaseStorage(c, reservationId);
    return c.json({ error: "Could not prepare upload" }, 500);
  }
  const url = new URL(c.req.url);
  url.pathname = `/api/upload/${encodeURIComponent(key)}`;
  url.search = `?expires=${exp}&nonce=${encodeURIComponent(nonce)}`;
  const token = await hmac(c.env, `PUT:${key}:${size}:${contentType}:${exp}:${nonce}`);
  url.search += `&token=${encodeURIComponent(token)}`;
  return c.json({ key, url: url.toString(), expires: exp, reservationId });
});
app.put("/api/upload/:key", async (c) => {
  if (!c.env.MEDIA) return c.json({ error: "Media storage is not enabled yet." }, 503);
  const key = decodeURIComponent(c.req.param("key"));
  const u = new URL(c.req.url);
  const token = u.searchParams.get("token") || "";
  const exp = Number(u.searchParams.get("expires") || 0);
  const nonce = u.searchParams.get("nonce") || "";
  const row: any = await c.env.DB.prepare("SELECT * FROM upload_nonces WHERE id=? AND key=?").bind(nonce, key).first();
  if (!row || row.used_at || Number(row.expires_at) < Date.now()) return c.json({ error: "Upload URL expired or already used" }, 403);
  const contentType = (c.req.header("Content-Type") || "").toLowerCase();
  const expected = Number(row.expected_size || 0);
  const isVideo = Boolean(VIDEO_TYPES[contentType]);
  const extOk = isVideo ? key.toLowerCase().endsWith("." + VIDEO_TYPES[contentType]) : key.toLowerCase().endsWith(".webp");
  if (
    !extOk ||
    (!isVideo && contentType !== "image/webp") ||
    contentType !== String(row.content_type || "") ||
    exp !== Number(row.expires_at) ||
    token !== (await hmac(c.env, `PUT:${key}:${expected}:${contentType}:${exp}:${nonce}`))
  )
    return c.json({ error: "Invalid upload authorization" }, 403);
  if (!c.req.raw.body) return c.json({ error: "No body" }, 400);
  const declared = Number(c.req.header("Content-Length") || 0);
  if (declared && declared !== expected) return c.json({ error: "Uploaded file size does not match the signed request" }, 413);
  if (expected > (isVideo ? MAX_VIDEO_UPLOAD_BYTES : MAX_IMAGE_UPLOAD_BYTES)) return c.json({ error: "File is too large" }, 413);
  const claimed = await c.env.DB.prepare("UPDATE upload_nonces SET used_at=? WHERE id=? AND used_at IS NULL").bind(Date.now(), nonce).run();
  if (Number(claimed.meta?.changes || 0) !== 1) return c.json({ error: "Upload URL already used" }, 409);
  try {
    let stored: any;
    if (isVideo) {
      // Stream large video bodies straight into R2; FixedLengthStream enforces the signed size.
      const { readable, writable } = new FixedLengthStream(expected);
      const pump = c.req.raw.body.pipeTo(writable);
      stored = await c.env.MEDIA.put(key, readable, { httpMetadata: { contentType, cacheControl: "public,max-age=31536000,immutable" } });
      await pump;
    } else {
      const buf = await c.req.raw.arrayBuffer();
      if (buf.byteLength !== expected) throw new Error("size mismatch");
      stored = await c.env.MEDIA.put(key, buf, {
        httpMetadata: { contentType: "image/webp", cacheControl: "public,max-age=31536000,immutable" },
      });
    }
    if (!stored || Number(stored.size) !== expected) throw new Error("size mismatch");
    await c.env.DB.prepare("UPDATE upload_nonces SET uploaded_at=? WHERE id=?").bind(Date.now(), nonce).run();
    return c.json({ ok: true, key, reservationId: row.reservation_id });
  } catch (e) {
    await c.env.MEDIA.delete(key).catch(() => {});
    await releaseStorage(c, row.reservation_id || "");
    return c.json({ error: "Storage upload failed" }, 502);
  }
});
function instagramImportedScore(item: any) {
  const w = Number(item.width || 0),
    h = Number(item.height || 0),
    bytes = Number(item.bytes || 0);
  const pixels = w * h;
  const resolution = Math.min(100, pixels ? Math.sqrt(pixels) / 25 : 55);
  const size = Math.min(100, bytes ? (Math.log10(bytes) / 7) * 100 : 55);
  const ratio = w && h ? w / h : 1.5;
  const framing = Math.max(0, 100 - Math.abs(ratio - 1.5) * 35);
  return resolution * 0.45 + size * 0.25 + framing * 0.2 + 10;
}
async function syncInstagramData(c: any, startCursor?: string, disableEarlyExit?: boolean) {
  await ensureVideoFileColumns(c);
  let conn = await getInstagramConnection(c);
  if (!conn) return { ok: false, error: "Instagram is not connected. Open the Connect Instagram link first.", status: 400 };
  conn = await refreshInstagramToken(c, conn);
  await ensureInstagramReelIgnoreSchema(c);
  const version = c.env.INSTAGRAM_GRAPH_VERSION || "v24.0";
  let endpoint =
    startCursor ||
    `https://graph.instagram.com/${version}/${encodeURIComponent(conn.user_id)}/media?fields=id,caption,media_type,media_product_type,media_url,thumbnail_url,permalink,timestamp,width,height,children{media_type,media_url,thumbnail_url,id}&limit=50&access_token=${encodeURIComponent(conn.access_token)}`;
  await ensureCategoryAliasSchema(c);
  const serviceRows: any[] = (
    await c.env.DB.prepare("SELECT title,instagram_hashtags FROM services WHERE active=1 ORDER BY sort_order,id").all()
  ).results;
  const aliasRows: any[] = (await c.env.DB.prepare("SELECT hashtag,category FROM category_hashtag_aliases").all()).results || [];
  let photosImported = 0,
    reelsImported = 0,
    skipped = 0,
    pages = 0,
    consecutiveSkips = 0,
    caughtUp = false;
  while (endpoint && pages < 3) {
    const resp = await fetch(endpoint);
    const data: any = await resp.json();
    if (!resp.ok)
      return {
        ok: false,
        error: data?.error?.message || "Instagram API request failed",
        status: 502,
        photosImported,
        reelsImported,
        skipped,
      };
    for (const item of data.data || []) {
      const _before = photosImported + reelsImported;
      try {
        const matched = matchedCategories(item.caption || "", serviceRows, aliasRows);
        const category = matched.length === 1 ? matched[0] : "Other";
        const autoPublish = matched.length === 1;
        if (!autoPublish) {
          const missed = unmatchedHashtags(item.caption || "", serviceRows, aliasRows);
          if (missed.length) {
            await ensureHashtagSightingsSchema(c);
            for (const tag of missed) {
              await c.env.DB.prepare(
                "INSERT INTO hashtag_sightings(hashtag,count,last_seen,sample_caption) VALUES(?,1,CURRENT_TIMESTAMP,?) ON CONFLICT(hashtag) DO UPDATE SET count=count+1,last_seen=CURRENT_TIMESTAMP",
              )
                .bind(tag, (item.caption || "").slice(0, 200))
                .run();
            }
          }
        }
        // Videos (Reels, video posts and videos inside carousels) are queued here and their files are
        // downloaded into R2 by downloadInstagramVideos(), so they play natively on the website.
        const videoCandidates =
          item.media_type === "VIDEO"
            ? [
                {
                  id: item.id,
                  source_url: item.permalink || `instagram:${item.id}`,
                  media_url: item.media_url || "",
                  thumbnail_url: item.thumbnail_url || "",
                },
              ]
            : item.media_type === "CAROUSEL_ALBUM"
              ? (item.children?.data || [])
                  .filter((ch: any) => ch.media_type === "VIDEO")
                  .map((ch: any) => ({
                    id: ch.id,
                    source_url: `${item.permalink || "instagram:" + item.id}#${ch.id}`,
                    media_url: ch.media_url || "",
                    thumbnail_url: ch.thumbnail_url || "",
                  }))
              : [];
        for (const vc of videoCandidates) {
          const ignored = await c.env.DB.prepare("SELECT id FROM instagram_reel_ignores WHERE source_url=? OR video_id=? LIMIT 1")
            .bind(vc.source_url, vc.id)
            .first();
          if (ignored) {
            skipped++;
            continue;
          }
          const exists: any = await c.env.DB.prepare(
            "SELECT id FROM videos WHERE platform='instagram' AND (video_id=? OR source_url=?) LIMIT 1",
          )
            .bind(vc.id, vc.source_url)
            .first();
          if (exists) {
            skipped++;
            continue;
          }
          const minOrder: any = await c.env.DB.prepare("SELECT MIN(sort_order) m FROM videos").first();
          await c.env.DB.prepare(
            `INSERT INTO videos(id,title,embed_url,platform,source_url,video_id,category,active,sort_order,thumbnail_url,media_url,bytes,file_bytes) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)`,
          )
            .bind(
              uid(),
              String(item.caption || "")
                .split("\n")[0]
                .replace(/#[\p{L}0-9_-]+/gu, "")
                .trim()
                .slice(0, 100) || "Instagram video",
              item.permalink || "",
              "instagram",
              vc.source_url,
              vc.id,
              category,
              1,
              Number(minOrder?.m ?? 1) - 1,
              vc.thumbnail_url,
              vc.media_url,
              0,
              0,
            )
            .run();
          reelsImported++;
        }
        if (item.media_type === "VIDEO") continue;
        const groupId = item.media_type === "CAROUSEL_ALBUM" ? item.id : null;
        const photoCandidates =
          item.media_type === "CAROUSEL_ALBUM"
            ? (item.children?.data || [])
                .filter((ch: any) => ch.media_type === "IMAGE" && ch.media_url)
                .map((ch: any, idx: number) => ({
                  id: ch.id,
                  media_url: ch.media_url,
                  width: item.width,
                  height: item.height,
                  groupOrder: idx,
                }))
            : item.media_type === "IMAGE" && item.media_url
              ? [{ id: item.id, media_url: item.media_url, width: item.width, height: item.height, groupOrder: 0 }]
              : [];
        if (!photoCandidates.length) {
          skipped++;
          continue;
        }
        for (const photo of photoCandidates) {
          const exists = await c.env.DB.prepare("SELECT id FROM photos WHERE source=? AND source_id=?").bind("instagram", photo.id).first();
          if (exists) {
            skipped++;
            continue;
          }
          if (!c.env.MEDIA) {
            // Keep the Instagram CDN URL for testing/fallback deployments. Production should bind R2 for durable photo storage.
            await c.env.DB.prepare(
              `INSERT INTO photos(id,source,source_id,r2_key,image_url,caption,occasion,category,status,published,width,height,bytes,total_score,group_id,group_order) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
            )
              .bind(
                uid(),
                "instagram",
                photo.id,
                null,
                photo.media_url,
                item.caption || "",
                category,
                category,
                autoPublish ? "approved" : "pending",
                autoPublish ? 1 : 0,
                Number(photo.width || 0) || null,
                Number(photo.height || 0) || null,
                0,
                instagramImportedScore(photo),
                groupId,
                photo.groupOrder,
              )
              .run();
            photosImported++;
            continue;
          }
          const img = await fetch(photo.media_url, { cf: { image: { format: "webp", quality: 92 } } as any });
          if (!img.ok) {
            skipped++;
            continue;
          }
          const buf = await img.arrayBuffer();
          const bytes = buf.byteLength;
          const key = `photos/instagram/${photo.id}.webp`;
          const importedScore = instagramImportedScore({ ...photo, bytes });
          const reservationId = uid();
          if (!(await reserveStorage(c, reservationId, bytes)))
            return {
              ok: false,
              error: "Storage limit reached while importing Instagram photos",
              status: 413,
              photosImported,
              reelsImported,
              skipped,
            };
          try {
            await c.env.MEDIA.put(key, buf, {
              httpMetadata: { contentType: "image/webp", cacheControl: "public,max-age=31536000,immutable" },
            });
            await c.env.DB.batch([
              c.env.DB.prepare(
                `INSERT INTO photos(id,source,source_id,r2_key,image_url,caption,occasion,category,status,published,width,height,bytes,group_id,group_order) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
              ).bind(
                uid(),
                "instagram",
                photo.id,
                key,
                "/media/" + key,
                item.caption || "",
                category,
                category,
                autoPublish ? "approved" : "pending",
                autoPublish ? 1 : 0,
                Number(photo.width || 0) || null,
                Number(photo.height || 0) || null,
                bytes,
                groupId,
                photo.groupOrder,
              ),
              c.env.DB.prepare("DELETE FROM storage_reservations WHERE id=?").bind(reservationId),
              c.env.DB.prepare("UPDATE storage_quota SET reserved_bytes=MAX(0,reserved_bytes-?) WHERE id=1").bind(bytes),
            ]);
            photosImported++;
          } catch {
            await c.env.MEDIA.delete(key).catch(() => {});
            await releaseStorage(c, reservationId);
            skipped++;
          }
        }
      } finally {
        if (photosImported + reelsImported === _before) {
          consecutiveSkips++;
          if (consecutiveSkips >= 30 && !disableEarlyExit) caughtUp = true;
        } else {
          consecutiveSkips = 0;
        }
      }
    }
    endpoint = caughtUp ? "" : data.paging?.next || "";
    pages++;
  }
  const downloads = await downloadInstagramVideos(c, 3);
  return {
    ok: true,
    photosImported,
    reelsImported,
    skipped,
    pages,
    photoStorageEnabled: Boolean(c.env.MEDIA),
    username: conn.username || null,
    nextCursor: endpoint || null,
    videosDownloaded: downloads.downloaded,
    videosFailed: downloads.failed,
    videosPending: downloads.pending,
  };
}

function parseJsonSetting(row: any, fallback: any) {
  try {
    return row?.value ? JSON.parse(row.value) : fallback;
  } catch {
    return fallback;
  }
}
async function ensureV3Schema(c: any) {
  await c.env.DB.batch([
    c.env.DB.prepare(
      `CREATE TABLE IF NOT EXISTS site_settings (key TEXT PRIMARY KEY,value TEXT NOT NULL,updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
    ),
    c.env.DB.prepare(
      `CREATE TABLE IF NOT EXISTS careers (id TEXT PRIMARY KEY,title TEXT NOT NULL,requirements TEXT NOT NULL DEFAULT '',description TEXT NOT NULL DEFAULT '',salary_disclosed INTEGER NOT NULL DEFAULT 0,salary_text TEXT NOT NULL DEFAULT '',duration TEXT NOT NULL DEFAULT '',valid_until TEXT,google_form_url TEXT NOT NULL DEFAULT '',active INTEGER NOT NULL DEFAULT 1,sort_order INTEGER NOT NULL DEFAULT 0,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
    ),
    c.env.DB.prepare(
      `INSERT OR IGNORE INTO site_settings(key,value) VALUES ('hero_config','{"count":4,"source":"latest_instagram","photo_ids":[],"interval":7,"transition":"normal"}'),('gallery_config','${DEFAULT_GALLERY_CONFIG}'),('strip_config','{"photo_ids":[]}')`,
    ),
  ]);
}
async function readSetting(c: any, key: string, fallback: any) {
  const row: any = await c.env.DB.prepare("SELECT value FROM site_settings WHERE key=?").bind(key).first();
  return parseJsonSetting(row, fallback);
}
async function writeSetting(c: any, key: string, value: any) {
  await c.env.DB.prepare(
    "INSERT INTO site_settings(key,value,updated_at) VALUES(?,?,CURRENT_TIMESTAMP) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=CURRENT_TIMESTAMP",
  )
    .bind(key, JSON.stringify(value))
    .run();
}
async function logActivity(c: any, adminId: string | null, adminName: string, action: string) {
  try {
    await c.env.DB.prepare("INSERT INTO activity_log(id,admin_id,admin_name,action,created_at) VALUES(?,?,?,?,CURRENT_TIMESTAMP)")
      .bind(uid(), adminId, adminName || "Unknown", action)
      .run();
  } catch {}
}
app.get("/api/admin/homepage", requireAuth, async (c) => {
  await ensureV3Schema(c);
  const [hero, gallery, strip, about, photos] = await Promise.all([
    readSetting(c, "hero_config", {
      count: 4,
      source: "latest_instagram",
      photo_ids: [],
      interval: 7,
      transition: "normal",
      scrollReveal: false,
    }).then((h: any) => ({ scrollReveal: false, ...h })),
    readSetting(c, "gallery_config", JSON.parse(DEFAULT_GALLERY_CONFIG)),
    readSetting(c, "strip_config", { photo_ids: [], interval: 7, transition: "normal", reveal: "none" }).then((s: any) => ({
      interval: 7,
      transition: "normal",
      reveal: "none",
      ...s,
    })),
    readSetting(c, "about_config", { photo_id: null, text: DEFAULT_ABOUT_TEXT }),
    c.env.DB.prepare(
      "SELECT id,image_url,caption,category,occasion,source,status,published,created_at,total_score,group_id,group_order,focal_x,focal_y,focal_zoom,focal_x_mobile,focal_y_mobile,focal_zoom_mobile,focal_x_hero,focal_y_hero,focal_zoom_hero,focal_x_hero_mobile,focal_y_hero_mobile,focal_zoom_hero_mobile FROM photos WHERE status='approved' AND published=1 ORDER BY created_at DESC LIMIT 300",
    ).all(),
  ]);
  return c.json({ hero, gallery, strip, about, photos: photos.results || [] });
});
app.put("/api/admin/homepage/hero", requireAuth, async (c) => {
  await ensureV3Schema(c);
  let b: any;
  try {
    b = await c.req.json();
  } catch {
    return c.json({ error: "Invalid request" }, 400);
  }
  const count = boundedInt(b.count, 3, 5, 4),
    source = b.source === "manual" ? "manual" : "latest_instagram",
    interval = boundedInt(b.interval, 3, 15, 7),
    transition = ["slow", "normal", "fast"].includes(String(b.transition)) ? String(b.transition) : "normal",
    scrollReveal = !!b.scrollReveal,
    ids = Array.isArray(b.photo_ids)
      ? b.photo_ids
          .map((x: any) => textField(x, 100))
          .filter(Boolean)
          .slice(0, count)
      : [];
  if (source === "manual" && ids.length !== count) return c.json({ error: `Select exactly ${count} hero images.` }, 400);
  await writeSetting(c, "hero_config", { count, source, photo_ids: ids, interval, transition, scrollReveal });
  const me: any = c.get("admin");
  await logActivity(c, me.id, me.name || me.email, "Updated Hero settings");
  return c.json({ ok: true });
});
app.get("/api/admin/gallery-preview", requireAuth, async (c) => {
  await ensureV3Schema(c);
  const galleryCfg = await readSetting(c, "gallery_config", JSON.parse(DEFAULT_GALLERY_CONFIG));
  const published: any = await c.env.DB.prepare(
    "SELECT id,source,source_id,image_url,caption,occasion,category,created_at,group_id,group_order,total_score,focal_x,focal_y,focal_zoom,focal_x_mobile,focal_y_mobile,focal_zoom_mobile,focal_x_hero,focal_y_hero,focal_zoom_hero,focal_x_hero_mobile,focal_y_hero_mobile,focal_zoom_hero_mobile,excluded_from_auto FROM photos WHERE published=1 ORDER BY created_at DESC LIMIT 300",
  ).all();
  return c.json({ photos: resolveGallerySlotsAligned(galleryCfg.slots || [], published.results || []) });
});
app.put("/api/admin/homepage/about", requireAuth, async (c) => {
  await ensureV3Schema(c);
  let b: any;
  try {
    b = await c.req.json();
  } catch {
    return c.json({ error: "Invalid request" }, 400);
  }
  const photoId = textField(b.photo_id, 100);
  if (!photoId) return c.json({ error: "Choose a photo." }, 400);
  const found = await c.env.DB.prepare("SELECT id FROM photos WHERE id=?").bind(photoId).first();
  if (!found) return c.json({ error: "Photo not found." }, 400);
  await writeSetting(c, "about_config", { photo_id: photoId });
  const me: any = c.get("admin");
  await logActivity(c, me.id, me.name || me.email, "Changed the About Us photo");
  return c.json({ ok: true });
});
const FESTIVAL_KEYS = ["ganesh", "diwali", "christmas", "eid", "newyear", "independence", "anniversary"];
const FESTIVAL_IMAGE_PATHS: Record<string, string> = {
  ganesh: "/festival-ganesh.webp",
  diwali: "/festival-diwali.webp",
  christmas: "/festival-christmas.webp",
  eid: "/festival-eid.webp",
  newyear: "/festival-newyear.webp",
  independence: "/festival-independence.webp",
  anniversary: "/festival-anniversary.webp",
};
const FESTIVAL_IMAGE_PATHS_MOBILE: Record<string, string> = {
  ganesh: "/festival-ganesh-mobile.webp",
  diwali: "/festival-diwali-mobile.webp",
  christmas: "/festival-christmas-mobile.webp",
  eid: "/festival-eid-mobile.webp",
  newyear: "/festival-newyear-mobile.webp",
  independence: "/festival-independence-mobile.webp",
  anniversary: "/festival-anniversary-mobile.webp",
};
app.get("/api/admin/festivals", requireAuth, async (c) => {
  await ensureV3Schema(c);
  const cfg = await readSetting(c, "festival_config", { dates: {} });
  const dates = { ...DEFAULT_FESTIVAL_DATES, ...(cfg.dates || {}) };
  const items = FESTIVAL_KEYS.map((k) => ({
    key: k,
    ...festivalCopyFor(k),
    scrollReveal: k === "anniversary" && !!cfg.anniversaryScrollReveal,
    photo: {
      image_url: FESTIVAL_IMAGE_PATHS[k],
      image_url_mobile: FESTIVAL_IMAGE_PATHS_MOBILE[k] || FESTIVAL_IMAGE_PATHS[k],
      focal_x: 50,
      focal_y: 50,
    },
    movable: ["ganesh", "diwali", "eid"].includes(k),
    start: dates[k]?.start || "",
    end: dates[k]?.end || "",
  }));
  return c.json({ items, active: getActiveFestivalKey(istNow(), dates), anniversaryScrollReveal: !!cfg.anniversaryScrollReveal });
});
app.put("/api/admin/festivals", requireAuth, async (c) => {
  await ensureV3Schema(c);
  let b: any;
  try {
    b = await c.req.json();
  } catch {
    return c.json({ error: "Invalid request" }, 400);
  }
  const dateRe = /^\d{4}-\d{2}-\d{2}$/;
  const dates: any = {};
  for (const k of ["ganesh", "diwali", "eid"]) {
    const start = textField(b?.dates?.[k]?.start, 10),
      end = textField(b?.dates?.[k]?.end, 10);
    if (start && end) {
      if (!dateRe.test(start) || !dateRe.test(end)) return c.json({ error: `Dates for ${k} must be in YYYY-MM-DD format.` }, 400);
      if (start > end) return c.json({ error: `${k}: start date must be before end date.` }, 400);
      dates[k] = { start, end };
    }
  }
  const existing = await readSetting(c, "festival_config", { dates: {} });
  const anniversaryScrollReveal = "anniversaryScrollReveal" in b ? !!b.anniversaryScrollReveal : !!existing.anniversaryScrollReveal;
  await writeSetting(c, "festival_config", { dates, anniversaryScrollReveal });
  const me: any = c.get("admin");
  await logActivity(c, me.id, me.name || me.email, "Updated festival settings");
  return c.json({ ok: true });
});
app.put("/api/admin/homepage/gallery", requireAuth, async (c) => {
  await ensureV3Schema(c);
  let b: any;
  try {
    b = await c.req.json();
  } catch {
    return c.json({ error: "Invalid request" }, 400);
  }
  const rawSlots = Array.isArray(b.slots) ? b.slots : [];
  if (rawSlots.length < MIN_GALLERY_SLOTS) return c.json({ error: `Add at least ${MIN_GALLERY_SLOTS} slots.` }, 400);
  if (rawSlots.length > MAX_GALLERY_SLOTS) return c.json({ error: `A maximum of ${MAX_GALLERY_SLOTS} slots is allowed.` }, 400);
  const pinnedIds: string[] = [];
  const slots: any[] = [];
  for (const raw of rawSlots) {
    if (raw && raw.type === "pinned") {
      const photoId = textField(raw.photo_id, 100);
      if (!photoId) return c.json({ error: "A pinned slot is missing a photo." }, 400);
      pinnedIds.push(photoId);
      slots.push({ type: "pinned", photo_id: photoId });
    } else {
      const category = textField(raw?.category, 100) || "Other";
      slots.push({ type: "category", category });
    }
  }
  if (pinnedIds.length > MAX_PINNED_SLOTS) return c.json({ error: `At most ${MAX_PINNED_SLOTS} slots can be pinned.` }, 400);
  if (pinnedIds.length) {
    const placeholders = pinnedIds.map(() => "?").join(",");
    const found: any = await c.env.DB.prepare(`SELECT id FROM photos WHERE id IN (${placeholders})`)
      .bind(...pinnedIds)
      .all();
    const foundIds = new Set((found.results || []).map((r: any) => String(r.id)));
    const missing = pinnedIds.filter((id) => !foundIds.has(id));
    if (missing.length) return c.json({ error: "One or more pinned photos could not be found." }, 400);
  }
  await writeSetting(c, "gallery_config", { slots, columns: 3 });
  const me: any = c.get("admin");
  await logActivity(c, me.id, me.name || me.email, "Updated the homepage gallery layout");
  return c.json({ ok: true });
});
app.put("/api/admin/homepage/strip", requireAuth, async (c) => {
  await ensureV3Schema(c);
  let b: any;
  try {
    b = await c.req.json();
  } catch {
    return c.json({ error: "Invalid request" }, 400);
  }
  const ids = Array.isArray(b.photo_ids)
    ? b.photo_ids
        .map((x: any) => textField(x, 100))
        .filter(Boolean)
        .slice(0, 8)
    : [];
  if (!ids.length) return c.json({ error: "Choose at least one image." }, 400);
  const interval = boundedInt(b.interval, 3, 15, 7),
    transition = ["slow", "normal", "fast"].includes(String(b.transition)) ? String(b.transition) : "normal",
    reveal = ["none", "slice", "scribble", "curtain", "sweep", "circle"].includes(String(b.reveal)) ? String(b.reveal) : "none";
  await writeSetting(c, "strip_config", { photo_ids: ids, interval, transition, reveal });
  const me: any = c.get("admin");
  await logActivity(c, me.id, me.name || me.email, "Updated the About Us featured roll");
  return c.json({ ok: true });
});
app.put("/api/admin/homepage/about", requireAuth, async (c) => {
  await ensureV3Schema(c);
  let b: any;
  try {
    b = await c.req.json();
  } catch {
    return c.json({ error: "Invalid request" }, 400);
  }
  const text = textField(b.text, 4000);
  if (!text) return c.json({ error: "About text cannot be empty." }, 400);
  const current = await readSetting(c, "about_config", { photo_id: null, text: DEFAULT_ABOUT_TEXT });
  await writeSetting(c, "about_config", { ...current, text });
  const me: any = c.get("admin");
  await logActivity(c, me.id, me.name || me.email, "Updated the About Us text");
  return c.json({ ok: true });
});

app.post("/api/admin/photos/materialize", requireAuth, async (c) => {
  if (!c.env.MEDIA) return c.json({ error: "Permanent photo storage is not connected. Bind an R2 bucket as MEDIA first." }, 503);
  let b: any;
  try {
    b = await c.req.json();
  } catch {
    return c.json({ error: "Invalid request" }, 400);
  }
  const ids = Array.isArray(b.ids)
    ? b.ids
        .map((x: any) => textField(x, 100))
        .filter(Boolean)
        .slice(0, 30)
    : [];
  if (!ids.length) return c.json({ error: "No photos selected." }, 400);
  let stored = 0,
    failed = 0;
  for (const id of ids) {
    const p: any = await c.env.DB.prepare("SELECT * FROM photos WHERE id=? LIMIT 1").bind(id).first();
    if (!p?.image_url || p.r2_key) continue;
    try {
      const r = await fetch(p.image_url, { cf: { image: { format: "webp", quality: 92 } } as any });
      if (!r.ok) throw new Error("image fetch failed");
      const buf = await r.arrayBuffer();
      const key = `photos/instagram/${p.source_id || p.id}.webp`;
      await c.env.MEDIA.put(key, buf, { httpMetadata: { contentType: "image/webp", cacheControl: "public,max-age=31536000,immutable" } });
      await c.env.DB.prepare("UPDATE photos SET r2_key=?,image_url=?,bytes=? WHERE id=?")
        .bind(key, "/media/" + key, buf.byteLength, id)
        .run();
      stored++;
    } catch {
      failed++;
    }
  }
  return c.json({ ok: true, stored, failed });
});
async function materializePhotosBatch(env: any, limit = 8) {
  if (!env.MEDIA) return { stored: 0, failed: 0, refreshed: 0, remaining: 0 };
  const rows = await env.DB.prepare(
    "SELECT id,image_url,source,source_id FROM photos WHERE r2_key IS NULL AND image_url IS NOT NULL AND image_url NOT LIKE '/media/%' LIMIT ?",
  )
    .bind(limit)
    .all();
  const list = (rows.results || []) as any[];
  let stored = 0,
    failed = 0,
    refreshed = 0;
  for (const p of list) {
    let url = String(p.image_url);
    try {
      let r = await fetch(url, { cf: { image: { format: "webp", quality: 92 } } as any });
      if (!r.ok && p.source === "instagram" && p.source_id) {
        const fresh = await refreshInstagramMediaUrl({ env } as any, p.source_id);
        if (fresh) {
          url = fresh;
          await env.DB.prepare("UPDATE photos SET image_url=? WHERE id=?").bind(url, p.id).run();
          refreshed++;
          r = await fetch(url, { cf: { image: { format: "webp", quality: 92 } } as any });
        }
      }
      if (!r.ok) {
        throw new Error("image fetch failed: " + r.status);
      }
      const buf = await r.arrayBuffer();
      const key = `photos/instagram/${p.source_id || p.id}.webp`;
      await env.MEDIA.put(key, buf, { httpMetadata: { contentType: "image/webp", cacheControl: "public,max-age=31536000,immutable" } });
      await env.DB.prepare("UPDATE photos SET r2_key=?,image_url=?,bytes=? WHERE id=?")
        .bind(key, "/media/" + key, buf.byteLength, p.id)
        .run();
      stored++;
    } catch {
      failed++;
    }
  }
  const remaining: any = await env.DB.prepare(
    "SELECT COUNT(*) n FROM photos WHERE r2_key IS NULL AND image_url IS NOT NULL AND image_url NOT LIKE '/media/%'",
  ).first();
  return { stored, failed, refreshed, remaining: Number(remaining?.n || 0) };
}
app.post("/api/admin/photos/materialize-all", requireAuth, async (c) => {
  if (!c.env.MEDIA) return c.json({ error: "Permanent photo storage is not connected. Bind an R2 bucket as MEDIA first." }, 503);
  const r = await materializePhotosBatch(c.env, 8);
  return c.json({ ok: true, ...r });
});
app.post("/api/admin/photos/stack", requireAuth, async (c) => {
  let b: any;
  try {
    b = await c.req.json();
  } catch {
    return c.json({ error: "Invalid request" }, 400);
  }
  const ids = Array.isArray(b.ids)
    ? (Array.from(new Set(b.ids.map((x: any) => textField(x, 100)).filter(Boolean))).slice(0, 30) as string[])
    : [];
  if (ids.length < 2) return c.json({ error: "Select at least 2 photos to stack together." }, 400);
  const groupId = uid();
  for (let i = 0; i < ids.length; i++)
    await c.env.DB.prepare("UPDATE photos SET group_id=?,group_order=? WHERE id=?").bind(groupId, i, ids[i]).run();
  const me: any = c.get("admin");
  await logActivity(c, me.id, me.name || me.email, `Stacked ${ids.length} photos into one tile`);
  return c.json({ ok: true, group_id: groupId });
});
app.post("/api/admin/photos/unstack", requireAuth, async (c) => {
  let b: any;
  try {
    b = await c.req.json();
  } catch {
    return c.json({ error: "Invalid request" }, 400);
  }
  const groupId = textField(b.group_id, 100);
  if (!groupId) return c.json({ error: "Missing group." }, 400);
  await c.env.DB.prepare("UPDATE photos SET group_id=NULL,group_order=0 WHERE group_id=?").bind(groupId).run();
  const me: any = c.get("admin");
  await logActivity(c, me.id, me.name || me.email, "Split a stacked photo group apart");
  return c.json({ ok: true });
});
app.post("/api/admin/instagram/sync", requireAuth, async (c) => {
  let b: any = {};
  try {
    b = await c.req.json();
  } catch {}
  const cursor = typeof b?.cursor === "string" && b.cursor ? b.cursor : undefined;
  try {
    const result: any = await syncInstagramData(c, cursor);
    return c.json(result, result.ok ? 200 : ((result.status || 500) as any));
  } catch (e: any) {
    return c.json({ error: String(e?.message || e || "Instagram sync failed") }, 502);
  }
});
const IG_MEDIA_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  Referer: "https://www.instagram.com/",
};
async function pendingInstagramDownloads(c: any) {
  const r: any = await c.env.DB.prepare(
    "SELECT COUNT(*) n FROM videos WHERE platform='instagram' AND (media_url IS NULL OR media_url NOT LIKE '/media/%') AND COALESCE(download_attempts,0)<5",
  ).first();
  return Number(r?.n || 0);
}
// Downloads queued Instagram video files (and their cover images) into R2.
// Instagram CDN links expire, so a fresh link is requested from the Graph API for every download.
async function downloadInstagramVideos(c: any, limit = 3) {
  const result = { downloaded: 0, failed: 0, pending: 0, error: "" };
  if (!c.env.MEDIA) return result;
  await ensureVideoFileColumns(c);
  const rows: any[] =
    (
      await c.env.DB.prepare(
        "SELECT id,video_id,media_url,thumbnail_url,bytes FROM videos WHERE platform='instagram' AND (media_url IS NULL OR media_url NOT LIKE '/media/%') AND COALESCE(download_attempts,0)<5 ORDER BY sort_order,id LIMIT ?",
      )
        .bind(limit)
        .all()
    ).results || [];
  let conn: any = null;
  if (rows.length) {
    conn = await getInstagramConnection(c);
    if (conn) conn = await refreshInstagramToken(c, conn);
  }
  const version = c.env.INSTAGRAM_GRAPH_VERSION || "v24.0";
  for (const row of rows) {
    const safeId = String(row.video_id || row.id).replace(/[^a-zA-Z0-9_-]/g, "");
    const videoKey = `videos/instagram/${safeId}.mp4`;
    try {
      let videoUrl = String(row.media_url || "");
      let thumbUrl = String(row.thumbnail_url || "").startsWith("/media/") ? "" : String(row.thumbnail_url || "");
      if (conn && row.video_id) {
        const u = new URL(`https://graph.instagram.com/${version}/${encodeURIComponent(row.video_id)}`);
        u.searchParams.set("fields", "media_url,thumbnail_url");
        u.searchParams.set("access_token", conn.access_token);
        const r = await fetch(u);
        const d: any = await r.json().catch(() => ({}));
        if (r.ok && d.media_url) videoUrl = String(d.media_url);
        if (r.ok && d.thumbnail_url && !String(row.thumbnail_url || "").startsWith("/media/")) thumbUrl = String(d.thumbnail_url);
      }
      if (!videoUrl) throw new Error("Instagram did not return a video link");
      const resp = await fetch(videoUrl, { headers: IG_MEDIA_HEADERS });
      if (!resp.ok || !resp.body) throw new Error(`Video download failed (HTTP ${resp.status})`);
      const declared = Number(resp.headers.get("content-length") || 0);
      if (declared > MAX_INSTAGRAM_VIDEO_BYTES) throw new Error("Video is larger than 300 MB");
      const used = await storageUsed(c);
      if (declared && used + declared > storageLimitBytes(c.env)) {
        result.error = "Storage limit reached; remaining Instagram videos were not downloaded.";
        break;
      }
      const ctype = (resp.headers.get("content-type") || "").startsWith("video/") ? String(resp.headers.get("content-type")) : "video/mp4";
      let body: any = resp.body;
      if (!declared) {
        const buf = await resp.arrayBuffer();
        if (buf.byteLength > MAX_INSTAGRAM_VIDEO_BYTES) throw new Error("Video is larger than 300 MB");
        if (used + buf.byteLength > storageLimitBytes(c.env)) {
          result.error = "Storage limit reached; remaining Instagram videos were not downloaded.";
          break;
        }
        body = buf;
      }
      const stored = await c.env.MEDIA.put(videoKey, body, {
        httpMetadata: { contentType: ctype, cacheControl: "public,max-age=31536000,immutable" },
      });
      const fileBytes = Number(stored?.size || declared || 0);
      if (!fileBytes) throw new Error("Downloaded video was empty");
      let posterPath = String(row.thumbnail_url || "").startsWith("/media/") ? String(row.thumbnail_url) : "";
      let posterBytes = posterPath ? Number(row.bytes || 0) : 0;
      if (!posterPath && thumbUrl) {
        try {
          const tr = await fetch(thumbUrl, { headers: { ...IG_MEDIA_HEADERS, Accept: "image/avif,image/webp,image/*,*/*;q=0.8" } });
          if (tr.ok) {
            const tctype = tr.headers.get("content-type") || "image/jpeg";
            const ext = tctype.includes("png") ? "png" : tctype.includes("webp") ? "webp" : "jpg";
            const tbuf = await tr.arrayBuffer();
            if (tbuf.byteLength >= 500) {
              const posterKey = `videos/instagram/${safeId}-poster.${ext}`;
              await c.env.MEDIA.put(posterKey, tbuf, {
                httpMetadata: { contentType: tctype, cacheControl: "public,max-age=31536000,immutable" },
              });
              posterPath = "/media/" + posterKey;
              posterBytes = tbuf.byteLength;
            }
          }
        } catch {}
      }
      await c.env.DB.prepare("UPDATE videos SET media_url=?,thumbnail_url=?,file_bytes=?,bytes=?,download_error='' WHERE id=?")
        .bind("/media/" + videoKey, posterPath, fileBytes, posterBytes, row.id)
        .run();
      result.downloaded++;
    } catch (e: any) {
      await c.env.MEDIA.delete(videoKey).catch(() => {});
      await c.env.DB.prepare("UPDATE videos SET download_attempts=COALESCE(download_attempts,0)+1,download_error=? WHERE id=?")
        .bind(String(e?.message || e || "Download failed").slice(0, 200), row.id)
        .run();
      console.error("IG_VIDEO_DOWNLOAD_ERROR", row.video_id, e?.message);
      result.failed++;
    }
  }
  result.pending = await pendingInstagramDownloads(c);
  return result;
}
app.post("/api/admin/instagram/download-videos", requireAuth, async (c) => {
  try {
    return c.json({ ok: true, ...(await downloadInstagramVideos(c, 3)) });
  } catch (e: any) {
    return c.json({ error: String(e?.message || e || "Video download failed") }, 502);
  }
});
app.post("/api/admin/instagram/download-videos/retry", requireAuth, async (c) => {
  await ensureVideoFileColumns(c);
  await c.env.DB.prepare(
    "UPDATE videos SET download_attempts=0,download_error='' WHERE platform='instagram' AND media_url NOT LIKE '/media/%'",
  ).run();
  return c.json({ ok: true, pending: await pendingInstagramDownloads(c) });
});
app.post("/api/admin/instagram/reels/reset", requireAuth, async (c) => {
  let b: any = {};
  try {
    b = await c.req.json();
  } catch {}
  const cursor = typeof b?.cursor === "string" && b.cursor ? b.cursor : undefined;
  try {
    await ensureInstagramReelIgnoreSchema(c);
    // Restore: forget previously deleted Instagram videos so the sync imports them again.
    // Videos that are already downloaded are kept as they are.
    if (!cursor) await c.env.DB.prepare("DELETE FROM instagram_reel_ignores").run();
    const result: any = await syncInstagramData(c, cursor, true);
    return c.json(result, result.ok ? 200 : ((result.status || 500) as any));
  } catch (e: any) {
    return c.json({ error: String(e?.message || e || "Instagram reels reset failed") }, 502);
  }
});
async function ensureInstagramReelIgnoreSchema(c: any) {
  await c.env.DB.batch([
    c.env.DB.prepare(
      `CREATE TABLE IF NOT EXISTS instagram_reel_ignores (id TEXT PRIMARY KEY,video_id TEXT NOT NULL,source_url TEXT NOT NULL UNIQUE,title TEXT NOT NULL DEFAULT '',category TEXT NOT NULL DEFAULT 'Other',deleted_at INTEGER NOT NULL)`,
    ),
    c.env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_instagram_reel_ignores_video ON instagram_reel_ignores(video_id)"),
  ]);
}
app.get("/media/*", async (c) => {
  if (!c.env.MEDIA) return c.notFound();
  const key = decodeURIComponent(c.req.path.replace(/^\/media\//, ""));
  const rangeHeader = c.req.header("Range") || "";
  const m = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader.trim());
  if (m && (m[1] || m[2])) {
    // Byte-range support so browsers (especially Safari/iOS) can stream and seek videos.
    const head = await c.env.MEDIA.head(key);
    if (!head) return c.notFound();
    const size = head.size;
    let start: number, end: number;
    if (m[1]) {
      start = Number(m[1]);
      end = m[2] ? Math.min(Number(m[2]), size - 1) : size - 1;
    } else {
      const suffix = Number(m[2]);
      start = Math.max(0, size - suffix);
      end = size - 1;
    }
    if (start >= size || end < start)
      return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${size}`, "Accept-Ranges": "bytes" } });
    const obj = await c.env.MEDIA.get(key, { range: { offset: start, length: end - start + 1 } });
    if (!obj) return c.notFound();
    const h = new Headers();
    obj.writeHttpMetadata(h);
    h.set("etag", obj.httpEtag);
    h.set("Accept-Ranges", "bytes");
    h.set("Content-Range", `bytes ${start}-${end}/${size}`);
    h.set("Content-Length", String(end - start + 1));
    return new Response((obj as any).body, { status: 206, headers: h });
  }
  const obj = await c.env.MEDIA.get(key);
  if (!obj) return c.notFound();
  const h = new Headers();
  obj.writeHttpMetadata(h);
  h.set("etag", obj.httpEtag);
  h.set("Accept-Ranges", "bytes");
  h.set("Content-Length", String(obj.size));
  return new Response(obj.body, { headers: h });
});
app.patch("/api/admin/photos/:id", requireAuth, async (c) => {
  let b: any;
  try {
    b = await c.req.json();
  } catch {
    return c.json({ error: "Invalid request" }, 400);
  }
  const out: any = {};
  if ("occasion" in b) {
    if (String(b.occasion).length > 100) return c.json({ error: "Occasion is too long" }, 400);
    out.occasion = textField(b.occasion, 100);
  }
  if ("category" in b) {
    if (String(b.category).length > 100) return c.json({ error: "Category is too long" }, 400);
    out.category = textField(b.category, 100);
  }
  if ("status" in b) {
    if (!["pending", "approved", "rejected"].includes(String(b.status))) return c.json({ error: "Invalid photo status" }, 400);
    out.status = String(b.status);
  }
  if ("published" in b) {
    if (typeof b.published !== "boolean" && b.published !== 0 && b.published !== 1)
      return c.json({ error: "Invalid published value" }, 400);
    out.published = b.published ? 1 : 0;
  }
  if ("caption" in b) {
    if (String(b.caption).length > 2000) return c.json({ error: "Caption is too long" }, 400);
    out.caption = textField(b.caption, 2000);
  }
  if ("total_score" in b) {
    const n = Number(b.total_score);
    if (!Number.isFinite(n) || n < -100000 || n > 100000) return c.json({ error: "Invalid score" }, 400);
    out.total_score = n;
  }
  if ("focal_x" in b) {
    const n = finiteNumber(b.focal_x, 0, 100, 50);
    out.focal_x = n;
  }
  if ("focal_y" in b) {
    const n = finiteNumber(b.focal_y, 0, 100, 50);
    out.focal_y = n;
  }
  if ("focal_zoom" in b) {
    const n = finiteNumber(b.focal_zoom, 1, 2.5, 1);
    out.focal_zoom = n;
  }
  if ("focal_x_mobile" in b) {
    out.focal_x_mobile = b.focal_x_mobile == null ? null : finiteNumber(b.focal_x_mobile, 0, 100, 50);
  }
  if ("focal_y_mobile" in b) {
    out.focal_y_mobile = b.focal_y_mobile == null ? null : finiteNumber(b.focal_y_mobile, 0, 100, 50);
  }
  if ("focal_zoom_mobile" in b) {
    out.focal_zoom_mobile = b.focal_zoom_mobile == null ? null : finiteNumber(b.focal_zoom_mobile, 1, 2.5, 1);
  }
  if ("focal_x_hero" in b) {
    out.focal_x_hero = b.focal_x_hero == null ? null : finiteNumber(b.focal_x_hero, 0, 100, 50);
  }
  if ("focal_y_hero" in b) {
    out.focal_y_hero = b.focal_y_hero == null ? null : finiteNumber(b.focal_y_hero, 0, 100, 50);
  }
  if ("focal_zoom_hero" in b) {
    out.focal_zoom_hero = b.focal_zoom_hero == null ? null : finiteNumber(b.focal_zoom_hero, 1, 2.5, 1);
  }
  if ("focal_x_hero_mobile" in b) {
    out.focal_x_hero_mobile = b.focal_x_hero_mobile == null ? null : finiteNumber(b.focal_x_hero_mobile, 0, 100, 50);
  }
  if ("focal_y_hero_mobile" in b) {
    out.focal_y_hero_mobile = b.focal_y_hero_mobile == null ? null : finiteNumber(b.focal_y_hero_mobile, 0, 100, 50);
  }
  if ("focal_zoom_hero_mobile" in b) {
    out.focal_zoom_hero_mobile = b.focal_zoom_hero_mobile == null ? null : finiteNumber(b.focal_zoom_hero_mobile, 1, 2.5, 1);
  }
  if ("excluded_from_auto" in b) {
    if (typeof b.excluded_from_auto !== "boolean" && b.excluded_from_auto !== 0 && b.excluded_from_auto !== 1)
      return c.json({ error: "Invalid excluded_from_auto value" }, 400);
    out.excluded_from_auto = b.excluded_from_auto ? 1 : 0;
  }
  const keys = Object.keys(out);
  if (!keys.length) return c.json({ ok: true });
  await c.env.DB.prepare(`UPDATE photos SET ${keys.map((x) => `${x}=?`).join(",")},updated_at=CURRENT_TIMESTAMP WHERE id=?`)
    .bind(...keys.map((k) => out[k]), c.req.param("id"))
    .run();
  if ("status" in out) {
    const me: any = c.get("admin");
    await logActivity(c, me.id, me.name || me.email, `Set a photo's status to ${out.status}`);
  }
  return c.json({ ok: true });
});
app.delete("/api/admin/photos/:id", requireAuth, async (c) => {
  const id = c.req.param("id");
  const p: any = await c.env.DB.prepare("SELECT r2_key FROM photos WHERE id=?").bind(id).first();
  if (p?.r2_key && c.env.MEDIA) await c.env.MEDIA.delete(p.r2_key);
  await c.env.DB.prepare("DELETE FROM photos WHERE id=?").bind(id).run();
  const me: any = c.get("admin");
  await logActivity(c, me.id, me.name || me.email, "Deleted a photo");
  return c.json({ ok: true });
});
app.get("/api/admin/services", requireAuth, async (c) =>
  c.json(
    (
      await c.env.DB.prepare(
        "SELECT id,title,description,image_url,active,sort_order,instagram_hashtags FROM services ORDER BY sort_order,id",
      ).all()
    ).results,
  ),
);
app.post("/api/admin/services", requireAuth, async (c) => {
  let b: any;
  try {
    b = await c.req.json();
  } catch {
    return c.json({ error: "Invalid request" }, 400);
  }
  const title = textField(b.title, 200),
    description = textField(b.description, 5000),
    imageUrl = textField(b.image_url, 2048),
    instagramHashtags = textField(b.instagram_hashtags, 1000),
    sortOrder = boundedInt(b.sort_order, -10000, 10000, 0),
    price = finiteNumber(b.price, 0, 100000000, 0);
  if (!title) return c.json({ error: "Service title is required" }, 400);
  if (!validMediaUrl(imageUrl)) return c.json({ error: "Image URL must use http(s) or /media/" }, 400);
  if (
    String(b.title || "").length > 200 ||
    String(b.description || "").length > 5000 ||
    String(b.image_url || "").length > 2048 ||
    String(b.instagram_hashtags || "").length > 1000
  )
    return c.json({ error: "Service fields are too long" }, 400);
  const id = textField(b.id, 100) || uid();
  await c.env.DB.prepare(
    `INSERT INTO services(id,title,description,price,image_url,active,sort_order,instagram_hashtags) VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET title=excluded.title,description=excluded.description,price=excluded.price,image_url=excluded.image_url,active=excluded.active,sort_order=excluded.sort_order,instagram_hashtags=excluded.instagram_hashtags`,
  )
    .bind(id, title, description, price, imageUrl, b.active === false ? 0 : 1, sortOrder, instagramHashtags)
    .run();
  const me: any = c.get("admin");
  await logActivity(c, me.id, me.name || me.email, `Saved category "${title}"`);
  return c.json({ ok: true, id });
});
app.delete("/api/admin/services/:id", requireAuth, async (c) => {
  await c.env.DB.prepare("DELETE FROM services WHERE id=?").bind(c.req.param("id")).run();
  const me: any = c.get("admin");
  await logActivity(c, me.id, me.name || me.email, "Deleted a category");
  return c.json({ ok: true });
});
app.get("/api/admin/hashtags", requireAuth, async (c) => {
  await ensureHashtagSightingsSchema(c);
  const rows = (
    await c.env.DB.prepare(
      "SELECT hashtag,count,last_seen,sample_caption FROM hashtag_sightings WHERE dismissed=0 ORDER BY count DESC,last_seen DESC LIMIT 100",
    ).all()
  ).results;
  return c.json(rows || []);
});
app.post("/api/admin/hashtags/resolve", requireAuth, async (c) => {
  await ensureHashtagSightingsSchema(c);
  await ensureCategoryAliasSchema(c);
  let b: any;
  try {
    b = await c.req.json();
  } catch {
    return c.json({ error: "Invalid request" }, 400);
  }
  const alias = normalizeInstagramHashtag(String(b.alias || ""));
  const category = textField(b.category, 100);
  const originalHashtag = b.hashtag ? normalizeInstagramHashtag(String(b.hashtag)) : "";
  if (!alias) return c.json({ error: "Enter a hashtag to match on" }, 400);
  if (!category) return c.json({ error: "Enter or choose a category" }, 400);
  await c.env.DB.prepare(
    "INSERT INTO category_hashtag_aliases(hashtag,category) VALUES(?,?) ON CONFLICT(hashtag) DO UPDATE SET category=excluded.category",
  )
    .bind(alias, category)
    .run();
  if (originalHashtag) await c.env.DB.prepare("DELETE FROM hashtag_sightings WHERE hashtag=?").bind(originalHashtag).run();
  const candidates: any[] =
    (
      await c.env.DB.prepare("SELECT id,caption FROM photos WHERE published=0 AND caption LIKE ?")
        .bind("%#" + alias + "%")
        .all()
    ).results || [];
  let updated = 0;
  for (const p of candidates) {
    const tags = (String(p.caption || "").match(/#[\p{L}0-9_-]+/gu) || []).map((t: string) => normalizeInstagramHashtag(t));
    if (!tags.some((t) => t.includes(alias))) continue;
    await c.env.DB.prepare("UPDATE photos SET category=?,occasion=?,status=?,published=1,updated_at=CURRENT_TIMESTAMP WHERE id=?")
      .bind(category, category, "approved", p.id)
      .run();
    updated++;
  }
  return c.json({ ok: true, updated });
});
app.post("/api/admin/hashtags/:hashtag/dismiss", requireAuth, async (c) => {
  await ensureHashtagSightingsSchema(c);
  await c.env.DB.prepare("UPDATE hashtag_sightings SET dismissed=1 WHERE hashtag=?")
    .bind(normalizeInstagramHashtag(decodeURIComponent(c.req.param("hashtag"))))
    .run();
  return c.json({ ok: true });
});
app.get("/api/admin/videos", requireAuth, async (c) =>
  c.json((await c.env.DB.prepare("SELECT * FROM videos ORDER BY sort_order,id").all()).results),
);
app.post("/api/admin/videos/:id/push-back", requireAuth, async (c) => {
  const id = c.req.param("id");
  const v: any = await c.env.DB.prepare("SELECT id,platform FROM videos WHERE id=?").bind(id).first();
  if (!v) return c.json({ error: "Video not found" }, 404);
  const row: any = await c.env.DB.prepare("SELECT sort_order FROM videos WHERE platform=? ORDER BY sort_order,id LIMIT 1 OFFSET 10")
    .bind(v.platform)
    .first();
  const pos = row ? Number(row.sort_order) : 11;
  await c.env.DB.prepare("UPDATE videos SET sort_order=? WHERE id=?").bind(pos, id).run();
  return c.json({ ok: true });
});
async function ensureVideoFileColumns(c: any) {
  for (const sql of [
    "ALTER TABLE videos ADD COLUMN bytes INTEGER DEFAULT 0",
    "ALTER TABLE videos ADD COLUMN file_bytes INTEGER DEFAULT 0",
    "ALTER TABLE videos ADD COLUMN download_error TEXT DEFAULT ''",
    "ALTER TABLE videos ADD COLUMN download_attempts INTEGER DEFAULT 0",
  ]) {
    try {
      await c.env.DB.prepare(sql).run();
    } catch {}
  }
}
async function claimUploadedObject(c: any, key: string, reservationId: string, prefix: string) {
  if (!key || !key.startsWith(prefix)) return null;
  const nonce: any = await c.env.DB.prepare("SELECT reservation_id FROM upload_nonces WHERE key=? AND uploaded_at IS NOT NULL")
    .bind(key)
    .first();
  if (!nonce || (reservationId && String(nonce.reservation_id) !== reservationId)) return null;
  const head = await c.env.MEDIA.head(key);
  if (!head) return null;
  return { size: Number(head.size || 0), reservationId: String(nonce.reservation_id || "") };
}
app.post("/api/admin/videos", requireAuth, async (c) => {
  await ensureVideoFileColumns(c);
  let b: any;
  try {
    b = await c.req.json();
  } catch {
    return c.json({ error: "Invalid request" }, 400);
  }
  const title = textField(b.title, 200);
  const category = textField(b.category || "Other", 100) || "Other";
  const me: any = c.get("admin");
  // Editing an existing video (title, category, visibility, order).
  if (b.id) {
    const existing: any = await c.env.DB.prepare("SELECT id,title FROM videos WHERE id=?").bind(String(b.id)).first();
    if (!existing) return c.json({ error: "Video not found" }, 404);
    await c.env.DB.prepare("UPDATE videos SET title=?,category=?,active=?,sort_order=? WHERE id=?")
      .bind(title || existing.title, category, b.active === false ? 0 : 1, boundedInt(b.sort_order, -10000, 10000, 0), existing.id)
      .run();
    await logActivity(c, me.id, me.name || me.email, `Updated video "${title || existing.title}"`);
    return c.json({ ok: true, id: existing.id });
  }
  // New manual upload: the browser has already PUT the file (and optional poster) to R2 via signed URLs.
  if (!c.env.MEDIA) return c.json({ error: "Media storage is not enabled yet." }, 503);
  if (!title) return c.json({ error: "Enter a title for the video." }, 400);
  const video = await claimUploadedObject(c, textField(b.r2_key, 500), textField(b.reservationId, 100), "videos/uploads/");
  if (!video) return c.json({ error: "Uploaded video not found. Please upload it again." }, 400);
  const posterKey = textField(b.poster_key, 500);
  const poster = posterKey ? await claimUploadedObject(c, posterKey, textField(b.posterReservationId, 100), "videos/posters/") : null;
  const id = uid();
  const minOrder: any = await c.env.DB.prepare("SELECT MIN(sort_order) m FROM videos").first();
  const sortOrder = Number(minOrder?.m ?? 1) - 1;
  const writes: any[] = [
    c.env.DB.prepare(
      "INSERT INTO videos(id,title,embed_url,platform,source_url,video_id,category,active,sort_order,thumbnail_url,media_url,bytes,file_bytes) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)",
    ).bind(
      id,
      title,
      "",
      "upload",
      "upload:" + id,
      id,
      category,
      1,
      sortOrder,
      poster ? "/media/" + posterKey : "",
      "/media/" + textField(b.r2_key, 500),
      poster ? poster.size : 0,
      video.size,
    ),
  ];
  for (const r of [video, poster]) {
    if (!r?.reservationId) continue;
    writes.push(
      c.env.DB.prepare(
        "UPDATE storage_quota SET reserved_bytes=MAX(0,reserved_bytes-(SELECT COALESCE(SUM(bytes),0) FROM storage_reservations WHERE id=?)) WHERE id=1",
      ).bind(r.reservationId),
      c.env.DB.prepare("DELETE FROM storage_reservations WHERE id=?").bind(r.reservationId),
      c.env.DB.prepare("DELETE FROM upload_nonces WHERE reservation_id=?").bind(r.reservationId),
    );
  }
  await c.env.DB.batch(writes);
  await logActivity(c, me.id, me.name || me.email, `Uploaded a video: "${title}"`);
  return c.json({ ok: true, id });
});
app.delete("/api/admin/videos/:id", requireAuth, async (c) => {
  await ensureInstagramReelIgnoreSchema(c);
  const id = c.req.param("id");
  const v: any = await c.env.DB.prepare(
    "SELECT id,title,platform,source_url,video_id,category,thumbnail_url,media_url FROM videos WHERE id=?",
  )
    .bind(id)
    .first();
  if (!v) return c.json({ error: "Video not found" }, 404);
  if (c.env.MEDIA) {
    for (const url of [v.thumbnail_url, v.media_url]) {
      if (url && String(url).startsWith("/media/")) await c.env.MEDIA.delete(String(url).replace(/^\/media\//, "")).catch(() => {});
    }
  }
  if (String(v.platform) === "instagram" && v.video_id) {
    // Remember the deletion so the next Instagram sync does not download it again.
    const sourceUrl = String(v.source_url || "");
    await c.env.DB.prepare(
      "INSERT INTO instagram_reel_ignores(id,video_id,source_url,title,category,deleted_at) VALUES(?,?,?,?,?,?) ON CONFLICT(source_url) DO UPDATE SET video_id=excluded.video_id,title=excluded.title,category=excluded.category,deleted_at=excluded.deleted_at",
    )
      .bind(uid(), String(v.video_id), sourceUrl, String(v.title || "Instagram video"), String(v.category || "Other"), Date.now())
      .run();
  }
  await c.env.DB.prepare("DELETE FROM videos WHERE id=?").bind(id).run();
  const me: any = c.get("admin");
  await logActivity(c, me.id, me.name || me.email, `Deleted a video: "${v.title || ""}"`);
  return c.json({ ok: true });
});
app.get("/api/admin/admins", requireAuth, async (c) => {
  const me: any = c.get("admin");
  if (me.role !== "owner") return c.json({ error: "Owner only" }, 403);
  await ensureAdminInvitationsSchema(c);
  return c.json((await c.env.DB.prepare("SELECT id,name,email,role,active,created_at FROM admins ORDER BY created_at").all()).results);
});
app.get("/api/admin/activity-log", requireAuth, async (c) => {
  const me: any = c.get("admin");
  if (me.role !== "owner") return c.json({ error: "Owner only" }, 403);
  const r = await c.env.DB.prepare("SELECT id,admin_name,action,created_at FROM activity_log ORDER BY created_at DESC LIMIT 2000").all();
  return c.json(r.results || []);
});
app.post("/api/admin/admin-invites", requireAuth, async (c) => {
  const me: any = c.get("admin");
  if (me.role !== "owner") return c.json({ error: "Owner only" }, 403);
  await ensureAdminInvitationsSchema(c);
  let b: any;
  try {
    b = await c.req.json();
  } catch {
    return c.json({ error: "Invalid request" }, 400);
  }
  const email = String(b.email || "")
    .trim()
    .toLowerCase();
  if (!validEmail(email)) return c.json({ error: "Enter a valid email address" }, 400);
  if (!(await rateLimit(c, `admin-invite-ip:${clientIp(c)}`, 20, 60 * 60 * 1000, 60 * 60 * 1000)))
    return c.json({ error: "Too many invitations. Please try again later." }, 429);
  if (setupOwnerEmails(c.env).includes(email)) return c.json({ error: "The Owner email cannot be invited as an admin." }, 400);
  const existing: any = await c.env.DB.prepare("SELECT id FROM admins WHERE email=? LIMIT 1").bind(email).first();
  if (existing) return c.json({ error: "That email is already an admin" }, 409);
  const now = Date.now();
  await c.env.DB.prepare("DELETE FROM admin_invitations WHERE expires_at<=? OR used_at IS NOT NULL").bind(now).run();
  const previous: any = await c.env.DB.prepare(
    "SELECT id FROM admin_invitations WHERE email=? AND used_at IS NULL ORDER BY created_at DESC LIMIT 1",
  )
    .bind(email)
    .first();
  if (previous) await c.env.DB.prepare("DELETE FROM admin_invitations WHERE id=?").bind(previous.id).run();
  const counts: any = await c.env.DB.prepare(
    `SELECT (SELECT COUNT(*) FROM admins WHERE role='admin' AND active=1) active_count,(SELECT COUNT(*) FROM admin_invitations WHERE used_at IS NULL AND expires_at>?) pending_count`,
  )
    .bind(now)
    .first();
  if (Number(counts?.active_count || 0) + Number(counts?.pending_count || 0) >= 5)
    return c.json({ error: "The maximum of 5 Admin accounts has been reached. Delete an Admin or wait for an invitation to expire." }, 409);
  const raw = b64u(crypto.getRandomValues(new Uint8Array(32)));
  const tokenHash = await sha256(raw);
  const id = uid();
  const expiresAt = now + 12 * 60 * 60 * 1000;
  const url = new URL("/admin/invite", c.req.url);
  url.searchParams.set("token", raw);
  await c.env.DB.prepare("INSERT INTO admin_invitations(id,email,token_hash,expires_at) VALUES(?,?,?,?)")
    .bind(id, email, tokenHash, expiresAt)
    .run();
  await logActivity(c, me.id, me.name || me.email, `Invited ${email} as an admin`);
  try {
    await sendAdminInvitation(c, email, url.toString());
  } catch (e: any) {
    console.error("ADMIN_INVITE_EMAIL_ERROR", e?.name || "Error", e?.message || String(e));
    return c.json(
      {
        ok: false,
        inviteUrl: url.toString(),
        expiresAt,
        error:
          "The invitation email could not be delivered. The invitation is still valid; use the invitation link to complete setup, or verify the Resend sender/domain configuration.",
      },
      503,
    );
  }
  return c.json({ ok: true, expiresAt });
});
app.get("/api/admin/admin-invites/:token", async (c) => {
  await ensureAdminInvitationsSchema(c);
  const raw = c.req.param("token");
  if (!raw || raw.length < 20) return c.json({ error: "Invalid invitation" }, 400);
  const row: any = await c.env.DB.prepare("SELECT email,expires_at,used_at FROM admin_invitations WHERE token_hash=? LIMIT 1")
    .bind(await sha256(raw))
    .first();
  if (!row || row.used_at) return c.json({ error: "This invitation has already been used." }, 410);
  if (Number(row.expires_at) < Date.now())
    return c.json({ error: "This invitation has expired. Ask the Owner to send a new invitation." }, 410);
  return c.json({ ok: true, email: row.email, expiresAt: Number(row.expires_at) });
});
app.post("/api/admin/invites/complete", async (c) => {
  await ensureAdminInvitationsSchema(c);
  let b: any;
  try {
    b = await c.req.json();
  } catch {
    return c.json({ error: "Invalid request" }, 400);
  }
  const raw = String(b.token || "");
  const name = String(b.name || "").trim();
  const email = String(b.email || "")
    .trim()
    .toLowerCase();
  const password = String(b.password || "");
  const confirm = String(b.confirmPassword || "");
  if (!raw || raw.length < 20) return c.json({ error: "Invalid invitation" }, 400);
  const row: any = await c.env.DB.prepare("SELECT * FROM admin_invitations WHERE token_hash=? LIMIT 1")
    .bind(await sha256(raw))
    .first();
  if (!row || row.used_at) return c.json({ error: "This invitation has already been used." }, 410);
  if (Number(row.expires_at) < Date.now())
    return c.json({ error: "This invitation has expired. Ask the Owner to send a new invitation." }, 410);
  if (email !== String(row.email).toLowerCase()) return c.json({ error: "The verified email does not match this invitation." }, 400);
  if (!name || name.length > 100) return c.json({ error: "Enter your name." }, 400);
  if (password.length < 12 || password.length > 128) return c.json({ error: "Password must be 12–128 characters." }, 400);
  if (password !== confirm) return c.json({ error: "Passwords do not match" }, 400);
  const active: any = await c.env.DB.prepare(`SELECT COUNT(*) n FROM admins WHERE role='admin' AND active=1`).first();
  if (Number(active?.n || 0) >= 5) return c.json({ error: "The maximum of 5 Admin accounts has been reached." }, 409);
  const adminId = uid();
  try {
    const passwordHash = await hashPassword(password);
    const result = await c.env.DB.batch([
      c.env.DB.prepare("INSERT INTO admins(id,name,email,password_hash,role,active) VALUES(?,?,?,?,?,1)").bind(
        adminId,
        name,
        email,
        passwordHash,
        "admin",
      ),
      c.env.DB.prepare("UPDATE admin_invitations SET used_at=? WHERE id=? AND used_at IS NULL").bind(Date.now(), row.id),
    ]);
    if (result.some((r: any) => r?.success === false)) throw new Error("Database batch returned an unsuccessful statement");
    await logActivity(c, adminId, name, "Joined as an admin (accepted invitation)");
  } catch (e: any) {
    if (
      String(e?.message || "")
        .toLowerCase()
        .includes("unique")
    )
      return c.json({ error: "That email is already an admin" }, 409);
    console.error("ADMIN_INVITE_COMPLETE_ERROR", e?.name || "Error", e?.message || String(e));
    return c.json({ error: "Admin account could not be created. Please try again." }, 500);
  }
  return c.json({ ok: true });
});
app.delete("/api/admin/admins/:id", requireAuth, async (c) => {
  const me: any = c.get("admin");
  if (me.role !== "owner") return c.json({ error: "Owner only" }, 403);
  if (c.req.param("id") === me.id) return c.json({ error: "Cannot delete yourself" }, 400);
  const target: any = await c.env.DB.prepare("SELECT name,email FROM admins WHERE id=?").bind(c.req.param("id")).first();
  await c.env.DB.prepare("DELETE FROM admins WHERE id=? AND role='admin'").bind(c.req.param("id")).run();
  await logActivity(c, me.id, me.name || me.email, `Removed admin ${target?.name || target?.email || ""}`);
  return c.json({ ok: true });
});
app.post("/api/admin/admins/:id/make-owner", requireAuth, async (c) => {
  const me: any = c.get("admin");
  if (me.role !== "owner") return c.json({ error: "Owner only" }, 403);
  const targetId = c.req.param("id");
  if (targetId === me.id) return c.json({ error: "You are already the Owner." }, 400);
  const target: any = await c.env.DB.prepare("SELECT id,name,email,active FROM admins WHERE id=? AND role='admin'").bind(targetId).first();
  if (!target) return c.json({ error: "Admin not found." }, 404);
  if (!target.active) return c.json({ error: "This admin account is not active." }, 400);
  const result = await c.env.DB.batch([
    c.env.DB.prepare("UPDATE admins SET role='owner' WHERE id=?").bind(targetId),
    c.env.DB.prepare("UPDATE admins SET role='admin' WHERE id=?").bind(me.id),
  ]);
  if (result.some((r: any) => r?.success === false)) return c.json({ error: "Ownership transfer failed. Please try again." }, 500);
  await logActivity(c, me.id, me.name || me.email, `Transferred Owner access to ${target.name || target.email}`);
  return c.json({ ok: true });
});
app.get("/api/admin/testimonials", requireAuth, async (c) => {
  await ensureInterimTestimonialsTable(c);
  const rows: any = await c.env.DB.prepare(
    "SELECT id,author_name,rating,review_text,relative_time,verified,active,sort_order,image_url,created_at FROM testimonials ORDER BY sort_order,created_at DESC",
  ).all();
  return c.json(rows.results || []);
});
app.post("/api/admin/testimonials", requireAuth, async (c) => {
  await ensureInterimTestimonialsTable(c);
  let b: any;
  try {
    b = await c.req.json();
  } catch {
    return c.json({ error: "Invalid request" }, 400);
  }
  const id = textField(b.id, 100) || uid(),
    author = textField(b.author_name, 100),
    text = textField(b.review_text, 1000),
    relative = textField(b.relative_time, 60),
    image = textField(b.image_url, 500),
    rating = Math.max(1, Math.min(5, Math.round(Number(b.rating) || 5))),
    sortOrder = boundedInt(b.sort_order, -10000, 10000, 0);
  if (!author) return c.json({ error: "Enter the reviewer's name." }, 400);
  if (String(b.review_text || "").length > 1000) return c.json({ error: "Review text is too long." }, 400);
  await c.env.DB.prepare(
    `INSERT INTO testimonials(id,source,author_name,rating,review_text,relative_time,verified,active,sort_order,image_url) VALUES(?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET author_name=excluded.author_name,rating=excluded.rating,review_text=excluded.review_text,relative_time=excluded.relative_time,verified=excluded.verified,active=excluded.active,sort_order=excluded.sort_order,image_url=excluded.image_url`,
  )
    .bind(id, "manual", author, rating, text, relative, b.verified === false ? 0 : 1, b.active === false ? 0 : 1, sortOrder, image)
    .run();
  const me: any = c.get("admin");
  await logActivity(c, me.id, me.name || me.email, `Saved a testimonial from "${author}"`);
  return c.json({ ok: true, id });
});
app.delete("/api/admin/testimonials/:id", requireAuth, async (c) => {
  await ensureInterimTestimonialsTable(c);
  await c.env.DB.prepare("DELETE FROM testimonials WHERE id=?").bind(c.req.param("id")).run();
  const me: any = c.get("admin");
  await logActivity(c, me.id, me.name || me.email, "Deleted a testimonial");
  return c.json({ ok: true });
});
const BOT_UA_PATTERN =
  /bot|spider|crawl|slurp|headless|phantomjs|puppeteer|playwright|selenium|lighthouse|pagespeed|gtmetrix|pingdom|uptimerobot|statuscake|site24x7|nessus|nmap|sqlmap|nikto|masscan|zgrab|censys|shodan|ahrefsbot|semrushbot|mj12bot|dotbot|facebookexternalhit|twitterbot|linkedinbot|slackbot|whatsapp|telegrambot|discordbot|archive\.org|ia_archiver|go-http-client|python-requests|curl\/|wget\/|okhttp|axios\/|node-fetch|postmanruntime|insomnia|scrapy|httpclient/i;
const CLICK_ACTIONS = new Set([
  "whatsapp_nav",
  "whatsapp_hero",
  "whatsapp_bubble",
  "whatsapp_widget_chat",
  "whatsapp_contact_card",
  "whatsapp_contact_form",
  "whatsapp_band",
  "whatsapp_footer",
  "quote_nav",
  "quote_hero",
  "call_click",
]);
app.post("/api/track-click", async (c) => {
  const uaRaw = c.req.header("user-agent") || "";
  if (!uaRaw || BOT_UA_PATTERN.test(uaRaw)) return c.json({ ok: true, skipped: true });
  let body: any = {};
  try {
    body = await c.req.json();
  } catch {}
  const action = String(body?.action || "");
  if (!CLICK_ACTIONS.has(action)) return c.json({ ok: true, skipped: true });
  const day = new Date().toISOString().slice(0, 10);
  await c.env.DB.prepare(`INSERT INTO analytics_clicks(day,action,count) VALUES(?,?,1) ON CONFLICT(day,action) DO UPDATE SET count=count+1`)
    .bind(day, action)
    .run();
  return c.json({ ok: true });
});
app.post("/api/analytics", async (c) => {
  const uaRaw = c.req.header("user-agent") || "";
  if (!uaRaw || BOT_UA_PATTERN.test(uaRaw)) return c.json({ ok: true, skipped: true });
  if (await session(c, c.env)) return c.json({ ok: true, skipped: true });
  const day = new Date().toISOString().slice(0, 10);
  const m = c.req.header("sec-ch-ua-mobile") === "?1";
  const ua = uaRaw.toLowerCase();
  const device = m ? "mobile" : /ipad|tablet|android(?!.*mobile)/.test(ua) ? "tablet" : "desktop";
  const seen = getCookie(c, "ip_visitor") === "1";
  await c.env.DB.prepare(
    `INSERT INTO analytics_daily(day,visitors,pageviews,mobile,desktop,tablet,other) VALUES(?,${seen ? 0 : 1},1,${device === "mobile" ? 1 : 0},${device === "desktop" ? 1 : 0},${device === "tablet" ? 1 : 0},${device === "other" ? 1 : 0}) ON CONFLICT(day) DO UPDATE SET visitors=visitors+excluded.visitors,pageviews=pageviews+1,mobile=mobile+excluded.mobile,desktop=desktop+excluded.desktop,tablet=tablet+excluded.tablet,other=other+excluded.other`,
  )
    .bind(day)
    .run();
  if (!seen) setCookie(c, "ip_visitor", "1", { httpOnly: true, secure: true, sameSite: "Lax", path: "/", maxAge: 86400 });
  return c.json({ ok: true });
});
app.all("*", (c) => c.env.ASSETS?.fetch(c.req.raw) || c.notFound());
export default {
  fetch: app.fetch,
  scheduled: async (_controller: any, env: Env) => {
    try {
      const now = Date.now();
      const orphaned: any = await env.DB.prepare(
        "SELECT id,reservation_id,key FROM upload_nonces WHERE uploaded_at IS NOT NULL AND uploaded_at<? LIMIT 100",
      )
        .bind(now - 60 * 60 * 1000)
        .all();
      for (const n of orphaned.results || []) {
        const photo: any = await env.DB.prepare("SELECT id FROM photos WHERE r2_key=? LIMIT 1").bind(n.key).first();
        const video: any = photo
          ? null
          : await env.DB.prepare("SELECT id FROM videos WHERE media_url=? OR thumbnail_url=? LIMIT 1")
              .bind("/media/" + n.key, "/media/" + n.key)
              .first();
        if (photo || video) {
          await env.DB.prepare("DELETE FROM upload_nonces WHERE id=?").bind(n.id).run();
          continue;
        }
        if (env.MEDIA) await env.MEDIA.delete(n.key).catch(() => {});
        await releaseStorage({ env } as any, n.reservation_id);
        await env.DB.prepare("DELETE FROM upload_nonces WHERE id=?").bind(n.id).run();
      }
      const staleUploads: any = await env.DB.prepare(
        "SELECT id,reservation_id,key FROM upload_nonces WHERE used_at IS NOT NULL AND uploaded_at IS NULL AND used_at<? LIMIT 100",
      )
        .bind(now - 60 * 60 * 1000)
        .all();
      for (const n of staleUploads.results || []) {
        if (env.MEDIA) await env.MEDIA.delete(n.key).catch(() => {});
        await releaseStorage({ env } as any, n.reservation_id);
        await env.DB.prepare("DELETE FROM upload_nonces WHERE id=?").bind(n.id).run();
      }
      await env.DB.batch([
        env.DB.prepare("DELETE FROM sessions WHERE expires_at<=?").bind(now),
        env.DB.prepare("DELETE FROM setup_verifications WHERE used_at IS NOT NULL OR expires_at<?").bind(now),
        env.DB.prepare("DELETE FROM auth_rate_limits WHERE window_start<? AND blocked_until<?").bind(now - 24 * 60 * 60 * 1000, now),
        env.DB.prepare("DELETE FROM upload_nonces WHERE expires_at<? AND uploaded_at IS NULL").bind(now),
        env.DB.prepare("DELETE FROM activity_log WHERE created_at<datetime('now','-60 days')"),
      ]);
      const stale: any = await env.DB.prepare("SELECT id FROM storage_reservations WHERE expires_at<?").bind(now).all();
      for (const r of stale.results || []) await releaseStorage({ env } as any, r.id);
      await syncInstagramData({ env }).catch(() => {});
      // Keep downloading queued Instagram videos in the background.
      for (let round = 0; round < 6; round++) {
        const d = await downloadInstagramVideos({ env }, 3).catch(() => null);
        if (!d || !d.pending || d.error || (!d.downloaded && !d.failed)) break;
      }
      if (env.MEDIA) {
        let rounds = 0;
        while (rounds < 40) {
          const r = await materializePhotosBatch(env, 8);
          rounds++;
          if (!r.remaining) break;
          if (!r.stored && !r.refreshed) break;
        }
      }
    } catch {}
  },
};
