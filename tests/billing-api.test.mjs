import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import handler from '../api/index.js';
import {signedQuery,checkoutUrl} from '../lib/crypto-billing.js';
import {fixtureToken,sessionRpc} from './auth-fixture.mjs';
const original=fetch;after(()=>globalThis.fetch=original);
Object.assign(process.env,{SUPABASE_URL:'https://fixture.invalid',SUPABASE_PUBLISHABLE_KEY:'fixture-public',SUPABASE_SECRET_KEY:'fixture-service',PAYERURL_ENABLED:'true',PAYERURL_PUBLIC_KEY:'fixture-payer',PAYERURL_SECRET_KEY:'fixture-secret',PIPVORIA_PUBLIC_URL:'https://site.invalid'});
const owner='11111111-1111-4111-8111-111111111111',id='22222222-2222-4222-8222-222222222222';
const json=(v,s=200)=>new Response(JSON.stringify(v),{status:s});
const req=(route,data,extra={})=>new Request('https://site.invalid/api?route='+route,{method:data?'POST':'GET',headers:{cookie:'blh_access='+fixtureToken(owner),origin:'https://site.invalid','content-type':'application/json',...extra},body:data?JSON.stringify(data):undefined});
function mock(run){globalThis.fetch=async(url,init={})=>String(url).endsWith('/auth/v1/user')?json({id:owner,email:'customer@example.invalid',created_at:'2026-09-01T00:00:00Z'}):sessionRpc(url)?json(true):run(String(url),init);}
function auth(data){return 'Bearer '+Buffer.from('fixture-payer:'+createHmac('sha256','fixture-secret').update(signedQuery(data)).digest('hex')).toString('base64');}
const notification=()=>({order_id:id,ext_transaction_id:'chain-ref',transaction_id:'provider-ref',status_code:200,note:'Completed',confirm_rcv_amnt:'49.00',confirm_rcv_amnt_curr:'USD',coin_rcv_amnt:'48.99',coin_rcv_amnt_curr:'USDT',txn_time:'1792170000'});

test('checkout binds owner and price to the server, signs official form format, and rejects arbitrary redirects',async()=>{
 let called=0;
 mock((url,init)=>{if(url.startsWith('https://api-v2.payerurl.com')){called++;const form=Object.fromEntries(new URLSearchParams(init.body));assert.equal(form.amount,'4900');assert.equal(form.currency,'usd');assert.equal(form.billing_email,'customer@example.invalid');assert.equal(form.notify_url,'https://site.invalid/api?route=billing/notify');assert.equal(init.headers.authorization,auth(form));return json({redirectTO:'https://api-v2.payerurl.com/checkout/fixture'});}
 if(init.method==='POST'){const row=JSON.parse(init.body);assert.equal(row.user_id,owner);assert.equal(row.amount_minor,4900);assert.equal(row.duration_days,30);return json([row]);}
 if(init.method==='PATCH')return new Response(null,{status:204});return json([]);});
 const result=await handler(req('billing/checkout',{method:'payerurl',plan:'monthly',accepted:true,orderId:id,amount:1,user_id:'attacker',redirect:'https://evil.invalid'}));
 assert.equal(result.status,201);assert.equal((await result.json()).redirectUrl,'https://api-v2.payerurl.com/checkout/fixture');assert.equal(called,1);
 assert.equal(checkoutUrl('https://dash.payerurl.com/checkout/fixture'),'https://dash.payerurl.com/checkout/fixture');
 for(const host of ['dash.payerurl.com','api-v2.payerurl.com'])for(const url of ['http://'+host+'/a','https://'+host+'.evil.invalid/a','https://user@'+host+'/a','https://'+host+':444/a'])assert.equal(checkoutUrl(url),null);
 assert.equal(checkoutUrl('https://evil.invalid'),null);
});
test('config stays unavailable without keys or the payment migration',async()=>{
 mock(()=>json({error:'missing table'},404));const config=await(await handler(req('billing/config'))).json();assert.equal(config.configured,false);assert.equal(config.methods[0].available,false);assert.ok(!JSON.stringify(config).includes('fixture-secret'));
 process.env.PAYERURL_ENABLED='false';mock(()=>assert.fail('disabled checkout must not call upstream'));assert.equal((await handler(req('billing/checkout',{method:'payerurl'}))).status,503);process.env.PAYERURL_ENABLED='true';
});

test('checkout works in runtimes without AbortSignal.timeout',async()=>{
 const timeout=AbortSignal.timeout;AbortSignal.timeout=undefined;
 try {
  mock((url,init)=>{if(url.startsWith('https://api-v2.payerurl.com')){assert.ok(init.signal instanceof AbortSignal);return json({redirectTO:'https://dash.payerurl.com/checkout/edge'});}
   if(init.method==='POST')return json([JSON.parse(init.body)]);if(init.method==='PATCH')return new Response(null,{status:204});return json([]);});
  const result=await handler(req('billing/checkout',{method:'payerurl',plan:'monthly',accepted:true,orderId:id}));assert.equal(result.status,201);
 }finally{AbortSignal.timeout=timeout;}
});

test('provider failures never store unsafe redirects and diagnostics redact credentials and customer email',async()=>{
 const originalError=console.error,logs=[];console.error=(...args)=>logs.push(args);
 try {
  mock((url,init)=>{if(url.startsWith('https://api-v2.payerurl.com')){assert.equal(init.redirect,'manual');return json({customCode:2030,message:'fixture-secret fixture-payer customer@example.invalid',redirectTO:'https://evil.invalid/token'});}
   assert.notEqual(init.method,'PATCH');if(init.method==='POST')return json([JSON.parse(init.body)]);return json([]);});
  const result=await handler(req('billing/checkout',{method:'payerurl',plan:'monthly',accepted:true,orderId:id}));assert.equal(result.status,502);
  const output=JSON.stringify(logs);for(const secret of ['fixture-secret','fixture-payer','customer@example.invalid'])assert.ok(!output.includes(secret));assert.equal(logs[0][1].providerCode,2030);assert.equal(logs[0][1].redirectHost,'evil.invalid');
 }finally{console.error=originalError;}
});
test('checkout requires session, same origin and explicit consent',async()=>{
 globalThis.fetch=()=>assert.fail('no upstream before rejecting');
 assert.equal((await handler(req('billing/checkout',{},{cookie:''}))).status,401);
 assert.equal((await handler(req('billing/checkout',{},{origin:'https://evil.invalid'}))).status,404);
 mock(()=>assert.fail('invalid checkout must not write'));
 for(const value of [{method:'binance',accepted:true},{method:'payerurl',accepted:false},{method:'payerurl',accepted:true,plan:'free'}])assert.equal((await handler(req('billing/checkout',{plan:'monthly',orderId:id,...value}))).status,400);
});
test('pending checkout is reused; another user cannot read or reuse it',async()=>{
 mock(()=>json([{id,user_id:owner,status:'pending',checkout_url:'https://dash.payerurl.com/checkout/one'}]));
 assert.equal((await handler(req('billing/checkout',{method:'payerurl',plan:'monthly',accepted:true,orderId:id}))).status,200);
 mock(()=>json([{id,user_id:'another-user',status:'pending',checkout_url:'https://dash.payerurl.com/checkout/one'}]));
 assert.equal((await handler(req('billing/checkout',{method:'payerurl',plan:'monthly',accepted:true,orderId:id}))).status,404);
 mock(url=>{assert.ok(url.includes('user_id=eq.'+owner));return json([]);});assert.equal((await handler(req('billing/status&id='+id))).status,404);
});
test('signed JSON and form notifications work without browser sessions; spoofed, partial or tampered payments never grant time',async()=>{
 let grants=0;globalThis.fetch=async(url,init)=>{assert.ok(String(url).endsWith('/rpc/pipvoria_confirm_payment'));const data=JSON.parse(init.body);assert.equal(data.p_amount_minor,4900);grants++;return json({confirmed:true});};
 const good=notification();let result=await handler(req('billing/notify',good,{cookie:'',authorization:auth(good)}));assert.equal(result.status,200);assert.equal((await result.json()).status,2040);
 const form=new Request('https://site.invalid/api?route=billing/notify',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded',authorization:auth(good)},body:signedQuery(good)});assert.equal((await handler(form)).status,200);
 const tampered={...good,confirm_rcv_amnt:'4900'};assert.equal((await handler(req('billing/notify',tampered,{authorization:auth(good)}))).status,401);
 assert.equal((await handler(req('billing/notify',good))).status,401);
 for(const patch of [{confirm_rcv_amnt_curr:'EUR'},{confirm_rcv_amnt:'4.9e1'},{status_code:20000},{status_code:100}]){const data={...good,...patch};await handler(req('billing/notify',data,{authorization:auth(data)}));}assert.equal(grants,2);
 globalThis.fetch=async()=>json({confirmed:false});assert.equal((await handler(req('billing/notify',{...good,confirm_rcv_amnt:'48.00'},{authorization:auth({...good,confirm_rcv_amnt:'48.00'})}))).status,409);
});

