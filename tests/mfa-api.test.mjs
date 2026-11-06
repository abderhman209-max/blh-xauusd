import {test,after} from 'node:test';import assert from 'node:assert/strict';
import handler from '../api/index.js';
const originalFetch=globalThis.fetch;after(()=>globalThis.fetch=originalFetch);
process.env.SUPABASE_URL='https://mfa-fixture.invalid';process.env.SUPABASE_PUBLISHABLE_KEY='fixture-public';process.env.SUPABASE_SECRET_KEY='fixture-secret';
const userId='33333333-3333-4333-8333-333333333333',sessionId='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',factorId='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const json=(v,status=200)=>new Response(JSON.stringify(v),{status});
const token=aal=>{const e=v=>Buffer.from(JSON.stringify(v)).toString('base64url');return e({alg:'HS256'})+'.'+e({sub:userId,session_id:sessionId,aal})+'.sig';};
function provider({factors=[{id:factorId,factor_type:'totp',status:'verified'}],google=false}={}){
  const user={id:userId,email:'mfa@example.invalid',created_at:'2026-10-01T00:00:00Z',app_metadata:{},user_metadata:{full_name:'Mfa'},factors};
  const calls=[];
  globalThis.fetch=async(url,init={})=>{url=String(url);calls.push({url,method:init.method||'GET',body:init.body?JSON.parse(init.body):null});
    if(url.endsWith('/auth/v1/user'))return json(user);
    if(url.includes('grant_type=password'))return json({user,access_token:token('aal1'),refresh_token:'r1',expires_in:3600});
    if(url.includes('grant_type=refresh_token'))return json({user,access_token:token(user.factors.some(f=>f.status==='verified')?'aal2':'aal1'),refresh_token:'r3',expires_in:3600});
    if(/\/factors\/[^/]+\/challenge$/.test(url))return json({id:'challenge-1'});
    if(/\/factors\/[^/]+\/verify$/.test(url)){if(JSON.parse(init.body).code!=='123456')return json({code:'mfa_verification_failed'},422);
      const f=user.factors.find(x=>url.includes(x.id));if(f)f.status='verified';return json({user,access_token:token('aal2'),refresh_token:'r2',expires_in:3600});}
    if(url.endsWith('/auth/v1/factors')&&init.method==='POST'){const f={id:'dddddddd-dddd-4ddd-8ddd-dddddddddddd',factor_type:'totp',status:'unverified'};user.factors.push(f);return json({id:f.id,totp:{qr_code:'data:image/svg+xml;utf-8,<svg/>',secret:'SECRET',uri:'otpauth://x'}});}
    if(/\/auth\/v1\/factors\/[^/]+$/.test(url)&&init.method==='DELETE'){user.factors=user.factors.filter(f=>!url.endsWith(f.id));return json({});}
    if(url.includes('/auth/v1/otp?'))return json({});
    if(url.endsWith('/auth/v1/settings'))return json({external:{google}});
    if(/rpc\/pipvoria_(session_active|claim_session)$/.test(url))return json(true);
    if(url.includes('/rest/v1/'))return json([]);
    assert.fail('Unexpected request '+url);};
  return {user,calls};
}
const post=(route,body,cookie)=>new Request('https://site.invalid/api?route='+route,{method:'POST',headers:{'content-type':'application/json',origin:'https://site.invalid',...(cookie?{cookie}:{})},body:JSON.stringify(body)});
const get=(route,cookie)=>new Request('https://site.invalid/api?route='+route,{headers:cookie?{cookie}:{}});
const accessCookie=res=>res.headers.getSetCookie().find(c=>c.startsWith('blh_access=')).split(';')[0];
test('a verified authenticator turns the password session into a pending one until the code is checked',async()=>{
  provider();
  const login=await handler(post('auth/sign-in',{email:'mfa@example.invalid',password:'Existing-Test12!'}));
  assert.equal(login.status,200);assert.deepEqual(await login.json(),{mfaRequired:true});
  const pending=accessCookie(login);
  const session=await handler(get('auth/session',pending));assert.equal(session.status,401);assert.equal((await session.json()).mfaRequired,true);
  assert.equal((await handler(get('workspace',pending))).status,401,'protected routes see no session');
  const wrong=await handler(post('auth/mfa-verify',{code:'000000'},pending));assert.equal(wrong.status,401);assert.equal((await wrong.json()).error,'invalid_code');
  assert.equal((await handler(post('auth/mfa-verify',{code:'12'},pending))).status,400);
  const ok=await handler(post('auth/mfa-verify',{code:'123456'},pending));assert.equal(ok.status,200);
  const user=(await ok.json()).user;assert.equal(user.mfaEnabled,true);
  const full=accessCookie(ok);assert.equal((await handler(get('auth/session',full))).status,200);
});
test('enrolment returns a QR code, activation needs a valid code and turning it off needs a fresh one',async()=>{
  const p=provider({factors:[{id:'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',factor_type:'totp',status:'unverified'}]});
  const cookie='blh_access='+token('aal1');
  const enroll=await handler(post('auth/mfa-enroll',{},cookie));assert.equal(enroll.status,200);
  const data=await enroll.json();assert.match(data.qrCode,/^data:image\/svg\+xml/);assert.equal(data.secret,'SECRET');
  assert.ok(p.calls.some(c=>c.method==='DELETE'&&c.url.endsWith('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee')),'abandoned factors are cleaned up');
  assert.equal((await handler(post('auth/mfa-activate',{factorId:data.factorId,code:'999999'},cookie))).status,401);
  const active=await handler(post('auth/mfa-activate',{factorId:data.factorId,code:'123456'},cookie));assert.equal(active.status,200);assert.equal((await active.json()).user.mfaEnabled,true);
  const strong='blh_access='+token('aal2');
  assert.equal((await handler(post('auth/mfa-enroll',{},strong))).status,409);
  assert.equal((await handler(post('auth/mfa-disable',{code:'111111'},strong))).status,401);
  const off=await handler(post('auth/mfa-disable',{code:'123456'},strong));assert.equal(off.status,200);assert.equal((await off.json()).user.mfaEnabled,false);
  assert.equal(p.user.factors.length,0);
});
test('magic links never create accounts or reveal them, and Google sign-in only exists once enabled',async()=>{
  const p=provider();
  const sent=await handler(post('auth/magic-link',{email:'Unknown@Example.invalid'}));assert.deepEqual(await sent.json(),{sent:true});
  const otp=p.calls.find(c=>c.url.includes('/otp?'));assert.deepEqual(otp.body,{email:'unknown@example.invalid',create_user:false});assert.match(otp.url,/redirect_to=https%3A%2F%2Fsite.invalid%2F/);
  assert.equal((await handler(post('auth/magic-link',{email:'nope'}))).status,400);
  assert.deepEqual(await(await handler(get('auth/providers'))).json(),{google:false});
  assert.equal((await handler(get('auth/google'))).status,404);
});
