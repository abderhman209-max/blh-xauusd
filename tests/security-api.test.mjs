import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/index.js';
import {fixtureToken,sessionRpc} from './auth-fixture.mjs';

const originalFetch = globalThis.fetch;
after(() => { globalThis.fetch = originalFetch; });
process.env.SUPABASE_URL = 'https://security-fixture.invalid';
process.env.SUPABASE_PUBLISHABLE_KEY = 'fixture-public-key';
process.env.SUPABASE_SECRET_KEY = 'fixture-secret';
const owner = '11111111-1111-4111-8111-111111111111';
const stranger = '22222222-2222-4222-8222-222222222222';
const user = { id: owner, user_metadata: { role: 'super_admin', full_name: '<img onerror=alert(1)>' }, app_metadata: {} };
const access = fixtureToken(owner);
const json = (data, status = 200) => new Response(JSON.stringify(data), { status });
const headers = { origin: 'https://site.invalid', 'content-type': 'application/json' };
const makeRequest = (route, data, extra = {}) => new Request('https://site.invalid/api?route=' + route, {
  method: data === undefined ? 'GET' : 'POST',
  headers: { ...headers, ...extra },
  ...(data === undefined ? {} : { body: JSON.stringify(data) }),
});
function authenticated(run) {
  globalThis.fetch = async (url, init = {}) => String(url).endsWith('/auth/v1/user')
    ? json(user) : sessionRpc(url) ? json(true) : run(String(url), init);
}
function noFetch() { globalThis.fetch = async () => assert.fail('Rejected input must not reach an upstream service'); }

test('private account, photo and market routes reject requests without a session', async () => {
  noFetch();
  for (const route of ['workspace', 'settings', 'profile/avatar', 'gold&interval=5min', 'gold/price', 'admin/users']) {
    assert.equal((await handler(makeRequest(route))).status, 401, route);
  }
});

test('user-editable metadata cannot grant admin permissions', async () => {
  authenticated(() => assert.fail('No admin lookup or action should run'));
  for (const [route, data] of [['admin/users', undefined], ['admin/user-action', { userId: stranger, action: 'ban' }]]) {
    const result = await handler(makeRequest(route, data, { cookie: 'blh_access='+access }));
    assert.equal(result.status, 403);
    assert.equal((await result.json()).error, 'admin_required');
  }
});

test('a journal create binds ownership to the validated session', async () => {
  authenticated((url, init) => {
    assert.ok(url.includes('/rest/v1/analysis_snapshots'));
    const row = JSON.parse(init.body);
    assert.equal(row.user_id, owner);
    return json([row]);
  });
  const result = await handler(makeRequest('journal/create', {
    id: stranger, user_id: stranger, payload: { symbol: 'XAU/USD', interval: '5min', user_id: stranger },
  }, { cookie: 'blh_access='+access }));
  assert.equal(result.status, 201);
});

test('cross-origin mutations reject before accessing the provider', async () => {
  noFetch();
  for (const route of ['auth/sign-in', 'settings', 'admin/user-action']) {
    assert.equal((await handler(makeRequest(route, {}, { origin: 'https://other.invalid', cookie: 'blh_access='+access }))).status, 404);
  }
  const avatar = new Request('https://site.invalid/api?route=profile/avatar', {
    method: 'PUT', headers: { origin: 'https://other.invalid', cookie: 'blh_access='+access, 'content-type': 'image/jpeg' }, body: new Uint8Array([255, 216, 255, 217]),
  });
  assert.equal((await handler(avatar)).status, 404);
});

test('declared oversized JSON is rejected before reading or calling auth', async () => {
  noFetch();
  const result = await handler(makeRequest('auth/sign-in', {}, { 'content-length': String(256 * 1024 + 1) }));
  assert.equal(result.status, 413);
  assert.equal((await result.json()).error, 'request_too_large');
});

test('streamed UTF-8 JSON cannot evade the byte limit with a false content length', async () => {
  noFetch();
  let cancelled = false;
  const stream = new ReadableStream({
    pull(controller) { controller.enqueue(new TextEncoder().encode('é'.repeat(40000))); },
    cancel() { cancelled = true; },
  });
  const request = new Request('https://site.invalid/api?route=auth/sign-in', {
    method: 'POST', headers: { ...headers, 'content-length': '1' }, body: stream, duplex: 'half',
  });
  assert.equal((await handler(request)).status, 413);
  assert.equal(cancelled, true);
});

test('invalid JSON and lookalike content types return a safe client error', async () => {
  noFetch();
  for (const [type, body] of [['application/json', '{broken'], ['application/jsonp', '{}'], ['text/plain', '{}'], ['application/json', '[]']]) {
    const request = new Request('https://site.invalid/api?route=auth/sign-in', { method: 'POST', headers: { ...headers, 'content-type': type }, body });
    const result = await handler(request);
    assert.equal(result.status, 400);
    assert.equal((await result.json()).error, 'invalid_request');
  }
});

test('normal sign-in retains secure HTTP-only cookies and never exposes tokens in JSON', async () => {
  globalThis.fetch = async url => sessionRpc(url) ? json(true) : json({ user, access_token: access, refresh_token: 'fixture-refresh', expires_in: 3600 });
  const result = await handler(makeRequest('auth/sign-in', { email: 'example@example.invalid', password: 'existing-fixture-password' }, { 'content-type': 'application/json; charset=utf-8' }));
  assert.equal(result.status, 200);
  const responseText = await result.text();
  assert.ok(!responseText.includes(access) && !responseText.includes('fixture-refresh'));
  assert.equal(JSON.parse(responseText).user.isAdmin, false);
  for (const value of result.headers.getSetCookie()) assert.match(value, /HttpOnly; Secure; SameSite=Lax/);
  assert.equal(result.headers.get('cache-control'), 'no-store');
});

test('malformed session cookies fail closed and logout can still clear them', async () => {
  noFetch();
  const extra = { cookie: 'blh_access=%E0%A4%A; blh_refresh=%' };
  assert.equal((await handler(makeRequest('auth/session', undefined, extra))).status, 401);
  const result = await handler(makeRequest('auth/sign-out', {}, extra));
  assert.equal(result.status, 200);
  assert.ok(result.headers.getSetCookie().every(value => value.includes('Max-Age=0')));
});

test('oversized streaming avatars are cancelled without reaching storage', async () => {
  authenticated(() => assert.fail('An oversized upload must not reach storage'));
  let cancelled = false;
  const stream = new ReadableStream({
    pull(controller) { controller.enqueue(new Uint8Array(300000)); },
    cancel() { cancelled = true; },
  });
  const request = new Request('https://site.invalid/api?route=profile/avatar', {
    method: 'PUT', headers: { origin: headers.origin, cookie: 'blh_access='+access, 'content-type': 'image/jpeg' }, body: stream, duplex: 'half',
  });
  const result = await handler(request);
  assert.equal(result.status, 413);
  assert.equal((await result.json()).error, 'avatar_too_large');
  assert.equal(cancelled, true);
});
