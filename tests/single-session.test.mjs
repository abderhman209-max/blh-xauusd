import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/index.js';
import {fixtureToken} from './auth-fixture.mjs';

const originalFetch = globalThis.fetch;
after(() => { globalThis.fetch = originalFetch; });
process.env.SUPABASE_URL = 'https://session-fixture.invalid';
process.env.SUPABASE_PUBLISHABLE_KEY = 'fixture-public';
process.env.SUPABASE_SECRET_KEY = 'fixture-secret';
const owner = '11111111-1111-4111-8111-111111111111';
const other = '22222222-2222-4222-8222-222222222222';
const sid = n => `aaaaaaaa-aaaa-4aaa-8aaa-${String(n).padStart(12,'0')}`;
const json = (value,status=200) => new Response(JSON.stringify(value),{status});
const request = (route, {token='',refresh='',data,method=data===undefined?'GET':'POST'}={}) => new Request('https://site.invalid/api?route='+route,{
  method,headers:{origin:'https://site.invalid','content-type':'application/json',cookie:`blh_access=${encodeURIComponent(token)}; blh_refresh=${encodeURIComponent(refresh)}`},
  ...(data===undefined?{}:{body:JSON.stringify(data)}),
});
function provider() {
  const records = new Map(), accepted = new Map(), expired = new Set(), calls = [];
  let next = 0;
  const state = {nextLogin:null,guardOffline:false,logoutOffline:false,confirmation:false};
  function issue(id=owner) {
    const sessionId = sid(++next), token = fixtureToken(id,sessionId);
    const session = {user:{id,created_at:'2026-09-01T00:00:00Z',email:`fixture-${id}@example.invalid`},access_token:token,refresh_token:`fixture-refresh-${next}`,expires_in:3600};
    records.set(sessionId,{id,sessionId,sequence:next,session});
    return session;
  }
  function recordForToken(token) {
    return [...records.values()].find(r=>r.session.access_token===token);
  }
  globalThis.fetch = async (url,init={}) => {
    url = String(url); calls.push({url,init});
    if (url.endsWith('/auth/v1/user')) {
      const token = init.headers.get('authorization')?.slice(7);
      const record = recordForToken(token);
      return record&&!expired.has(token)?json(record.session.user):json({},401);
    }
    if (url.includes('grant_type=password') || url.includes('/auth/v1/signup?')) {
      if (url.includes('/signup?') && state.confirmation) return json({user:{id:owner}});
      const session = state.nextLogin || issue(); state.nextLogin=null;
      return json(session);
    }
    if (url.includes('grant_type=refresh_token')) {
      const record = [...records.values()].find(r=>r.session.refresh_token===JSON.parse(init.body).refresh_token);
      return record?json(record.session):json({},401);
    }
    if (url.includes('/rpc/pipvoria_')) {
      assert.equal(init.headers.get('apikey'),'fixture-secret');
      if (state.guardOffline) return json({error:'offline'},503);
      const {p_user_id:id,p_session_id:sessionId} = JSON.parse(init.body);
      const record = records.get(sessionId), current = accepted.get(id);
      if (url.endsWith('/pipvoria_claim_session')) {
        const allowed = record?.id===id && (!current || record.sequence>current.sequence || current.sessionId===sessionId&&!current.revoked);
        if(allowed) accepted.set(id,{...record,revoked:false});
        return json(Boolean(allowed));
      }
      if (url.endsWith('/pipvoria_session_active')) return json(Boolean(record?.id===id&&current?.sessionId===sessionId&&!current.revoked));
      if (url.endsWith('/pipvoria_release_session')) {
        const released = current?.sessionId===sessionId&&!current.revoked;
        if(released) current.revoked=true;
        return json(Boolean(released));
      }
      assert.fail('Unknown session RPC');
    }
    if (url.includes('/auth/v1/logout')) {
      assert.ok(url.endsWith('?scope=local'));
      if(state.logoutOffline) throw Error('offline');
      const record=recordForToken(init.headers.get('authorization')?.slice(7));
      if(record) records.delete(record.sessionId);
      return new Response(null,{status:204});
    }
    if (url.includes('/rest/v1/')) return json([]);
    assert.fail('Unexpected upstream call: '+url);
  };
  return {state,issue,records,accepted,expired,calls};
}
async function login(p,id=owner) {
  const session=p.issue(id);p.state.nextLogin=session;
  const response=await handler(request('auth/sign-in',{data:{email:'test@example.invalid',password:'existing-fixture-password'}}));
  assert.equal(response.status,200);
  return session;
}

test('new device replaces the old session across private reads and writes',async()=>{
  const p=provider(),first=await login(p),second=await login(p);
  for(const [route,data] of [['auth/session',undefined],['workspace',undefined],['settings',undefined],['profile/avatar',undefined],['gold',undefined],['preferences',{}]]) {
    const response=await handler(request(route,{token:first.access_token,data}));
    assert.equal(response.status,401,route);
    assert.equal((await response.json()).error,'session_replaced');
    assert.ok(response.headers.getSetCookie().every(c=>c.includes('Max-Age=0')));
  }
  assert.equal((await handler(request('auth/session',{token:second.access_token}))).status,200);
});
test('different accounts remain independent; tabs sharing a session stay allowed',async()=>{
  const p=provider(),a=await login(p),b=await login(p,other);
  for(const token of [a.access_token,b.access_token,a.access_token]) assert.equal((await handler(request('auth/session',{token}))).status,200);
});
test('refresh retains session identity and cannot reclaim a replaced session',async()=>{
  const p=provider(),a=await login(p);p.expired.add(a.access_token);
  assert.equal((await handler(request('auth/session',{token:a.access_token,refresh:a.refresh_token}))).status,200);
  await login(p);
  assert.equal((await handler(request('auth/session',{token:a.access_token,refresh:a.refresh_token}))).status,401);
  assert.equal(p.calls.filter(c=>c.url.endsWith('/pipvoria_claim_session')).length,2);
});
test('an older import finishing late cannot displace the newer accepted login',async()=>{
  const p=provider(),a=await login(p),b=await login(p);
  const response=await handler(request('auth/import-session',{data:{accessToken:a.access_token,refreshToken:a.refresh_token}}));
  assert.equal(response.status,401);
  assert.equal((await handler(request('auth/session',{token:b.access_token}))).status,200);
});
test('an old logout is local and cannot revoke the newer login',async()=>{
  const p=provider(),a=await login(p),b=await login(p);
  assert.equal((await handler(request('auth/sign-out',{token:a.access_token,data:{}}))).status,200);
  assert.equal((await handler(request('auth/session',{token:b.access_token}))).status,200);
});
test('durable sign-out blocks reimport even if provider logout is unavailable',async()=>{
  const p=provider(),a=await login(p);p.state.logoutOffline=true;
  assert.equal((await handler(request('auth/sign-out',{token:a.access_token,data:{}}))).status,200);
  assert.equal((await handler(request('auth/import-session',{data:{accessToken:a.access_token,refreshToken:a.refresh_token}}))).status,401);
  assert.equal((await handler(request('auth/session',{token:a.access_token}))).status,401);
});
test('sign-out refreshes an expired access token before revoking its own session',async()=>{
  const p=provider(),a=await login(p);p.expired.add(a.access_token);p.state.logoutOffline=true;
  assert.equal((await handler(request('auth/sign-out',{token:a.access_token,refresh:a.refresh_token,data:{}}))).status,200);
  assert.equal((await handler(request('auth/session',{refresh:a.refresh_token}))).status,401);
});
test('unavailable session control fails closed without falsely reporting replacement',async()=>{
  const p=provider(),a=await login(p);p.state.guardOffline=true;
  for(const route of ['auth/session','workspace','auth/sign-out']) {
    const response=await handler(request(route,{token:a.access_token,...(route.endsWith('sign-out')?{data:{}}:{})}));
    assert.equal(response.status,503);assert.equal((await response.json()).error,'session_control_unavailable');
    assert.equal(response.headers.getSetCookie().length,0);
  }
  assert.equal(p.accepted.get(owner).revoked,false);
});
test('JWT decoding never substitutes for upstream identity validation',async()=>{
  const p=provider();
  const response=await handler(request('auth/session',{token:fixtureToken(owner)}));
  assert.equal(response.status,401);
  assert.equal(p.calls.filter(c=>c.url.includes('/rpc/')).length,0);
});
test('missing session claim or mismatched subject fails closed after token verification',async()=>{
  const p=provider(),a=await login(p);
  for(const token of ['not-a-jwt',fixtureToken(other)]) {
    const previous=globalThis.fetch;
    globalThis.fetch=async(url,init)=>String(url).endsWith('/auth/v1/user')?json(a.user):previous(url,init);
    assert.equal((await handler(request('auth/session',{token}))).status,401);
    globalThis.fetch=previous;
  }
});
test('account creation always awaits approval and never claims or returns a session',async()=>{
  const p=provider(),data={name:'Fixture',email:'test@example.invalid',password:'Strong-Fixture12!'};
  p.state.confirmation=true;
  assert.equal((await handler(request('auth/sign-up',{data}))).status,202);
  assert.equal(p.calls.filter(c=>c.url.includes('/rpc/')).length,0);
  p.state.confirmation=false;
  const response=await handler(request('auth/sign-up',{data}));
  assert.equal(response.status,202);assert.equal((await response.json()).approvalRequired,true);
  assert.equal(response.headers.getSetCookie().length,0);assert.equal(p.accepted.size,0);
});
