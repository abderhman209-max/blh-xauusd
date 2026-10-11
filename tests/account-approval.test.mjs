import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/index.js';
import {accountApproval,APPROVAL_REQUIRED_FROM} from '../lib/account-approval.js';
import {fixtureToken} from './auth-fixture.mjs';
import {createApprovalProvider as provider} from './account-approval-fixture.mjs';
const originalFetch=globalThis.fetch;after(()=>globalThis.fetch=originalFetch);
process.env.SUPABASE_URL='https://approval-fixture.invalid';process.env.SUPABASE_PUBLISHABLE_KEY='fixture-public';process.env.SUPABASE_SECRET_KEY='fixture-secret';
const adminId='11111111-1111-4111-8111-111111111111',memberId='22222222-2222-4222-8222-222222222222';
const json=(v,status=200)=>new Response(JSON.stringify(v),{status});
const req=(route,id=memberId,data,options={})=>new Request('https://site.invalid/api?route='+route,{method:data===undefined?'GET':'POST',headers:{'content-type':'application/json',origin:options.origin||'https://site.invalid',cookie:options.cookie??'blh_access='+fixtureToken(id)},...(data===undefined?{}:{body:JSON.stringify(data)})});

test('only trusted metadata grants approval; cutoff preserves existing users and missing dates fail closed',()=>{
 assert.equal(accountApproval({created_at:'2026-10-05T00:00:00Z'}),'approved');
 for(const created_at of [APPROVAL_REQUIRED_FROM,'2026-10-12T00:00:00Z',undefined,'invalid'])assert.equal(accountApproval({created_at,user_metadata:{role:'super_admin',pipvoria_approval:{status:'approved'}}}),'pending');
 assert.equal(accountApproval({created_at:'2026-10-05T00:00:00Z',app_metadata:{pipvoria_approval:{status:'rejected'}}}),'rejected');
 assert.equal(accountApproval({app_metadata:{pipvoria_approval:{status:'unexpected'}}}),'pending');
 assert.equal(accountApproval({app_metadata:{role:'super_admin'}}),'approved');
});
test('signup queues a request even with issued tokens, and email confirmation never grants access',async()=>{
 const p=provider();for(const confirmation of [false,true]){p.state.confirmation=confirmation;const r=await handler(req('auth/sign-up',memberId,{name:'New member',email:'member@example.invalid',password:'Strong-Test12!'}));assert.equal(r.status,202);assert.deepEqual(await r.json(),{approvalRequired:true,confirmationRequired:confirmation});assert.equal(r.headers.getSetCookie().length,0);}
 assert.equal(p.claims.length,0);
});
test('pending/rejected identities cannot sign in, import, refresh or use private endpoints',async()=>{
 const p=provider();for(const status of ['pending','rejected']){
  p.users.get(memberId).app_metadata.pipvoria_approval={status};
  const cases=[['auth/sign-in',{email:'member@example.invalid',password:'Existing-Test12!'}],['auth/import-session',{accessToken:fixtureToken(memberId),refreshToken:'refresh-'+memberId}],['auth/session',undefined],['workspace',undefined],['settings',undefined],['gold',undefined],['profile/avatar',undefined],['admin/users',undefined],['support/tickets',undefined],['journal/create',{}]];
  for(const [route,data]of cases){const r=await handler(req(route,memberId,data));assert.equal(r.status,401,route);assert.equal((await r.json()).error,'account_'+status);assert.ok(r.headers.getSetCookie().every(c=>c.includes('Max-Age=0')));}
  const r=await handler(req('auth/session',memberId,undefined,{cookie:'blh_refresh=refresh-'+memberId}));assert.equal(r.status,401);assert.equal((await r.json()).error,'account_'+status);
 }
 assert.equal(p.claims.length,0);assert.equal(p.calls.filter(c=>c.url.includes('/rpc/')).length,0);
});
test('super admin sees requests and grants access only after accepting; metadata and review identity are preserved',async()=>{
 const p=provider();const listed=await handler(req('admin/users',adminId));assert.equal(listed.status,200);const data=await listed.json();assert.equal(data.users[0].approvalStatus,'pending');
 const r=await handler(req('admin/user-action',adminId,{userId:memberId,action:'approve',baseUpdatedAt:p.users.get(memberId).updated_at}));assert.equal(r.status,200);assert.equal((await r.json()).user.approvalStatus,'approved');
 const metadata=p.users.get(memberId).app_metadata;assert.equal(metadata.provider,'email');assert.equal(metadata.pipvoria_approval.reviewed_by,adminId);
 const audit=JSON.parse(p.calls.find(c=>c.url.endsWith('/admin_audit_logs')).init.body);assert.equal(audit.action,'unban');assert.equal(audit.details.operation,'approve');
 const login=await handler(req('auth/sign-in',memberId,{email:'member@example.invalid',password:'Existing-Test12!'}));assert.equal(login.status,200);assert.equal((await login.json()).user.id,memberId);assert.equal(p.claims.length,1);assert.ok(login.headers.getSetCookie().every(c=>c.includes('HttpOnly')));
 assert.equal((await handler(req('auth/session'))).status,200);
});
test('rejection persists, blocks the identity, and can be reconsidered explicitly',async()=>{
 const p=provider();let r=await handler(req('admin/user-action',adminId,{userId:memberId,action:'reject',baseUpdatedAt:p.users.get(memberId).updated_at}));assert.equal(r.status,200);assert.equal(p.users.get(memberId).app_metadata.pipvoria_approval.status,'rejected');
 assert.equal((await handler(req('auth/session'))).status,401);
 r=await handler(req('admin/user-action',adminId,{userId:memberId,action:'approve',baseUpdatedAt:p.users.get(memberId).updated_at}));assert.equal(r.status,200);
});
test('forged roles, cross-origin writes, stale decisions and protected admins never authorize a review',async()=>{
 const p=provider();p.users.get(memberId).created_at='2026-10-05T00:00:00Z';p.users.get(memberId).user_metadata={role:'super_admin'};
 let r=await handler(req('admin/user-action',memberId,{userId:memberId,action:'approve',baseUpdatedAt:p.users.get(memberId).updated_at}));assert.equal(r.status,403);
 r=await handler(req('admin/user-action',adminId,{userId:memberId,action:'approve',baseUpdatedAt:'stale'},{origin:'https://attacker.invalid'}));assert.equal(r.status,404);
 r=await handler(req('admin/user-action',adminId,{userId:adminId,action:'reject',baseUpdatedAt:p.users.get(adminId).updated_at}));assert.equal(r.status,409);
 p.users.get(memberId).created_at='2026-10-12T00:00:00Z';
 for(const baseUpdatedAt of [undefined,'stale']){r=await handler(req('admin/user-action',adminId,{userId:memberId,action:'approve',baseUpdatedAt}));assert.equal(r.status,409);}
 assert.equal(p.calls.filter(c=>c.init.method==='PUT').length,0);
});
test('an upstream failure leaves approval pending, and an already accepted account cannot be rejected as a request',async()=>{
 const p=provider(),payload={userId:memberId,action:'approve',baseUpdatedAt:p.users.get(memberId).updated_at};p.state.failUpdate=true;
 let r=await handler(req('admin/user-action',adminId,payload));assert.equal(r.status,503);assert.equal(accountApproval(p.users.get(memberId)),'pending');p.state.failUpdate=false;
 r=await handler(req('admin/user-action',adminId,payload));assert.equal(r.status,200);
 for(const action of ['approve','reject']){r=await handler(req('admin/user-action',adminId,{...payload,action,baseUpdatedAt:p.users.get(memberId).updated_at}));assert.equal(r.status,409);}
});
test('admin list includes requests after the provider first page',async()=>{
 const p=provider();p.state.pages=[Array.from({length:1000},(_,i)=>({...p.users.get(adminId),id:String(i)})),[p.users.get(memberId)]];
 const r=await handler(req('admin/users',adminId));assert.equal(r.status,200);const d=await r.json();assert.equal(d.users.length,1001);assert.equal(d.users[0].id,memberId);assert.equal(p.calls.filter(c=>c.url.includes('/admin/users?')).length,2);
});
