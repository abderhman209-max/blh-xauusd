import {test} from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {PGlite} from '@electric-sql/pglite';
test('billing grants exactly once, extends renewals, rejects underpayment/reused transactions and denies client writes',async()=>{
 const db=new PGlite();try{
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key);`);
 await db.exec(fs.readFileSync(new URL('../supabase/migrations/20261016175425_pipvoria_crypto_billing.sql',import.meta.url),'utf8'));
 const user='11111111-1111-4111-8111-111111111111',a='22222222-2222-4222-8222-222222222222',b='33333333-3333-4333-8333-333333333333';
 await db.query('insert into auth.users values ($1)',[user]);
 for(const id of [a,b])await db.query("insert into public.payment_orders(id,user_id,amount_minor,currency,duration_days) values($1,$2,4900,'USD',30)",[id,user]);
 const confirm=async(id,tx,amount=4900,currency='USD')=>(await db.query('select public.pipvoria_confirm_payment($1,$2,$3,$4) result',[id,tx,amount,currency])).rows[0].result;
 await db.exec('set role service_role');assert.equal((await confirm(a,'one',4899)).confirmed,false);assert.equal((await confirm(a,'one',4900,'EUR')).confirmed,false);
 assert.equal((await confirm(a,'one')).confirmed,true);const first=(await db.query('select paid_until from public.payment_subscriptions')).rows[0].paid_until;
 assert.equal((await confirm(a,'one')).confirmed,true);assert.equal((await db.query('select paid_until from public.payment_subscriptions')).rows[0].paid_until.getTime(),first.getTime());
 assert.equal((await confirm(a,'different')).confirmed,false);
 await assert.rejects(()=>confirm(b,'one'));assert.equal((await db.query('select status from public.payment_orders where id=$1',[b])).rows[0].status,'creating');
 assert.equal((await confirm(b,'two')).confirmed,true);const renewed=(await db.query('select paid_until from public.payment_subscriptions')).rows[0].paid_until;assert.equal(renewed-first,30*86400000);
 for(const role of ['anon','authenticated']){await db.exec('reset role;set role '+role);await assert.rejects(()=>db.query('select * from public.payment_orders'));await assert.rejects(()=>db.query('select * from public.payment_subscriptions'));await assert.rejects(()=>confirm(a,'one'));}
 }finally{await db.close();}
});
