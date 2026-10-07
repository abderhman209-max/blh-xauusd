import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import handler from '../api/index.js';
import { fixtureToken, sessionRpc } from './auth-fixture.mjs';

const originalFetch = globalThis.fetch;
after(() => { globalThis.fetch = originalFetch; });
process.env.SUPABASE_URL = 'https://hardening-fixture.invalid';
process.env.SUPABASE_PUBLISHABLE_KEY = 'fixture-public-key';
process.env.SUPABASE_SECRET_KEY = 'fixture-secret';

const owner = '11111111-1111-4111-8111-111111111111';
const otherAdmin = '22222222-2222-4222-8222-222222222222';
const factorId = '44444444-4444-4444-8444-444444444444';
const challengeId = '55555555-5555-4555-8555-555555555555';
const admin = { id: owner, email: 'admin@example.invalid', user_metadata: {}, app_metadata: { role: 'super_admin' },
  factors: [{ id: factorId, factor_type: 'totp', status: 'verified' }] };
const reply = (data, status = 200) => new Response(JSON.stringify(data), { status });
const request = (route, { data, token = fixtureToken(owner), headers = {} } = {}) => new Request('https://site.invalid/api?route=' + route, {
  method: data === undefined ? 'GET' : 'POST',
  headers: { origin: 'https://site.invalid', 'content-type': 'application/json', cookie: '__Host-blh_access=' + token, ...headers },
  ...(data === undefined ? {} : { body: JSON.stringify(data) }),
});
function mock(account, run = () => assert.fail('unexpected upstream call')) {
  globalThis.fetch = async (url, init = {}) => {
    if (String(url).endsWith('/auth/v1/user')) return reply(account, account ? 200 : 401);
    if (sessionRpc(url)) return reply(true);
    return run(String(url), init);
  };
}

test('writes without Origin or from a sibling site never reach the provider', async () => {
  mock(admin);
  const bare = new Request('https://site.invalid/api?route=auth/sign-in', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
  assert.equal((await handler(bare)).status, 404);
  const sibling = request('auth/sign-in', { data: {}, headers: { 'sec-fetch-site': 'same-site' } });
  assert.equal((await handler(sibling)).status, 404);
});

test('sign-in issues __Host- cookies and clears the legacy names', async () => {
  const token = fixtureToken(owner);
  mock(admin, url => url.includes('/token?grant_type=password')
    ? reply({ access_token: token, refresh_token: 'refresh', expires_in: 3600, user: admin })
    : assert.fail('unexpected ' + url));
  const response = await handler(request('auth/sign-in', { data: { email: 'admin@example.invalid', password: 'fixture-password' }, headers: { 'x-real-ip': '198.51.100.1' } }));
  assert.equal(response.status, 200);
  const cookies = response.headers.getSetCookie();
  assert.ok(cookies.some(value => value.startsWith('__Host-blh_access=') && /Secure/.test(value) && /Path=\//.test(value)));
  assert.ok(cookies.some(value => value.startsWith('__Host-blh_refresh=')));
  assert.ok(cookies.some(value => value.startsWith('blh_access=;') && /Max-Age=0/.test(value)));
});

test('sign-in attempts are limited per client IP', async () => {
  mock(null, url => url.includes('/token?grant_type=password') ? reply({ code: 'invalid_credentials' }, 400) : assert.fail('unexpected ' + url));
  const attempt = ip => handler(request('auth/sign-in', { data: { email: 'a@example.invalid', password: 'wrong' }, headers: { 'x-real-ip': ip } }));
  for (let i = 0; i < 10; i++) assert.equal((await attempt('203.0.113.7')).status, 401);
  const blocked = await attempt('203.0.113.7');
  assert.equal(blocked.status, 429);
  assert.equal(blocked.headers.get('retry-after'), '60');
  assert.equal((await attempt('203.0.113.8')).status, 401);
});

test('recovery e-mails are limited per address even across IPs', async () => {
  let sent = 0;
  mock(null, url => { assert.ok(url.includes('/recover')); sent++; return reply({}); });
  for (let i = 0; i < 3; i++) assert.equal((await handler(request('auth/recover', { data: { email: 'victim@example.invalid' }, headers: { 'x-real-ip': '192.0.2.' + i } }))).status, 200);
  const blocked = await handler(request('auth/recover', { data: { email: 'Victim@example.invalid' }, headers: { 'x-real-ip': '192.0.2.50' } }));
  assert.equal(blocked.status, 429);
  assert.equal(sent, 3);
});

test('admin routes require a second factor on the session', async () => {
  mock(admin);
  for (const [route, data] of [['admin/users'], ['admin/user-action', { userId: otherAdmin, action: 'ban' }], ['admin/support/inbox']]) {
    const response = await handler(request(route, { data }));
    assert.equal(response.status, 403, route);
    const result = await response.json();
    assert.equal(result.error, 'admin_mfa_required');
    assert.equal(result.enrolled, true);
  }
});

test('a super admin cannot trigger a reset link for another super admin', async () => {
  mock(admin, url => url.endsWith('/admin/users/' + otherAdmin)
    ? reply({ id: otherAdmin, email: 'other@example.invalid', app_metadata: { role: 'super_admin' } })
    : assert.fail('must not send recovery ' + url));
  const response = await handler(request('admin/user-action', { data: { userId: otherAdmin, action: 'recovery' }, token: fixtureToken(owner, undefined, { aal: 'aal2' }) }));
  assert.equal(response.status, 409);
});

test('MFA verification upgrades the session and rejects malformed codes without calling Supabase', async () => {
  mock(admin);
  assert.equal((await handler(request('auth/mfa/verify', { data: { factorId, code: '12ab56' } }))).status, 400);
  assert.equal((await handler(request('auth/mfa/verify', { data: { factorId: '66666666-6666-4666-8666-666666666666', code: '123456' } }))).status, 400);

  const upgraded = fixtureToken(owner, undefined, { aal: 'aal2' });
  const calls = [];
  mock(admin, (url, init) => {
    calls.push(url);
    if (url.endsWith(`/factors/${factorId}/challenge`)) return reply({ id: challengeId });
    if (url.endsWith(`/factors/${factorId}/verify`)) {
      assert.deepEqual(JSON.parse(init.body), { challenge_id: challengeId, code: '123456' });
      return reply({ access_token: upgraded, refresh_token: 'refresh-2', expires_in: 3600, user: admin });
    }
    return assert.fail('unexpected ' + url);
  });
  const response = await handler(request('auth/mfa/verify', { data: { factorId, code: '123 456' } }));
  assert.equal(response.status, 200);
  assert.equal((await response.json()).aal, 'aal2');
  assert.ok(response.headers.getSetCookie().some(value => value.startsWith('__Host-blh_access=' + encodeURIComponent(upgraded))));
  assert.equal(calls.length, 2);
});

test('MFA enrolment is reserved to administrators and refused once a factor exists', async () => {
  mock({ ...admin, app_metadata: {}, factors: [] });
  assert.equal((await handler(request('auth/mfa/enroll', { data: {} }))).status, 403);
  mock(admin);
  assert.equal((await handler(request('auth/mfa/enroll', { data: {} }))).status, 409);
});

test('deployment sends the hardened security headers', () => {
  const headers = Object.fromEntries(JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url))).headers[0].headers.map(({ key, value }) => [key, value]));
  assert.match(headers['Strict-Transport-Security'], /max-age=63072000/);
  assert.equal(headers['Cross-Origin-Opener-Policy'], 'same-origin');
  assert.equal(headers['Cross-Origin-Resource-Policy'], 'same-origin');
  assert.match(headers['Content-Security-Policy'], /script-src 'self';/);
});
