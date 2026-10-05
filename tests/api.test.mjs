import {test,after} from 'node:test';import assert from 'node:assert/strict';import handler from '../api/index.js';
const originalFetch=globalThis.fetch;after(()=>{globalThis.fetch=originalFetch});process.env.SUPABASE_URL='https://fixture.invalid';process.env.SUPABASE_PUBLISHABLE_KEY='test-public-key';
const user={id:'11111111-1111-4111-8111-111111111111',user_metadata:{pipvoria_settings:{timezone:'Europe/Paris',confirmedOnly:true}}};const id='22222222-2222-4222-8222-222222222222';const payload={symbol:'XAU/USD',interval:'5min',status:'win',closedAt:Date.now(),resultR:2,clientUpdatedAt:Date.now()};
const response=(v,status=200)=>new Response(JSON.stringify(v),{status});
const request=(route,data,method=data?'POST':'GET')=>new Request('https://site.invalid/api?route='+route,{method,headers:{cookie:'blh_access=test-token',origin:'https://site.invalid','content-type':'application/json'},body:data?JSON.stringify(data):undefined});
function mock(run){globalThis.fetch=async(url,init={})=>String(url).endsWith('/auth/v1/user')&&(!init.method||init.method==='GET')?response(user):run(String(url),init)}
test('settings migrate legacy metadata to an owner-scoped CAS document',async()=>{
 let row=null;
 mock((url,init)=>{assert.ok(url.includes('/rest/v1/analysis_snapshots'));if(!init.method){assert.ok(url.includes('id=eq.'+user.id)&&url.includes('user_id=eq.'+user.id)&&url.includes('kind=eq.settings'));return response(row?[row]:[])}
 const data=JSON.parse(init.body);assert.equal(init.method,'POST');assert.equal(data.id,user.id);assert.equal(data.user_id,user.id);assert.equal(data.kind,'settings');row=data;return response([row])});
 const legacy=await(await handler(request('settings'))).json();assert.equal(legacy.settings.timezone,'Europe/Paris');assert.equal(legacy.revision,null);
 const saved=await(await handler(request('settings',{settings:{timezone:'UTC'},baseRevision:null}))).json();assert.ok(saved.revision);assert.equal(saved.settings.timezone,'UTC');
 assert.equal((await(await handler(request('settings'))).json()).settings.timezone,'UTC');
});

test('settings CAS rejects stale and concurrent initial writes, then preserves independent edits on rebase',async()=>{
 let row={updated_at:'2026-10-05T10:00:00Z',payload:{settings:globalThis.PIPVORIA_CORE.settings({timezone:'UTC'})}};
 mock((url,init)=>{if(!init.method)return response([row]);if(init.method==='POST')return response([]);
 assert.equal(init.method,'PATCH');assert.ok(url.includes('user_id=eq.'+user.id)&&url.includes('kind=eq.settings'));
 const version=decodeURIComponent(url.split('&updated_at=eq.')[1]);
 if(version!==row.updated_at)return response([]);
 row={...row,...JSON.parse(init.body)};return response([row])});
 const C=globalThis.PIPVORIA_CORE,base=structuredClone(row.payload.settings),version=row.updated_at;
 assert.equal((await handler(request('settings',{settings:base,baseRevision:null}))).status,409);
 const a=await handler(request('settings',{settings:{...base,timezone:'Asia/Riyadh'},baseRevision:version}));assert.equal(a.status,200);
 const b=await handler(request('settings',{settings:{...base,confirmedOnly:false},baseRevision:version}));assert.equal(b.status,409);
 const remote=await b.json(),rebased=C.mergeSettings(remote.settings,C.settingsDiff(base,{...base,confirmedOnly:false}));
 assert.equal((await handler(request('settings',{settings:rebased,baseRevision:remote.revision}))).status,200);
 assert.equal(row.payload.settings.timezone,'Asia/Riyadh');assert.equal(row.payload.settings.confirmedOnly,false);
});

test('settings without version and malformed targets never write',async()=>{
 mock(()=>assert.fail('must not write'));
 assert.equal((await handler(request('settings',{settings:{timezone:'UTC'}}))).status,409);
 for(const settings of [{indicators:{'smart-tp1':'3','smart-tp2':'2','smart-tp3':'1'}},{presets:{}},{marketProfiles:{'XAU/USD|5min':{'blh-rr1':'3'}}}])
 assert.equal((await handler(request('settings',{settings,baseRevision:null}))).status,400);
});

test('journal endpoints cannot overwrite the reserved settings document',async()=>{
 mock(()=>assert.fail('must not write'));
 assert.equal((await handler(request('journal/create',{id:user.id,payload}))).status,400);
 assert.equal((await handler(request('journal/update&id='+user.id,{payload,baseUpdatedAt:'2026-10-01T12:00:00Z'}))).status,400);
});

test('essential notification defaults are entry, target and stop',async()=>{
 mock((url,init)=>{const p=JSON.parse(init.body);assert.equal(p.new_signal,false);assert.equal(p.signal_updates,false);assert.equal(p.entry_zone,true);assert.equal(p.target_hit,true);assert.equal(p.stop_loss,true);return response([p])});
 assert.equal((await handler(request('preferences',{}))).status,200);
});
test('cross-origin settings mutation rejected',async()=>{const req=new Request('https://site.invalid/api?route=settings',{method:'POST',headers:{origin:'https://other.invalid','content-type':'application/json'},body:'{}'});assert.equal((await handler(req)).status,404)});
test('CAS update scopes owner and returns newer server version on conflict',async()=>{let calls=0;const entry={id,updated_at:new Date().toISOString(),payload};mock((url,init)=>{calls++;assert.ok(url.includes('user_id=eq.'+user.id));if(init.method==='PATCH'){assert.ok(url.includes('updated_at=eq.'));return response([])}return response([entry])});const r=await handler(request('journal/update&id='+id,{kind:'trade',payload,baseUpdatedAt:'2026-10-01T12:00:00Z'}));assert.equal(r.status,409);assert.equal((await r.json()).entry.id,id);assert.equal(calls,2)});
test('update without revision does not write',async()=>{mock(()=>{assert.fail('must not write')});assert.equal((await handler(request('journal/update&id='+id,{payload}))).status,409)});
test('idempotent create preserves successful prior write',async()=>{mock((url,init)=>init.method==='POST'?response([]):response([{id,payload}]));const r=await handler(request('journal/create',{id,kind:'trade',payload}));assert.equal(r.status,200);assert.equal((await r.json()).entry.id,id)});
test('different retry revision yields conflict, never overwrites',async()=>{mock((url,init)=>init.method==='POST'?response([]):response([{id,payload:{...payload,clientUpdatedAt:1}}]));assert.equal((await handler(request('journal/create',{id,payload}))).status,409)});
test('unknown results stay null and closure timestamp is saved',async()=>{mock((url,init)=>{const data=JSON.parse(init.body);assert.equal(data.payload.resultR,null);assert.equal(data.payload.closedAt,payload.closedAt);return response([{id,payload:data.payload}])});assert.equal((await handler(request('journal/create',{id,payload:{...payload,resultR:null}}))).status,201)});
test('logout confirms cookie clearing even if upstream is unavailable',async()=>{mock(()=>{throw Error('offline')});const r=await handler(request('auth/sign-out',{}));assert.equal(r.status,200);assert.equal((await r.json()).signedOut,true);assert.ok(r.headers.get('set-cookie').includes('Max-Age=0'))});
test('gold failure never calls PAXG fallback and Yahoo uses 1m',async()=>{const calls=[];mock(url=>{calls.push(url);return response({error:'unavailable'},503)});const r=await handler(request('gold&interval=1min'));assert.equal(r.status,503);assert.ok(calls.some(u=>u.includes('interval=1m&')));assert.ok(calls.every(u=>!u.includes('PAXG')&&!u.includes('binance')))});
test('invalid dates, results and risk are rejected rather than silently discarded',async()=>{mock(()=>assert.fail('must not write'));for(const bad of [{closedAt:Date.now()+86400000},{riskPercent:200},{resultR:1001}])assert.equal((await handler(request('journal/create',{id,payload:{...payload,...bad}}))).status,400)});
test('unavailable provider yields structured response, not an unhandled rejection',async()=>{globalThis.fetch=async()=>{throw Error('offline')};const r=await handler(request('settings'));assert.equal(r.status,500);assert.equal((await r.json()).error,'server_error')});
