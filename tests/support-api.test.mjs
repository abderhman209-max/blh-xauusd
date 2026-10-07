import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/index.js';
import { fixtureToken, fixtureSessionId, sessionRpc } from './auth-fixture.mjs';
const originalFetch = globalThis.fetch;
after(() => { globalThis.fetch = originalFetch; });
process.env.SUPABASE_URL = 'https://fixture.invalid';
process.env.SUPABASE_PUBLISHABLE_KEY = 'fixture-public';
process.env.SUPABASE_SECRET_KEY = 'fixture-secret';
const userId = '11111111-1111-4111-8111-111111111111';
const otherId = '22222222-2222-4222-8222-222222222222';
const messageId = '33333333-3333-4333-8333-333333333333';
const user = { id: userId, user_metadata: { full_name: 'Test member' }, app_metadata: {} };
const admin = { ...user, app_metadata: { role: 'super_admin' } };
const reply = (data, status = 200) => new Response(JSON.stringify(data), { status });
const request = (route, data, options = {}) => new Request('https://site.invalid/api?route=' + route, {
  method: data ? 'POST' : 'GET', headers: { cookie: 'blh_access=' + fixtureToken(userId),
    origin: options.origin || 'https://site.invalid', 'content-type': 'application/json' },
  ...(data ? { body: JSON.stringify(data) } : {}),
});
function mock(account, run, active = true) {
  globalThis.fetch = async (url, init = {}) => {
    if (String(url).endsWith('/auth/v1/user')) return reply(account, account ? 200 : 401);
    if (sessionRpc(url)) return reply(active);
    return run(String(url), init);
  };
}
const row = (seq = 1) => ({ id: messageId, seq, user_id: userId, sender_id: userId, sender_role: 'customer', body: '<script>example</script>', created_at: '2026-10-07T12:00:00Z' });
const thread = { user_id: userId, user_name: 'Test member', last_message_at: '2026-10-07T12:00:00Z', last_message_seq: 1, last_sender_role: 'customer', last_message_preview: 'Question' };

test('support APIs reject anonymous users, cross-origin reads/writes and replaced sessions', async () => {
  mock(null, () => assert.fail('must not touch support data'));
  for (const route of ['support/messages', 'admin/support/inbox', 'admin/support/messages&userId=' + otherId]) assert.equal((await handler(request(route))).status, 401);
  assert.equal((await handler(request('support/send', { id: messageId, text: 'Hi' }))).status, 401);
  mock(user, () => assert.fail('must not touch support data'));
  for (const [route, data] of [['support/messages'], ['support/send', { id: messageId, text: 'Hi' }], ['admin/support/inbox']]) assert.equal((await handler(request(route, data, { origin: 'https://foreign.invalid' }))).status, 404);
  mock(user, () => assert.fail('must not touch support data'), false);
  const response = await handler(request('support/send', { id: messageId, text: 'Hi' }));
  assert.equal(response.status, 401); assert.equal((await response.json()).error, 'session_replaced'); assert.match(response.headers.get('set-cookie'), /Max-Age=0/);
});
test('user_metadata cannot grant support admin access', async () => {
  mock({ ...user, user_metadata: { role: 'super_admin', isAdmin: true } }, () => assert.fail('must not read admin data'));
  for (const [route, data] of [['admin/support/inbox'], ['admin/support/messages&userId=' + otherId], ['admin/support/send', { id: messageId, userId: otherId, text: 'Hi' }]]) assert.equal((await handler(request(route, data))).status, 403);
});
test('customer reads are owner scoped and responses omit sender IDs', async () => {
  mock(user, (url, init) => {
    assert.ok(url.includes('user_id=eq.' + userId));
    assert.equal(new Headers(init.headers).get('authorization'), 'Bearer ' + fixtureToken(userId));
    return reply(url.includes('support_threads') ? [thread] : [row(2), row(1)]);
  });
  const response = await handler(request('support/messages'));
  assert.equal(response.headers.get('cache-control'), 'no-store');
  const data = await response.json(); assert.deepEqual(data.messages.map(message => message.seq), [1, 2]);
  assert.equal(data.messages[0].text, '<script>example</script>'); assert.equal(data.messages[0].sender_id, undefined); assert.equal(data.thread.awaitingReply, true);
});
test('customer cannot address another conversation and malformed cursors never query data', async () => {
  mock(user, () => assert.fail('must not query support data'));
  assert.equal((await handler(request('support/messages&userId=' + otherId))).status, 404);
  assert.equal((await handler(request('support/send', { id: messageId, text: 'Hi', userId: otherId }))).status, 404);
  for (const query of ['before=-1', 'after=0', 'before=abc', 'before=1&after=2', 'after=9007199254740992']) assert.equal((await handler(request('support/messages&' + query))).status, 400);
});
test('message validation is bounded and rejects empty text, control characters and invalid IDs', async () => {
  mock(user, () => assert.fail('must not write support data'));
  for (const data of [{ id: messageId, text: '  ' }, { id: messageId, text: 'x'.repeat(2001) }, { id: messageId, text: 'bad\u0000text' }, { id: 'bad', text: 'Hi' }, { id: messageId, text: {} }]) assert.equal((await handler(request('support/send', data))).status, 400);
});
test('customer send derives the sender and role from verified session, preserving retry ID and text', async () => {
  mock(user, (url, init) => {
    assert.ok(url.endsWith('/rpc/pipvoria_support_send'));
    const data = JSON.parse(init.body);
    assert.deepEqual(data, { p_user_id: userId, p_sender_id: userId, p_session_id: fixtureSessionId, p_id: messageId, p_sender_role: 'customer', p_body: 'Question\nwith details', p_user_name: 'Test member' });
    assert.equal(new Headers(init.headers).get('authorization'), 'Bearer fixture-secret');
    return reply({ ...row(), body: data.p_body });
  });
  const response = await handler(request('support/send', { id: messageId, text: '  Question\nwith details  ', sender_id: otherId, role: 'admin' }));
  assert.equal(response.status, 200); assert.equal((await response.json()).message.id, messageId);
});
test('admin replies target an existing customer, using verified administrator identity', async () => {
  mock(admin, (url, init) => { const data = JSON.parse(init.body); assert.equal(data.p_user_id, otherId); assert.equal(data.p_sender_id, userId); assert.equal(data.p_sender_role, 'admin'); return reply({ ...row(), user_id: otherId, sender_role: 'admin' }); });
  assert.equal((await handler(request('admin/support/send', { userId: otherId, id: messageId, text: 'Response' }))).status, 200);
});
test('database rate limits, retry conflicts and missing threads map to safe responses', async () => {
  for (const [error, status] of [['support_rate_limit', 429], ['support_message_conflict', 409], ['support_thread_not_found', 404], ['invalid_support_message', 400], ['private SQL details', 503]]) {
    mock(user, () => reply({ message: error, details: 'sensitive' }, 400));
    const response = await handler(request('support/send', { id: messageId, text: 'Hi' }));
    assert.equal(response.status, status); assert.equal((await response.json()).details, undefined);
  }
  mock(user, () => reply({ message: 'session_replaced' }, 400));
  const response = await handler(request('support/send', { id: messageId, text: 'Hi' })); assert.equal(response.status, 401); assert.match(response.headers.get('set-cookie'), /Max-Age=0/);
});
test('history pagination uses 51-row lookahead without losing the boundary row', async () => {
  mock(user, url => {
    if (url.includes('support_threads')) return reply([thread]);
    assert.ok(url.includes('seq=lt.100&order=seq.desc&limit=51'));
    return reply(Array.from({ length: 51 }, (_, index) => row(99 - index)));
  });
  const data = await (await handler(request('support/messages&before=100'))).json();
  assert.equal(data.messages.length, 50); assert.equal(data.hasMore, true); assert.equal(data.messages[0].seq, 50); assert.equal(data.messages.at(-1).seq, 99);
  mock(user, url => { if (url.includes('support_threads')) return reply([thread]); assert.ok(url.includes('seq=gt.99&order=seq.asc')); return reply([row(100)]); });
  assert.equal((await (await handler(request('support/messages&after=99'))).json()).messages[0].seq, 100);
});
test('admin inbox is paged and missing conversation stays missing', async () => {
  mock(admin, (url, init) => { assert.ok(url.includes('support_threads')); assert.equal(new Headers(init.headers).get('authorization'), 'Bearer fixture-secret'); return reply([]); });
  const data = await (await handler(request('admin/support/inbox&offset=50'))).json(); assert.deepEqual(data, { threads: [], hasMore: false });
  assert.equal((await handler(request('admin/support/messages&userId=' + otherId))).status, 404);
  assert.equal((await handler(request('admin/support/inbox&offset=-1'))).status, 400);
});
