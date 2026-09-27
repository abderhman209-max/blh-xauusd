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
  };
}

function validEmail(value) {
  return typeof value === "string" && value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function strongPassword(value) {
  return typeof value === "string" && value.length >= 12 && value.length <= 128 && /[a-z]/.test(value) && /[A-Z]/.test(value) && /\d/.test(value) && /[^A-Za-z0-9]/.test(value);
}

async function signIn(request) {
  const data = await body(request);
  if (!validEmail(data.email) || typeof data.password !== "string") return json({ error: "invalid_credentials" }, 400);
  const response = await supabase("/token?grant_type=password", {
    method: "POST",
    body: JSON.stringify({ email: data.email.trim().toLowerCase(), password: data.password }),
  });
  if (!response.ok) return json({ error: "invalid_credentials" }, 401);
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
  if (!response.ok) return json({ error: result.code === "weak_password" ? "weak_password" : "signup_failed" }, 400);
  if (!result.access_token) return json({ confirmationRequired: true }, 202);
  return new Response(JSON.stringify({ user: publicUser(result.user) }), { status: 201, headers: sessionHeaders(result) });
}

async function recover(request) {
  const data = await body(request);
  if (!validEmail(data.email)) return json({ error: "invalid_email" }, 400);
  const redirectTo = `${new URL(request.url).origin}/`;
  await supabase(`/recover?redirect_to=${encodeURIComponent(redirectTo)}`, {
    method: "POST",
    body: JSON.stringify({ email: data.email.trim().toLowerCase() }),
  });
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
  if (!response.ok) return json({ error: "password_update_failed" }, 400);
  return json({ updated: true });
}

async function signOut(request) {
  const values = cookies(request);
  const token = decodeURIComponent(values[ACCESS_COOKIE] || "");
  if (token) await supabase("/logout", { method: "POST", headers: { authorization: `Bearer ${token}` } }).catch(() => {});
  return new Response(JSON.stringify({ signedOut: true }), { status: 200, headers: clearSessionHeaders() });
}

const durations = { "1min": 60000, "5min": 300000, "15min": 900000, "30min": 1800000, "1h": 3600000 };
const marketCache = new Map();

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

export default async function handler(request) {
  const url = new URL(request.url);
  const route = url.searchParams.get("route") || "";
  try {
    if (route === "gold" && request.method === "GET") return marketData(request, url);
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
    return json({ error: "not_found" }, 404);
  } catch (error) {
    if (error?.message === "invalid_content_type" || error?.message === "invalid_body") return json({ error: "invalid_request" }, 400);
    if (error?.message === "Supabase is not configured") return json({ error: "service_not_configured" }, 503);
    return json({ error: "server_error" }, 500);
  }
}
