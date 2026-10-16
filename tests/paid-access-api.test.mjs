import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import handler from '../api/index.js';
import {PAID_ROUTES} from '../lib/paid-access.js';
import {signedQuery} from '../lib/crypto-billing.js';
import {fixtureToken,sessionRpc,subscriptionQuery} from './auth-fixture.mjs';
const original=fetch;after(()=>globalThis.fetch=original);
Object.assign(process.env,{SUPABASE_URL:'https://paid-fixture.invalid',SUPABASE_PUBLISHABLE_KEY:'public',SUPABASE_SECRET_KEY:'server',PAYERURL_ENABLED:'true',PAYERURL_PUBLIC_KEY:'payer-fixture',PAYERURL_SECRET_KEY:'secret-fixture',PIPVORIA_PUBLIC_URL:'https://site.invalid'});
const owner='11111111-1111-4111-8111-111111111111',orderId='22222222-2222-4222-8222-222222222222';
const json=(value,status=200)=>new Response(JSON.stringify(value),{status});
const request=(route,data,anonymous=false)=>new Request('https://site.invalid/api?route='+route,{method:data===undefined?'GET':'POST',headers:{cookie:anonymous?'':'blh_access='+fixtureToken(owner),origin:'https://site.invalid','content-type':'application/json'},...(data===undefined?{}:{body:JSON.stringify(data)})});
function fixture({until=null,admin=false,offline=false}={}){
 const state={until,upstream:[],lookups:[],user:{id:owner,email:'owner@example.invalid',created_at:'2026-09-01T00:00:00Z',app_metadata:admin?{role:'super_admin'}:{},user_metadata:{role:'super_admin',paid_until:'2099-01-01T00:00:00Z',subscription:{active:true}}}};
 globalThis.fetch=async(url,init={})=>{url=String(url);if(url.endsWith('/auth/v1/user'))return json(state.user);if(sessionRpc(url))return json(true);
  if(subscriptionQuery(url)){state.lookups.push(url);assert.ok(url.includes('user_id=eq.'+owner));assert.equal(new Headers(init.headers).get('apikey'),'server');return offline?json({},503):json(state.until?[{paid_until:state.until}]:[]);}
  if(url.endsWith('/rpc/pipvoria_confirm_payment')){state.until=new Date(Date.now()+30*86400000).toISOString();return json({confirmed:true});}
  state.upstream.push(url);if(url.includes('/admin/users?'))return json({users:[]});return json([]);
 };return state;
}
test('every terminal endpoint rejects unpaid and expired approved accounts, including administrators and forged metadata',async()=>{
 for(const options of [{},{until:'2000-01-01T00:00:00Z'},{until:'invalid'},{admin:true}]){
  const state=fixture(options);
  for(const route of PAID_ROUTES){const data=['journal/create','journal/update','preferences','notifications/create','notifications/read'].includes(route)?{}:undefined;
   const response=await handler(request(route,data));assert.equal(response.status,402,route);assert.equal((await response.json()).error,'subscription_required');}
  assert.equal(state.upstream.length,0);
 }
});
test('payment verification failures fail closed; billing, session, support and owner administration remain reachable',async()=>{
 fixture({offline:true});assert.equal((await handler(request('workspace'))).status,503);assert.equal((await handler(request('billing/access'))).status,503);
 const state=fixture({admin:true});assert.equal((await handler(request('auth/session'))).status,200);
 assert.equal((await handler(request('billing/config'))).status,200);assert.equal((await handler(request('billing/summary'))).status,200);
 assert.equal((await handler(request('admin/users'))).status,200);await handler(request('support/messages'));assert.ok(state.upstream.some(url=>url.includes('support_messages')));
 assert.equal((await handler(request('gold',undefined,true))).status,401);
});
test('a signed confirmed payment grants access; a checkout return or unsigned notification does not',async()=>{
 const state=fixture();let response=await handler(request('billing/access'));assert.equal((await response.json()).active,false);
 assert.equal((await handler(request('workspace&payment='+orderId+'&paid=true'))).status,402);
 const payment={order_id:orderId,transaction_id:'real-provider-fixture',status_code:200,confirm_rcv_amnt:'49.00',confirm_rcv_amnt_curr:'USD'};
 assert.equal((await handler(request('billing/notify',payment,true))).status,401);assert.equal(state.until,null);
 const signature=createHmac('sha256','secret-fixture').update(signedQuery(payment)).digest('hex');
 response=await handler(new Request('https://site.invalid/api?route=billing/notify',{method:'POST',headers:{'content-type':'application/json',authorization:'Bearer '+Buffer.from('payer-fixture:'+signature).toString('base64')},body:JSON.stringify(payment)}));
 assert.equal(response.status,200);assert.equal((await(await handler(request('billing/access'))).json()).active,true);
 assert.equal((await handler(request('workspace'))).status,200);
 state.until=new Date(Date.now()-1).toISOString();assert.equal((await handler(request('workspace'))).status,402);
});

