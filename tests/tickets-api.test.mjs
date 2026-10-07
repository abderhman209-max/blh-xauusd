import {test,after} from 'node:test';import assert from 'node:assert/strict';import handler from '../api/index.js';
import {fixtureToken,fixtureSessionId,sessionRpc} from './auth-fixture.mjs';
const originalFetch=globalThis.fetch;after(()=>{globalThis.fetch=originalFetch});
process.env.SUPABASE_URL='https://fixture.invalid';process.env.SUPABASE_PUBLISHABLE_KEY='fixture-public';process.env.SUPABASE_SECRET_KEY='fixture-secret';
const owner='11111111-1111-4111-8111-111111111111',tid='22222222-2222-4222-8222-222222222222',mid='33333333-3333-4333-8333-333333333333';
const user={id:owner,user_metadata:{full_name:'Member'},app_metadata:{}};
const row={id:tid,number:7,user_id:owner,user_name:'Member',subject:'Question',status:'open',created_at:'2026-10-07T12:00:00Z',updated_at:'2026-10-07T12:00:00.000123Z',last_message_at:'2026-10-07T12:00:00Z',last_sender_role:'customer',last_message_preview:'Hello'};
const message={id:mid,seq:1,sender_role:'customer',body:'Hello',created_at:'2026-10-07T12:00:00Z',sender_id:owner};
const reply=(v,status=200)=>new Response(JSON.stringify(v),{status});
const request=(route,data,origin='https://site.invalid')=>new Request('https://site.invalid/api?route='+route,{method:data?'POST':'GET',headers:{cookie:'blh_access='+(route.startsWith('admin/')?fixtureToken(owner,undefined,{aal:'aal2'}):fixtureToken(owner)),origin,'content-type':'application/json'},...(data?{body:JSON.stringify(data)}:{})});
function mock(account,run,active=true){globalThis.fetch=async(url,init={})=>String(url).endsWith('/auth/v1/user')?reply(account,account?200:401):sessionRpc(url)?reply(active):run(String(url),init)}
test('tickets reject anonymous, foreign-origin, replaced sessions and forged administrator metadata',async()=>{
  mock(null,()=>assert.fail('no data'));assert.equal((await handler(request('support/tickets'))).status,401);
  mock(user,()=>assert.fail('no data'));assert.equal((await handler(request('support/tickets',null,'https://foreign.invalid'))).status,404);
  mock(user,()=>assert.fail('no data'),false);assert.equal((await handler(request('support/tickets'))).status,401);
  mock({...user,user_metadata:{role:'super_admin'}},()=>assert.fail('no data'));assert.equal((await handler(request('admin/support/tickets'))).status,403);
});
test('ticket list uses owner credentials, safe filters and lookahead, with a unique human reference',async()=>{
  mock(user,(url,init)=>{assert.ok(url.includes('user_id=eq.'+owner));assert.ok(url.includes('status=eq.resolved'));assert.ok(url.includes('limit=51&offset=0'));assert.equal(new Headers(init.headers).get('authorization'),'Bearer '+fixtureToken(owner));return reply(Array.from({length:51},()=>row))});
  const result=await handler(request('support/tickets&status=resolved'));assert.equal(result.headers.get('cache-control'),'no-store');const data=await result.json();assert.equal(data.tickets.length,50);assert.equal(data.hasMore,true);assert.equal(data.tickets[0].reference,'PV-000007');assert.equal(data.tickets[0].updatedAt,row.updated_at);
  mock(user,()=>assert.fail('no query'));for(const q of ['status=invalid','offset=-1','offset=10001'])assert.equal((await handler(request('support/tickets&'+q))).status,400);
});
test('only missing schema disables ticket capability; other database errors remain errors',async()=>{
  mock(user,()=>reply({code:'PGRST205'},404));assert.equal((await(await handler(request('support/tickets'))).json()).configured,false);
  mock(user,()=>reply({code:'42501'},403));assert.equal((await handler(request('support/tickets'))).status,503);
});
test('messages first verify ticket ownership and use bounded cursor pagination',async()=>{
  mock(user,url=>{if(url.includes('support_tickets?')){assert.ok(url.includes('id=eq.'+tid));assert.ok(url.includes('user_id=eq.'+owner));return reply([])}assert.fail('must not read missing or foreign ticket')});assert.equal((await handler(request('support/ticket/messages&ticketId='+tid))).status,404);
  mock(user,url=>url.includes('support_tickets?')?reply([row]):reply([message]));const data=await(await handler(request('support/ticket/messages&ticketId='+tid))).json();assert.equal(data.messages[0].sender_id,undefined);
  mock(user,()=>assert.fail('no query'));for(const q of ['ticketId=bad','ticketId='+tid+'&after=0','ticketId='+tid+'&after=1&before=2'])assert.equal((await handler(request('support/ticket/messages&'+q))).status,400);
});
test('ticket creation derives identity and role; invalid subject and control characters never write',async()=>{
  mock(user,(url,init)=>{assert.ok(url.endsWith('/rpc/pipvoria_ticket_send'));const data=JSON.parse(init.body);assert.equal(data.p_sender_id,owner);assert.equal(data.p_admin,false);assert.equal(data.p_session_id,fixtureSessionId);assert.equal(data.p_subject,'Question');assert.equal(data.p_create,true);return reply({ticket:row,message})});
  assert.equal((await handler(request('support/ticket/create',{ticketId:tid,id:mid,subject:' Question ',text:'Hello',role:'admin',userId:tid}))).status,200);
  mock(user,()=>assert.fail('no write'));for(const subject of ['x','a'.repeat(101),'bad\nsubject'])assert.equal((await handler(request('support/ticket/create',{ticketId:tid,id:mid,subject,text:'Hello'}))).status,400);
  assert.equal((await handler(request('support/ticket/send',{ticketId:tid,id:mid,text:'\u0001'}))).status,400);
});
test('status preserves microsecond version, rejects customer in_progress, and reports safe conflicts',async()=>{
  mock(user,(url,init)=>{assert.ok(url.endsWith('/rpc/pipvoria_ticket_status'));const data=JSON.parse(init.body);assert.equal(data.p_admin,false);assert.equal(data.p_sender_id,owner);assert.equal(data.p_updated_at,row.updated_at);return reply(row)});
  assert.equal((await handler(request('support/ticket/status',{ticketId:tid,status:'resolved',updatedAt:row.updated_at}))).status,200);
  mock(user,()=>assert.fail('no write'));assert.equal((await handler(request('support/ticket/status',{ticketId:tid,status:'in_progress',updatedAt:row.updated_at}))).status,400);
  for(const [code,status]of [['support_ticket_conflict',409],['support_rate_limit',429],['support_forbidden',403],['private internals',503]]){mock(user,()=>reply({message:code},400));assert.equal((await handler(request('support/ticket/send',{ticketId:tid,id:mid,text:'Hello'}))).status,status)}
});
test('admin ticket API reads through service role and still derives sender from verified app_metadata',async()=>{
  mock({...user,app_metadata:{role:'super_admin'}},(url,init)=>{assert.equal(new Headers(init.headers).get('authorization'),'Bearer fixture-secret');if(url.includes('support_tickets?')){assert.ok(!url.includes('user_id=eq.'));return reply([row])}const data=JSON.parse(init.body);assert.equal(data.p_admin,true);assert.equal(data.p_sender_id,owner);return reply({ticket:row,message})});
  assert.equal((await handler(request('admin/support/tickets'))).status,200);assert.equal((await handler(request('admin/support/ticket/send',{ticketId:tid,id:mid,text:'Hello'}))).status,200);
});
