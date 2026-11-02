import {test,after} from 'node:test';import assert from 'node:assert/strict';import nodeCrypto from 'node:crypto';
import {pushApi,planMessage,signalMessage} from '../lib/push-api.js';import {b64url} from '../lib/web-push.js';import {AI_FRAMES} from '../lib/ai-analysis.js';
const original=globalThis.fetch;after(()=>globalThis.fetch=original);
const json=(v,status=200)=>new Response(JSON.stringify(v),{status,headers:{'content-type':'application/json'}});
const owner='11111111-1111-4111-8111-111111111111',unpaid='22222222-2222-4222-8222-222222222222';
function keys(){const {privateKey}=nodeCrypto.generateKeyPairSync('ec',{namedCurve:'prime256v1'}),jwk=privateKey.export({format:'jwk'});
  return {vapidPrivate:jwk.d,vapidPublic:b64url.encode(Buffer.concat([Buffer.from([4]),Buffer.from(b64url.decode(jwk.x)),Buffer.from(b64url.decode(jwk.y))])),tick:'t'.repeat(40)};}
function sub(user,n){const e=nodeCrypto.createECDH('prime256v1');e.generateKeys();return {user_id:user,endpoint:'https://fcm.googleapis.com/fcm/send/'+n,p256dh:b64url.encode(e.getPublicKey()),auth:b64url.encode(nodeCrypto.randomBytes(16)),paid_exempt:false};}
function setup({secrets=keys(),subs=[sub(owner,'a'),sub(owner,'gone'),sub(unpaid,'c')]}={}){
  const ms=AI_FRAMES['5min'],asOf=Math.floor(Date.now()/ms)*ms-6*ms,calls=[],pushes=[],writes=[];
  const plan={direction:'buy',conditional:true,entry:100,stop:90,targets:[110,120,130],triggerLevel:101,activeUntil:asOf+12*ms};
  const rows=[{cache_key:'a'.repeat(64),user_id:owner,result:{symbol:'XAU',interval:'5min',asOf,generatedAt:asOf,plan},outcome:null},
    {cache_key:'b'.repeat(64),user_id:unpaid,result:{symbol:'XAU',interval:'5min',asOf,generatedAt:asOf,plan},outcome:null}];
  const bars=[[asOf-ms,100,101,99,100],[asOf,100,103,99,102],[asOf+ms,101,101,99,100]].map(([time,open,high,low,close])=>({time,open,high,low,close,closed:true}));
  globalThis.fetch=async(url,init)=>{pushes.push(url);return new Response(null,{status:url.endsWith('gone')?410:201});};
  const supabaseAdminData=async(path,init={})=>{calls.push({path,method:init.method||'GET'});
    if(path.startsWith('rpc/pipvoria_push_secrets'))return json(secrets);
    if(path.startsWith('ai_analysis_cache?status=eq.completed&created_at'))return json(rows);
    if(path.startsWith('ai_analysis_cache?cache_key'))return writes.push(JSON.parse(init.body)),json([]);
    if(path.startsWith('push_subscriptions?user_id=in'))return json(subs);
    if(path.startsWith('payment_subscriptions'))return json([{user_id:owner}]);
    if(path.startsWith('push_subscriptions?on_conflict'))return writes.push(JSON.parse(init.body)),json([]);
    return json([]);};
  const handler=pushApi({currentSession:async r=>r.headers.get('x-test-session')?{user:{id:owner,app_metadata:{}}}:null,supabaseAdminData,sessionJson:json,json,body:r=>r.json(),
    gold:async()=>({bars}),additionalMarket:async()=>assert.fail('XAU only')});
  return {handler,calls,pushes,writes,secrets};
}
const post=(route,body,headers={})=>new Request('https://site.invalid/api?route='+route,{method:'POST',headers,body:JSON.stringify(body)});
test('the tick needs the Vault secret, advances outcomes and notifies only paid owners of activated plans',async()=>{
  const f=setup();
  assert.equal((await f.handler(post('cron/tick',{}),null,'tick')).status,404);
  assert.equal((await f.handler(post('cron/tick',{},{'x-cron-secret':'t'.repeat(39)+'x'}),null,'tick')).status,404);
  const result=await(await f.handler(post('cron/tick',{},{'x-cron-secret':f.secrets.tick}),null,'tick')).json();
  assert.deepEqual(result,{advanced:2,notified:1});
  assert.deepEqual(f.pushes.sort(),['https://fcm.googleapis.com/fcm/send/a','https://fcm.googleapis.com/fcm/send/gone']);
  assert.ok(f.calls.some(c=>c.method==='DELETE'&&c.path.includes('gone')),'expired subscriptions are removed');
  assert.ok(f.writes.every(w=>w.outcome.activatedAt));
  const off=setup({secrets:{}});assert.equal((await off.handler(post('cron/tick',{},{'x-cron-secret':'x'}),null,'tick')).status,503);
});
test('messages cover activation, closure and cancellation of plans from the last day only',()=>{
  const now=Date.now(),plan={direction:'sell',conditional:true,entry:100,stop:110,targets:[90,80,70]},result={symbol:'SOL',interval:'15min',generatedAt:now-1000,plan};
  assert.match(planMessage({row:{cache_key:'k',result,outcome:{state:'waiting',activatedAt:now}},before:{state:'waiting'}},now).title,/activé · SOL\/USD 15m/);
  assert.match(planMessage({row:{cache_key:'k',result,outcome:{state:'closed',activatedAt:1,exit:{reason:'tp3',resultR:2}}},before:{state:'open',activatedAt:1}},now).body,/TP3 atteint · \+2 R/);
  assert.match(planMessage({row:{cache_key:'k',result,outcome:{state:'not_triggered'}},before:{state:'waiting'}},now).title,/annulé/);
  assert.equal(planMessage({row:{cache_key:'k',result:{...result,generatedAt:now-2*86400000},outcome:{state:'waiting',activatedAt:now}},before:{state:'waiting'}},now),null);
  assert.equal(planMessage({row:{cache_key:'k',result,outcome:{state:'open',activatedAt:1}},before:{state:'waiting',activatedAt:1}},now),null);
});
test('subscriptions require a session, a browser push service and are stored for the owner only',async()=>{
  const f=setup(),s=sub(owner,'new');
  assert.equal((await f.handler(post('push/subscribe',{endpoint:s.endpoint,keys:{p256dh:s.p256dh,auth:s.auth}}),null,'subscribe')).status,401);
  const auth={'x-test-session':'1'};
  assert.equal((await f.handler(post('push/subscribe',{endpoint:'https://evil.example/x',keys:{p256dh:s.p256dh,auth:s.auth}},auth),null,'subscribe')).status,400);
  assert.equal((await f.handler(post('push/subscribe',{endpoint:s.endpoint,keys:{p256dh:s.p256dh,auth:s.auth}},auth),null,'subscribe')).status,200);
  assert.deepEqual(f.writes.at(-1),{user_id:owner,endpoint:s.endpoint,p256dh:s.p256dh,auth:s.auth,paid_exempt:false});
  const config=await(await f.handler(new Request('https://site.invalid/api?route=push/config',{headers:auth}),null,'config')).json();
  assert.deepEqual(config,{configured:true,publicKey:f.secrets.vapidPublic,watch:null});
  await f.handler(post('push/unsubscribe',{endpoint:s.endpoint},auth),null,'unsubscribe');
  assert.ok(f.calls.some(c=>c.method==='DELETE'&&c.path.includes('user_id=eq.'+owner)));
});

function watchSetup({watches,paidUsers=[owner],result,error,closed=()=>false}){
  process.env.OPENAI_API_KEY='fixture-ai-key';
  const secrets=keys(),calls=[],pushes=[],runs=[],patches=[];
  globalThis.fetch=async url=>{pushes.push(url);return new Response(null,{status:201});};
  const supabaseAdminData=async(path,init={})=>{calls.push({path,method:init.method||'GET'});
    if(path.startsWith('rpc/pipvoria_push_secrets'))return json(secrets);
    if(path.startsWith('ai_analysis_cache?status=eq.completed'))return json([]);
    if(path.startsWith('ai_auto_watch?or='))return json(watches);
    if(path.startsWith('ai_auto_watch?user_id=eq.')&&init.method==='PATCH')return patches.push({path,body:JSON.parse(init.body)}),json([]);
    if(path.startsWith('payment_subscriptions'))return json(paidUsers.map(user_id=>({user_id})));
    if(path.startsWith('push_subscriptions?user_id=in'))return json([sub(owner,'a')]);
    return json([]);};
  const handler=pushApi({currentSession:async r=>r.headers.get('x-test-session')?{user:{id:owner,app_metadata:{}}}:null,supabaseAdminData,sessionJson:json,json,body:r=>r.json(),
    gold:async()=>({bars:[]}),additionalMarket:async()=>({bars:[]}),marketHours:(symbol)=>closed(symbol),news:()=>null,
    run:async args=>{runs.push(args);if(error)throw Error(error);return result;}});
  return {handler,secrets,calls,pushes,runs,patches};
}
const tick=async f=>(await f.handler(post('cron/tick',{},{'x-cron-secret':f.secrets.tick}),null,'tick')).json();
const plan={direction:'buy',conditional:true,entry:4200,stop:4190,targets:[4210,4220,4230],triggerLevel:4202};
test('an automatic watch runs one analysis per tick for an open market and notifies a new plan once',async()=>{
  const result={symbol:'XAU',interval:'15min',status:'conditional',plan,cacheKey:'c'.repeat(64),cached:false};
  const f=watchSetup({watches:[{user_id:unpaid,symbol:'EUR',interval:'1h',paid_exempt:false},{user_id:owner,symbol:'XAU',interval:'15min',paid_exempt:false,last_cache_key:null},{user_id:owner,symbol:'BTC',interval:'1h',paid_exempt:false}],result});
  const out=await tick(f);
  assert.deepEqual(out.watch,{watch:'XAU 15min',status:'conditional',notified:1});
  assert.deepEqual(f.runs,[{symbol:'XAU',interval:'15min',userId:owner}],'one model call per tick, unpaid accounts skipped');
  assert.equal(f.patches.find(p=>p.path.includes(unpaid)).body.last_status,'inactive');
  assert.equal(f.patches.find(p=>p.path.includes(owner)).body.last_cache_key,'c'.repeat(64));
  assert.equal(f.pushes.length,1);
  const again=watchSetup({watches:[{user_id:owner,symbol:'XAU',interval:'15min',paid_exempt:false,last_cache_key:'c'.repeat(64)}],result});
  assert.equal((await tick(again)).watch.notified,0,'the same plan is never announced twice');
});
test('closed markets are skipped and analysis errors are recorded on the watch',async()=>{
  const closed=watchSetup({watches:[{user_id:owner,symbol:'XAU',interval:'15min',paid_exempt:false}],closed:s=>s==='XAU',result:null});
  assert.equal((await tick(closed)).watch,undefined);assert.equal(closed.runs.length,0);
  const limited=watchSetup({watches:[{user_id:owner,symbol:'BTC',interval:'1h',paid_exempt:false}],error:'analysis_daily_limit'});
  assert.equal((await tick(limited)).watch.status,'error');assert.equal(limited.patches[0].body.last_status,'analysis_daily_limit');
});
test('the watch route validates the market and period and can be turned off',async()=>{
  const f=watchSetup({watches:[]}),auth={'x-test-session':'1'};
  assert.equal((await f.handler(post('push/watch',{symbol:'DOGE',interval:'1h'},auth),null,'watch')).status,400);
  assert.equal((await f.handler(post('push/watch',{symbol:'XAU',interval:'1min'},auth),null,'watch')).status,400);
  assert.equal((await f.handler(post('push/watch',{symbol:'ETH',interval:'15min'},auth),null,'watch')).status,200);
  assert.ok(f.calls.some(c=>c.path==='ai_auto_watch?on_conflict=user_id'&&c.method==='POST'));
  assert.deepEqual(await(await f.handler(post('push/watch',{enabled:false},auth),null,'watch')).json(),{watch:null});
  assert.ok(f.calls.some(c=>c.method==='DELETE'&&c.path.includes('ai_auto_watch?user_id=eq.'+owner)));
});
test('signal messages describe firm and conditional plans',()=>{
  assert.match(signalMessage({symbol:'XAU',interval:'15min',plan}).body,/ACHAT si clôture au-dessus de 4202/);
  assert.match(signalMessage({symbol:'SOL',interval:'1h',plan:{...plan,conditional:false,direction:'sell'}}).title,/Nouveau signal IA · SOL\/USD 1h/);
  assert.equal(signalMessage({symbol:'XAU',interval:'1h',plan:null}),null);
});
