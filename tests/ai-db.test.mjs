import {test} from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {PGlite} from '@electric-sql/pglite';
test('AI cache reserves once, enforces persistent user/global limits and denies browser roles',async()=>{
 const db=new PGlite();try{
  await db.exec('create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key);');
  await db.exec(fs.readFileSync(new URL('../supabase/migrations/20261019210000_pipvoria_ai_analysis.sql',import.meta.url),'utf8'));
  await db.exec(fs.readFileSync(new URL('../supabase/migrations/20261101090000_pipvoria_ai_plan_outcomes.sql',import.meta.url),'utf8'));
  const user='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222';
  await db.query('insert into auth.users values ($1),($2)',[user,other]);
  await db.exec('set role service_role');
  const reserve=async(key,owner=user)=>(await db.query('select public.pipvoria_reserve_ai_analysis($1,$2,now()+interval \'1 hour\') result',[key,owner])).rows[0].result;
  const key='a'.repeat(64),calls=await Promise.all([reserve(key),reserve(key)]);
  assert.deepEqual(calls.map(r=>r.status).sort(),['reserved','running']);
  const claim=calls.find(r=>r.status==='reserved').claimId;
  await db.query("update public.ai_analysis_cache set status='completed',result=$1 where claim_id=$2",[JSON.stringify({status:'wait'}),claim]);
  assert.equal((await reserve(key,other)).status,'cached');
  for(let i=1;i<20;i++)assert.equal((await reserve(i.toString(16).padStart(64,'0'))).status,'reserved');
  assert.equal((await reserve('b'.repeat(64))).status,'limited');
  await db.exec('reset role');
  await db.query("insert into public.ai_analysis_cache(cache_key,user_id,status,expires_at) select lpad(to_hex(i),64,'c'),$1,'failed',now()+interval '1 hour' from generate_series(1,80) i",[other]);
  await db.exec('set role service_role');assert.equal((await reserve('d'.repeat(64),other)).status,'limited');
  for(const role of ['anon','authenticated']){
    await db.exec('reset role;set role '+role);
    await assert.rejects(()=>db.query('select * from public.ai_analysis_cache'));
    await assert.rejects(()=>reserve('e'.repeat(64)));
  }
 }finally{await db.close();}
});
test('plan outcomes are stored on completed rows, validated and kept server-only',async()=>{
 const db=new PGlite();try{
  await db.exec('create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key);');
  for(const name of ['20261019210000_pipvoria_ai_analysis','20261101090000_pipvoria_ai_plan_outcomes'])await db.exec(fs.readFileSync(new URL('../supabase/migrations/'+name+'.sql',import.meta.url),'utf8'));
  await db.exec('set role service_role');
  await db.query("insert into public.ai_analysis_cache(cache_key,status,expires_at,result,outcome) values ($1,'completed',now()+interval '1 hour','{}',$2)",['f'.repeat(64),JSON.stringify({state:'waiting'})]);
  await db.query("update public.ai_analysis_cache set outcome=$1 where cache_key=$2",[JSON.stringify({state:'closed',exit:{resultR:2}}),'f'.repeat(64)]);
  assert.equal((await db.query("select outcome->>'state' s from public.ai_analysis_cache")).rows[0].s,'closed');
  await assert.rejects(()=>db.query("update public.ai_analysis_cache set outcome='{\"state\":\"won\"}'"));
  for(const role of ['anon','authenticated']){await db.exec('reset role;set role '+role);await assert.rejects(()=>db.query('select outcome from public.ai_analysis_cache'));}
 }finally{await db.close();}
});
test('push subscriptions and Vault secrets stay server-only',async()=>{
 const db=new PGlite();try{
  await db.exec('create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key);create schema vault;create table vault.decrypted_secrets(name text,decrypted_secret text);grant usage on schema vault to service_role;');
  await db.exec(fs.readFileSync(new URL('../supabase/migrations/20261101120000_pipvoria_push_subscriptions.sql',import.meta.url),'utf8'));
  const user='11111111-1111-4111-8111-111111111111';await db.query('insert into auth.users values ($1)',[user]);
  await db.query("insert into vault.decrypted_secrets values ('pipvoria_vapid_public','pub'),('pipvoria_vapid_private','priv'),('pipvoria_tick_secret','tick')");
  await db.exec('set role service_role');
  assert.deepEqual((await db.query('select public.pipvoria_push_secrets() s')).rows[0].s,{vapidPublic:'pub',vapidPrivate:'priv',tick:'tick'});
  const row=['https://fcm.googleapis.com/fcm/send/a',user,'B'+'A'.repeat(86),'A'.repeat(22)];
  await db.query('insert into public.push_subscriptions(endpoint,user_id,p256dh,auth) values ($1,$2,$3,$4)',row);
  await assert.rejects(()=>db.query('insert into public.push_subscriptions(endpoint,user_id,p256dh,auth) values ($1,$2,$3,$4)',['http://x',user,row[2],row[3]]));
  for(const role of ['anon','authenticated']){await db.exec('reset role;set role '+role);
    await assert.rejects(()=>db.query('select * from public.push_subscriptions'));await assert.rejects(()=>db.query('select public.pipvoria_push_secrets()'));}
 }finally{await db.close();}
});
