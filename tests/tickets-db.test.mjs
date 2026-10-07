import {test} from 'node:test';import assert from 'node:assert/strict';import {PGlite} from '@electric-sql/pglite';import fs from 'node:fs';
const sql=name=>fs.readFileSync(new URL('../supabase/'+name,import.meta.url),'utf8');
test('Postgres ticket migration preserves legacy history and enforces ownership, sessions, retry, status CAS and rate limits',async()=>{
  const db=new PGlite();try{
    await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
      create schema auth;grant usage on schema auth to authenticated,service_role;
      create table auth.users(id uuid primary key,raw_app_meta_data jsonb default '{}');
      create table auth.sessions(id uuid primary key,user_id uuid references auth.users(id),created_at timestamptz,updated_at timestamptz,not_after timestamptz);
      create function auth.jwt() returns jsonb language sql stable as $$select current_setting('request.jwt.claims',true)::jsonb$$;
      create function auth.uid() returns uuid language sql stable as $$select (auth.jwt()->>'sub')::uuid$$;
      grant execute on function auth.jwt(),auth.uid() to authenticated,service_role;`);
    await db.exec(sql('migrations/20261007012433_pipvoria_single_session_registry.sql'));await db.exec(sql('migrations/20261007121308_pipvoria_private_support_messaging.sql'));
    await db.exec(`insert into auth.users(id)values('11111111-1111-4111-8111-111111111111');insert into public.support_threads(user_id,user_name)values('11111111-1111-4111-8111-111111111111','Legacy member');
      insert into public.support_messages(id,user_id,sender_role,body,created_at)values(gen_random_uuid(),'11111111-1111-4111-8111-111111111111','customer','Preserved history','2026-01-01T12:00:00Z');`);
    await db.exec(sql('migrations/20261007145628_pipvoria_support_tickets.sql'));
    const preserved=await db.query(`select body,created_at from public.support_ticket_messages`);assert.equal(preserved.rows[0].body,'Preserved history');assert.equal(preserved.rows[0].created_at.toISOString(),'2026-01-01T12:00:00.000Z');
    const result=await db.exec(sql('tests/support_tickets.sql'));assert.equal(result.at(-1).rows[0].tickets_isolation_retries_status_legacy_and_rate_checks_passed,true);
    assert.equal((await db.query('select count(*)::int n from auth.users')).rows[0].n,1);
  }finally{await db.close()}
});
