export const config = { runtime: "edge" };

const ACCESS_COOKIE = "blh_access";
const REFRESH_COOKIE = "blh_refresh";
const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
  "x-content-type-options": "nosniff",
};

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...JSON_HEADERS, ...headers },
  });
}

function env() {
  const url = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("Supabase is not configured");
  return { url, key };
}

function adminEnv() {
  const { url } = env();
  const secret = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) throw new Error("Supabase admin is not configured");
  return { url, secret };
}

function cookies(request) {
  return Object.fromEntries(
    (request.headers.get("cookie") || "")
      .split(";")
      .map((part) => part.trim().split(/=(.*)/s).slice(0, 2))
      .filter(([name]) => name),
  );
}

function cookie(name, value, maxAge) {
  return `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}

function sessionHeaders(session) {
  const headers = new Headers(JSON_HEADERS);
  headers.append("set-cookie", cookie(ACCESS_COOKIE, session.access_token, Math.max(60, session.expires_in || 3600)));
  headers.append("set-cookie", cookie(REFRESH_COOKIE, session.refresh_token, 60 * 60 * 24 * 30));
  return headers;
}

function clearSessionHeaders() {
  const headers = new Headers(JSON_HEADERS);
  headers.append("set-cookie", cookie(ACCESS_COOKIE, "", 0));
  headers.append("set-cookie", cookie(REFRESH_COOKIE, "", 0));
  return headers;
}

function sameOrigin(request) {
  const site = request.headers.get("sec-fetch-site");
  if (site === "cross-site") return false;
  const origin = request.headers.get("origin");
  return !origin || origin === new URL(request.url).origin;
}

async function body(request) {
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    throw new Error("invalid_content_type");
  }
  const parsed = await request.json();
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("invalid_body");
  return parsed;
}

async function supabase(path, init = {}) {
  const { url, key } = env();
  const headers = new Headers(init.headers);
  headers.set("apikey", key);
  headers.set("content-type", "application/json");
  return fetch(`${url}/auth/v1${path}`, { ...init, headers });
}

async function supabaseData(path, accessToken, init = {}) {
  const { url, key } = env();
  const headers = new Headers(init.headers);
  headers.set("apikey", key);
  headers.set("authorization", `Bearer ${accessToken}`);
  headers.set("content-type", "application/json");
  return fetch(`${url}/rest/v1/${path}`, { ...init, headers });
}

async function supabaseAdmin(path, init = {}) {
  const { url, secret } = adminEnv();
  const headers = new Headers(init.headers);
  headers.set("apikey", secret);
  headers.set("authorization", `Bearer ${secret}`);
  headers.set("content-type", "application/json");
  return fetch(`${url}/auth/v1${path}`, { ...init, headers });
}

async function supabaseAdminData(path, init = {}) {
  const { url, secret } = adminEnv();
  const headers = new Headers(init.headers);
  headers.set("apikey", secret);
  headers.set("authorization", `Bearer ${secret}`);
  headers.set("content-type", "application/json");
  return fetch(`${url}/rest/v1/${path}`, { ...init, headers });
}

async function userForToken(token) {
  if (!token) return null;
  const response = await supabase("/user", { headers: { authorization: `Bearer ${token}` } });
  if (!response.ok) return null;
  return response.json();
}

async function currentSession(request) {
  const values = cookies(request);
  const accessToken = decodeURIComponent(values[ACCESS_COOKIE] || "");
  const refreshToken = decodeURIComponent(values[REFRESH_COOKIE] || "");
  let user = await userForToken(accessToken);
  if (user) return { user, accessToken, refreshed: null };
  if (!refreshToken) return null;

  const response = await supabase("/token?grant_type=refresh_token", {
    method: "POST",
    body: JSON.stringify({ refresh_token: refreshToken }),
  });
  if (!response.ok) return null;
  const session = await response.json();
  user = session.user || (await userForToken(session.access_token));
  return user ? { user, accessToken: session.access_token, refreshed: session } : null;
}

function publicUser(user) {
  return {
    id: user.id,
    email: user.email,
    name: user.user_metadata?.full_name || user.email?.split("@")[0] || "BLH",
    isAdmin: user.app_metadata?.role === "super_admin",
  };
}

async function requireSuperAdmin(request) {
  const session = await currentSession(request);
  if (!session) return { error: json({ error: "authentication_required" }, 401) };
  if (session.user.app_metadata?.role !== "super_admin") return { error: json({ error: "admin_required" }, 403) };
  return { session };
}

function adminUser(user) {
  return {
    id: user.id,
    email: user.email || "",
    name: user.user_metadata?.full_name || user.email?.split("@")[0] || "Utilisateur",
    createdAt: user.created_at || null,
    updatedAt: user.updated_at || null,
    lastSignInAt: user.last_sign_in_at || null,
    emailConfirmedAt: user.email_confirmed_at || user.confirmed_at || null,
    bannedUntil: user.banned_until || null,
    provider: user.app_metadata?.provider || user.identities?.[0]?.provider || "email",
    isAdmin: user.app_metadata?.role === "super_admin",
  };
}

async function auditAdminAction(session, target, action, details = {}) {
  await supabaseAdminData("admin_audit_logs", {
    method: "POST",
    headers: { prefer: "return=minimal" },
    body: JSON.stringify({
      admin_user_id: session.user.id,
      target_user_id: target?.id || null,
      target_email: target?.email || null,
      action,
      details,
    }),
  }).catch(() => {});
}

async function listAdminUsers(request) {
  const authorization = await requireSuperAdmin(request);
  if (authorization.error) return authorization.error;
  const response = await supabaseAdmin("/admin/users?page=1&per_page=1000");
  if (!response.ok) return json({ error: "admin_users_unavailable" }, 503);
  const result = await response.json();
  const users = (result.users || []).map(adminUser);
  const auditResponse = await supabaseAdminData("admin_audit_logs?select=id,created_at,action,target_email,details&order=created_at.desc&limit=30");
  const audit = auditResponse.ok ? await auditResponse.json() : [];
  return sessionJson({ users, audit, total: result.total ?? users.length }, 200, authorization.session);
}

async function adminUserAction(request) {
  const authorization = await requireSuperAdmin(request);
  if (authorization.error) return authorization.error;
  const data = await body(request);
  const action = cleanText(data.action, 30);
  if (!uuid(data.userId) || !["ban", "unban", "recovery", "delete"].includes(action)) return json({ error: "invalid_admin_action" }, 400);

  const lookup = await supabaseAdmin(`/admin/users/${encodeURIComponent(data.userId)}`);
  if (!lookup.ok) return json({ error: "user_not_found" }, 404);
  const target = await lookup.json();
  if (target.app_metadata?.role === "super_admin" && action !== "recovery") return json({ error: "protected_super_admin" }, 409);

  let response;
  if (action === "recovery") {
    response = await supabase(`/recover?redirect_to=${encodeURIComponent(`${new URL(request.url).origin}/`)}`, {
      method: "POST",
      body: JSON.stringify({ email: target.email }),
    });
  } else if (action === "delete") {
    response = await supabaseAdmin(`/admin/users/${encodeURIComponent(target.id)}?should_soft_delete=true`, { method: "DELETE" });
  } else {
    response = await supabaseAdmin(`/admin/users/${encodeURIComponent(target.id)}`, {
      method: "PUT",
      body: JSON.stringify({ ban_duration: action === "ban" ? "876000h" : "none" }),
    });
  }
  if (!response.ok) return json({ error: `admin_${action}_failed` }, 400);
  await auditAdminAction(authorization.session, target, action, { softDelete: action === "delete" });
  return sessionJson({ ok: true, action }, 200, authorization.session);
}

function sessionJson(data, status, session) {
  const headers = session.refreshed ? sessionHeaders(session.refreshed) : new Headers(JSON_HEADERS);
  return new Response(JSON.stringify(data), { status, headers });
}

function uuid(value) {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function finite(value, min = -1e9, max = 1e9) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= min && number <= max ? number : null;
}

function cleanText(value, max) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function journalPayload(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const symbol = ["XAU/USD", "BTC/USD"].includes(value.symbol) ? value.symbol : null;
  const interval = ["1min", "5min", "15min", "30min", "1h"].includes(value.interval) ? value.interval : null;
  const status = ["snapshot", "planned", "active", "win", "loss", "breakeven", "cancelled"].includes(value.status) ? value.status : "snapshot";
  const direction = ["buy", "sell", "observation"].includes(value.direction) ? value.direction : "observation";
  if (!symbol || !interval) return null;
  const payload = {
    symbol,
    interval,
    status,
    direction,
    savedAt: finite(value.savedAt, 1, Date.now() + 86400000) || Date.now(),
    candleTime: finite(value.candleTime, 1, Date.now() + 86400000),
    price: finite(value.price),
    entry: finite(value.entry),
    stopLoss: finite(value.stopLoss),
    takeProfits: Array.isArray(value.takeProfits) ? value.takeProfits.slice(0, 3).map(item => finite(item)).filter(item => item !== null) : [],
    exitPrice: finite(value.exitPrice),
    riskPercent: finite(value.riskPercent, 0.01, 100),
    positionSize: finite(value.positionSize, 0, 1e7),
    resultR: finite(value.resultR, -1000, 1000),
    source: cleanText(value.source, 80),
    signalKey: cleanText(value.signalKey, 180),
    notes: cleanText(value.notes, 2000),
    indicators: Array.isArray(value.indicators) ? value.indicators.slice(0, 12).map(item => cleanText(item, 50)).filter(Boolean) : [],
    settings: value.settings && typeof value.settings === "object" && !Array.isArray(value.settings) ? value.settings : {},
  };
  if (JSON.stringify(payload).length > 12000) return null;
  return payload;
}

async function workspaceData(request) {
  const session = await currentSession(request);
  if (!session) return json({ error: "authentication_required" }, 401);
  const queries = [
    "analysis_snapshots?select=id,created_at,updated_at,kind,payload&order=created_at.desc&limit=500",
    "notification_preferences?select=*&limit=1",
    "user_notifications?select=id,created_at,kind,title,body,signal_key,is_read,metadata&order=created_at.desc&limit=50",
  ];
  const responses = await Promise.all(queries.map(path => supabaseData(path, session.accessToken)));
  if (responses.some(response => !response.ok)) return json({ error: "workspace_unavailable" }, 503);
  const [journal, preferences, notifications] = await Promise.all(responses.map(response => response.json()));
  return sessionJson({ journal, preferences: preferences[0] || null, notifications }, 200, session);
}

async function saveJournal(request) {
  const session = await currentSession(request);
  if (!session) return json({ error: "authentication_required" }, 401);
  const data = await body(request);
  const payload = journalPayload(data.payload);
  if (!uuid(data.id) || !payload) return json({ error: "invalid_journal_entry" }, 400);
  const response = await supabaseData("analysis_snapshots", session.accessToken, {
    method: "POST",
    headers: { prefer: "return=representation" },
    body: JSON.stringify({ id: data.id, user_id: session.user.id, kind: data.kind === "trade" ? "trade" : "snapshot", payload }),
  });
  const result = await response.json().catch(() => []);
  if (!response.ok) return json({ error: "journal_save_failed" }, 400);
  return sessionJson({ entry: result[0] || null }, 201, session);
}

async function updateJournal(request, url) {
  const session = await currentSession(request);
  if (!session) return json({ error: "authentication_required" }, 401);
  const id = url.searchParams.get("id");
  const data = await body(request);
  const payload = journalPayload(data.payload);
  if (!uuid(id) || !payload) return json({ error: "invalid_journal_entry" }, 400);
  const path = `analysis_snapshots?id=eq.${encodeURIComponent(id)}&user_id=eq.${encodeURIComponent(session.user.id)}`;
  const response = await supabaseData(path, session.accessToken, {
    method: "PATCH",
    headers: { prefer: "return=representation" },
    body: JSON.stringify({ kind: data.kind === "trade" ? "trade" : "snapshot", payload, updated_at: new Date().toISOString() }),
  });
  const result = await response.json().catch(() => []);
  if (!response.ok || !result.length) return json({ error: "journal_update_failed" }, 400);
  return sessionJson({ entry: result[0] }, 200, session);
}

async function savePreferences(request) {
  const session = await currentSession(request);
  if (!session) return json({ error: "authentication_required" }, 401);
  const data = await body(request);
  const boolean = key => data[key] !== false;
  const quiet = value => typeof value === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(value) ? value : null;
  const preferences = {
    user_id: session.user.id,
    new_signal: boolean("new_signal"),
    entry_zone: boolean("entry_zone"),
    target_hit: boolean("target_hit"),
    stop_loss: boolean("stop_loss"),
    signal_updates: boolean("signal_updates"),
    browser_notifications: data.browser_notifications === true,
    quiet_start: quiet(data.quiet_start),
    quiet_end: quiet(data.quiet_end),
    updated_at: new Date().toISOString(),
  };
  const response = await supabaseData("notification_preferences?on_conflict=user_id", session.accessToken, {
    method: "POST",
    headers: { prefer: "resolution=merge-duplicates,return=representation" },
    body: JSON.stringify(preferences),
  });
  const result = await response.json().catch(() => []);
  if (!response.ok) return json({ error: "preferences_save_failed" }, 400);
  return sessionJson({ preferences: result[0] || preferences }, 200, session);
}

async function createNotification(request) {
  const session = await currentSession(request);
  if (!session) return json({ error: "authentication_required" }, 401);
  const data = await body(request);
  const title = cleanText(data.title, 120), notificationBody = cleanText(data.body, 500), signalKey = cleanText(data.signalKey, 180);
  if (!uuid(data.id) || !title || !notificationBody || !signalKey) return json({ error: "invalid_notification" }, 400);
  const metadata = data.metadata && typeof data.metadata === "object" && !Array.isArray(data.metadata) ? data.metadata : {};
  if (JSON.stringify(metadata).length > 4000) return json({ error: "invalid_notification" }, 400);
  const response = await supabaseData("user_notifications?on_conflict=user_id,signal_key", session.accessToken, {
    method: "POST",
    headers: { prefer: "resolution=ignore-duplicates,return=representation" },
    body: JSON.stringify({ id: data.id, user_id: session.user.id, kind: "signal", title, body: notificationBody, signal_key: signalKey, metadata }),
  });
  const result = await response.json().catch(() => []);
  if (!response.ok) return json({ error: "notification_save_failed" }, 400);
  return sessionJson({ notification: result[0] || null }, 201, session);
}

async function readNotifications(request) {
  const session = await currentSession(request);
  if (!session) return json({ error: "authentication_required" }, 401);
  const path = `user_notifications?user_id=eq.${encodeURIComponent(session.user.id)}&is_read=eq.false`;
  const response = await supabaseData(path, session.accessToken, {
    method: "PATCH",
    headers: { prefer: "return=minimal" },
    body: JSON.stringify({ is_read: true }),
  });
  if (!response.ok) return json({ error: "notification_update_failed" }, 400);
  return sessionJson({ updated: true }, 200, session);
}

function validEmail(value) {
  return typeof value === "string" && value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function strongPassword(value) {
  return typeof value === "string" && value.length >= 12 && value.length <= 128 && /[a-z]/.test(value) && /[A-Z]/.test(value) && /\d/.test(value) && /[^A-Za-z0-9]/.test(value);
}

async function signIn(request) {
  const data = await body(request);
  if (!validEmail(data.email) || typeof data.password !== "string" || !data.password) return json({ error: "invalid_credentials" }, 400);
  const response = await supabase("/token?grant_type=password", {
    method: "POST",
    body: JSON.stringify({ email: data.email.trim().toLowerCase(), password: data.password }),
  });
  if (!response.ok) {
    const result = await response.json().catch(() => ({}));
    const safeErrors = {
      email_not_confirmed: "email_not_confirmed",
      user_banned: "account_disabled",
      over_request_rate_limit: "request_rate_limit",
      over_email_send_rate_limit: "email_rate_limit",
    };
    const error = safeErrors[result.code] || (response.status === 429 ? "request_rate_limit" : response.status >= 500 ? "service_unavailable" : "invalid_credentials");
    return json({ error }, response.status === 429 ? 429 : response.status >= 500 ? 503 : 401);
  }
  const session = await response.json();
  return new Response(JSON.stringify({ user: publicUser(session.user) }), { status: 200, headers: sessionHeaders(session) });
}

async function signUp(request) {
  const data = await body(request);
  const name = typeof data.name === "string" ? data.name.trim().replace(/\s+/g, " ") : "";
  if (name.length < 2 || name.length > 80 || !validEmail(data.email)) return json({ error: "invalid_signup" }, 400);
  if (!strongPassword(data.password)) return json({ error: "weak_password" }, 400);
  const redirectTo = `${new URL(request.url).origin}/`;
  const response = await supabase(`/signup?redirect_to=${encodeURIComponent(redirectTo)}`, {
    method: "POST",
    body: JSON.stringify({ email: data.email.trim().toLowerCase(), password: data.password, data: { full_name: name } }),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    const safeErrors = {
      weak_password: "weak_password",
      invalid_email: "invalid_email",
      email_address_invalid: "invalid_email",
      email_address_not_authorized: "email_not_authorized",
      over_email_send_rate_limit: "email_rate_limit",
      over_request_rate_limit: "request_rate_limit",
      signup_disabled: "signup_disabled",
      email_provider_disabled: "email_provider_disabled",
      user_already_exists: "account_exists",
      email_exists: "account_exists",
    };
    const error = safeErrors[result.code] || "signup_failed";
    return json({ error, ...(error === "email_rate_limit" ? { retryAfter: 60 } : {}) }, response.status === 429 ? 429 : 400);
  }
  if (!result.access_token) return json({ confirmationRequired: true }, 202);
  return new Response(JSON.stringify({ user: publicUser(result.user) }), { status: 201, headers: sessionHeaders(result) });
}

async function recover(request) {
  const data = await body(request);
  if (!validEmail(data.email)) return json({ error: "invalid_email" }, 400);
  const redirectTo = `${new URL(request.url).origin}/`;
  const response = await supabase(`/recover?redirect_to=${encodeURIComponent(redirectTo)}`, {
    method: "POST",
    body: JSON.stringify({ email: data.email.trim().toLowerCase() }),
  });
  if (!response.ok) {
    const result = await response.json().catch(() => ({}));
    const safeErrors = {
      over_email_send_rate_limit: "email_rate_limit",
      over_request_rate_limit: "request_rate_limit",
      email_address_invalid: "invalid_email",
      email_address_not_authorized: "email_not_authorized",
    };
    const error = safeErrors[result.code] || (response.status === 429 ? "email_rate_limit" : "recovery_unavailable");
    return json({ error }, response.status === 429 ? 429 : 503);
  }
  return json({ sent: true });
}

async function importSession(request) {
  const data = await body(request);
  const user = await userForToken(data.accessToken);
  if (!user || typeof data.refreshToken !== "string" || !data.refreshToken) return json({ error: "invalid_session" }, 401);
  const response = await supabase("/token?grant_type=refresh_token", {
    method: "POST",
    body: JSON.stringify({ refresh_token: data.refreshToken }),
  });
  if (!response.ok) return json({ error: "invalid_session" }, 401);
  const session = await response.json();
  if (!session.user || session.user.id !== user.id) return json({ error: "invalid_session" }, 401);
  return new Response(JSON.stringify({ user: publicUser(session.user) }), { status: 200, headers: sessionHeaders(session) });
}

async function updatePassword(request) {
  const session = await currentSession(request);
  if (!session) return json({ error: "authentication_required" }, 401);
  const data = await body(request);
  if (!strongPassword(data.password)) return json({ error: "weak_password" }, 400);
  const response = await supabase("/user", {
    method: "PUT",
    headers: { authorization: `Bearer ${session.accessToken}` },
    body: JSON.stringify({ password: data.password }),
  });
  if (!response.ok) {
    const result = await response.json().catch(() => ({}));
    return json({ error: result.code === "same_password" ? "same_password" : response.status === 401 ? "authentication_required" : "password_update_failed" }, response.status === 401 ? 401 : 400);
  }
  return new Response(JSON.stringify({ updated: true }), { status: 200, headers: session.refreshed ? sessionHeaders(session.refreshed) : JSON_HEADERS });
}

async function signOut(request) {
  const values = cookies(request);
  const token = decodeURIComponent(values[ACCESS_COOKIE] || "");
  if (token) await supabase("/logout", { method: "POST", headers: { authorization: `Bearer ${token}` } }).catch(() => {});
  return new Response(JSON.stringify({ signedOut: true }), { status: 200, headers: clearSessionHeaders() });
}

const durations = { "1min": 60000, "5min": 300000, "15min": 900000, "30min": 1800000, "1h": 3600000 };
const marketCache = new Map();
let goldPriceCache = null;

function activityVolume(bar, previous) {
  const range = Math.max(bar.high - bar.low, Math.abs(bar.high - (previous?.close ?? bar.open)), Math.abs(bar.low - (previous?.close ?? bar.open)), 0.001);
  const efficiency = 0.65 + 0.35 * Math.min(1, Math.abs(bar.close - bar.open) / range);
  return Math.max(1, Math.round(range * 100 * efficiency));
}

function normalizeGold(interval, values, source) {
  const now = Date.now();
  const bars = values
    .map((bar) => ({ time: bar.time, open: Number(bar.open), high: Number(bar.high), low: Number(bar.low), close: Number(bar.close), volume: bar.volume == null ? null : Number(bar.volume) }))
    .filter((bar) => [bar.time, bar.open, bar.high, bar.low, bar.close].every(Number.isFinite))
    .sort((a, b) => a.time - b.time);
  const providerVolume = bars.every((bar) => Number.isFinite(bar.volume));
  bars.forEach((bar, index) => {
    if (!Number.isFinite(bar.volume)) bar.volume = activityVolume(bar, bars[index - 1]);
    bar.closed = bar.time + durations[interval] <= now;
  });
  return { symbol: "XAU/USD", interval, source, volumeMode: providerVolume ? "provider" : "activity-proxy-plus-live-ticks", fetchedAt: now, bars };
}

async function goldFromYahoo(interval) {
  const yahooInterval = interval === "1h" ? "60m" : interval;
  const range = ["1min", "5min", "15min", "30min"].includes(interval) ? "5d" : "1mo";
  const response = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/XAUUSD=X?interval=${yahooInterval}&range=${range}`);
  const data = await response.json();
  const result = data.chart?.result?.[0];
  const quote = result?.indicators?.quote?.[0];
  if (!result || !quote || !Array.isArray(result.timestamp)) throw new Error("fallback unavailable");
  return normalizeGold(interval, result.timestamp.map((time, index) => ({ time: time * 1000, open: quote.open?.[index], high: quote.high?.[index], low: quote.low?.[index], close: quote.close?.[index], volume: quote.volume?.[index] })), "Yahoo Finance");
}

async function goldFromBinance(interval) {
  const binanceInterval = { "1min": "1m", "5min": "5m", "15min": "15m", "30min": "30m", "1h": "1h" }[interval];
  const response = await fetch(`https://api.binance.com/api/v3/klines?symbol=PAXGUSDT&interval=${binanceInterval}&limit=1000`, { headers: { accept: "application/json" } });
  if (!response.ok) throw new Error("secondary fallback unavailable");
  const rows = await response.json();
  if (!Array.isArray(rows) || rows.length < 41) throw new Error("secondary fallback unavailable");
  return normalizeGold(interval, rows.map((row) => ({ time: Number(row[0]), open: row[1], high: row[2], low: row[3], close: row[4], volume: row[5] })), "Binance · PAXG/USDT fallback");
}

async function gold(interval) {
  const cached = marketCache.get(interval);
  if (cached && Date.now() - cached.fetchedAt < 12000) return cached;
  let result;
  try {
    if (process.env.TWELVEDATA_API_KEY) {
      const response = await fetch(`https://api.twelvedata.com/time_series?symbol=XAU%2FUSD&interval=${interval}&outputsize=1000&timezone=UTC`, { headers: { authorization: `apikey ${process.env.TWELVEDATA_API_KEY}` } });
      const data = await response.json();
      if (data.status === "ok" && Array.isArray(data.values)) result = normalizeGold(interval, data.values.map((bar) => ({ time: Date.parse(`${bar.datetime.replace(" ", "T")}Z`), ...bar })), "Twelve Data");
    }
  } catch {}
  if (!result) {
    try { result = await goldFromYahoo(interval); } catch {}
  }
  if (!result) result = await goldFromBinance(interval);
  marketCache.set(interval, result);
  return result;
}

async function marketData(request, url) {
  const session = await currentSession(request);
  if (!session) return json({ error: "authentication_required" }, 401);
  const interval = url.searchParams.get("interval") || "15min";
  if (!Object.hasOwn(durations, interval)) return json({ error: "invalid_interval" }, 400);
  try {
    const headers = session.refreshed ? sessionHeaders(session.refreshed) : JSON_HEADERS;
    return new Response(JSON.stringify(await gold(interval)), { status: 200, headers });
  } catch {
    return json({ error: "market_data_unavailable" }, 503);
  }
}

async function goldPrice(request) {
  const session = await currentSession(request);
  if (!session) return json({ error: "authentication_required" }, 401);
  if (!process.env.TWELVEDATA_API_KEY) return json({ error: "price_feed_unavailable" }, 503);
  try {
    if (!goldPriceCache || Date.now() - goldPriceCache.receivedAt >= 15000) {
      const response = await fetch("https://api.twelvedata.com/price?symbol=XAU%2FUSD", {
        headers: { authorization: `apikey ${process.env.TWELVEDATA_API_KEY}` },
      });
      const data = await response.json();
      const price = Number(data.price);
      if (!response.ok || !Number.isFinite(price) || price <= 0) throw new Error("price unavailable");
      goldPriceCache = { price, receivedAt: Date.now(), source: "Twelve Data" };
    }
    return sessionJson(goldPriceCache, 200, session);
  } catch {
    return json({ error: "price_feed_unavailable" }, 503);
  }
}

export default async function handler(request) {
  const url = new URL(request.url);
  const route = url.searchParams.get("route") || "";
  try {
    if (route === "gold" && request.method === "GET") return marketData(request, url);
    if (route === "gold/price" && request.method === "GET") return goldPrice(request);
    if (route === "workspace" && request.method === "GET") return workspaceData(request);
    if (route === "admin/users" && request.method === "GET" && sameOrigin(request)) return listAdminUsers(request);
    if (route === "auth/session" && request.method === "GET") {
      const session = await currentSession(request);
      if (!session) return json({ user: null }, 401);
      const headers = session.refreshed ? sessionHeaders(session.refreshed) : JSON_HEADERS;
      return new Response(JSON.stringify({ user: publicUser(session.user) }), { status: 200, headers });
    }
    if (request.method !== "POST" || !sameOrigin(request)) return json({ error: "not_found" }, 404);
    if (route === "auth/sign-in") return signIn(request);
    if (route === "auth/sign-up") return signUp(request);
    if (route === "auth/recover") return recover(request);
    if (route === "auth/import-session") return importSession(request);
    if (route === "auth/update-password") return updatePassword(request);
    if (route === "auth/sign-out") return signOut(request);
    if (route === "journal/create") return saveJournal(request);
    if (route === "journal/update") return updateJournal(request, url);
    if (route === "preferences") return savePreferences(request);
    if (route === "notifications/create") return createNotification(request);
    if (route === "notifications/read") return readNotifications(request);
    if (route === "admin/user-action") return adminUserAction(request);
    return json({ error: "not_found" }, 404);
  } catch (error) {
    if (error?.message === "invalid_content_type" || error?.message === "invalid_body") return json({ error: "invalid_request" }, 400);
    if (error?.message === "Supabase is not configured") return json({ error: "service_not_configured" }, 503);
    if (error?.message === "Supabase admin is not configured") return json({ error: "admin_not_configured" }, 503);
    return json({ error: "server_error" }, 500);
  }
}
