import assert from 'node:assert/strict';
import {fixtureToken,sessionRpc} from './auth-fixture.mjs';
const adminId='11111111-1111-4111-8111-111111111111',memberId='22222222-2222-4222-8222-222222222222';
const json=(v,status=200)=>new Response(JSON.stringify(v),{status});
export function createApprovalProvider(){
 const users=new Map([[adminId,{id:adminId,email:'admin@example.invalid',created_at:'2026-10-12T00:00:00Z',updated_at:'2026-10-12T00:00:00Z',app_metadata:{role:'super_admin'},user_metadata:{}}],[memberId,{id:memberId,email:'member@example.invalid',created_at:'2026-10-12T00:00:00Z',updated_at:'2026-10-12T00:00:00Z',app_metadata:{provider:'email'},user_metadata:{full_name:'New member'}}]]);
 const calls=[],claims=[],state={confirmation:false,failUpdate:false,pages:null};
 const session=user=>({user,access_token:fixtureToken(user.id),refresh_token:'refresh-'+user.id,expires_in:3600});
 const tokenUser=token=>users.get(JSON.parse(Buffer.from(token.split('.')[1],'base64url').toString()).sub);
 globalThis.fetch=async(url,init={})=>{
  url=String(url);calls.push({url,init});const data=init.body?JSON.parse(init.body):{};
  if(url.endsWith('/auth/v1/user'))return json(tokenUser(new Headers(init.headers).get('authorization').slice(7)));
  if(url.includes('grant_type=password'))return json(session([...users.values()].find(u=>u.email===data.email)||users.get(memberId)));
  if(url.includes('grant_type=refresh_token'))return json(session(users.get(data.refresh_token.slice(8))));
  if(url.includes('/auth/v1/signup?'))return json(state.confirmation?{user:users.get(memberId)}:session(users.get(memberId)));
  if(url.includes('/auth/v1/logout?'))return new Response(null,{status:204});
  if(sessionRpc(url)){if(url.endsWith('claim_session'))claims.push(data.p_user_id);return json(true);}
  if(url.includes('/auth/v1/admin/users?')){
   assert.equal(new Headers(init.headers).get('authorization'),'Bearer fixture-secret');
   const page=Number(new URL(url).searchParams.get('page'));return json({users:state.pages?state.pages[page-1]||[]:[...users.values()]});
  }
  if(url.includes('/auth/v1/admin/users/')){
   assert.equal(new Headers(init.headers).get('authorization'),'Bearer fixture-secret');const id=url.split('/').at(-1),u=users.get(id);if(!u)return json({},404);
   if(init.method==='PUT'){if(state.failUpdate)return json({},503);assert.ok(data.app_metadata);Object.assign(u,{app_metadata:data.app_metadata,updated_at:'2026-10-12T01:00:00Z'});}
   return json(u);
  }
  if(url.includes('/rest/v1/'))return json([]);
  assert.fail('Unexpected provider request '+url);
 };
 return{users,calls,claims,state};
}
