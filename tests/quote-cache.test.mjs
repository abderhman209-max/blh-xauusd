import {test} from 'node:test';import assert from 'node:assert/strict';import {createQuoteCache} from '../lib/quote-cache.js';
test('quotes refresh after one second and concurrent readers share one provider request',async()=>{
 let now=10000,calls=0,finish;const quote=createQuoteCache(()=>{calls++;return new Promise(resolve=>finish=()=>resolve({price:4200+calls,receivedAt:now}));},{clock:()=>now});
 const a=quote(),b=quote();await Promise.resolve();assert.equal(calls,1);finish();assert.equal(await a,await b);
 now+=999;assert.equal((await quote()).price,4201);assert.equal(calls,1);
 now++;const next=quote();await Promise.resolve();assert.equal(calls,2);finish();assert.equal((await next).price,4202);
});
test('a failed quote keeps its original timestamp and backs off before retrying the provider',async()=>{
 let now=10000,calls=0,fail=false;const quote=createQuoteCache(async()=>{calls++;if(fail)throw Error('rate_limited');return{price:4200,receivedAt:now};},{clock:()=>now});
 assert.equal((await quote()).receivedAt,10000);now+=1000;fail=true;await assert.rejects(()=>quote(),/rate_limited/);
 now+=1000;await assert.rejects(()=>quote(),/price_feed_unavailable/);assert.equal(calls,2);
 now+=14000;fail=false;assert.equal((await quote()).receivedAt,26000);assert.equal(calls,3);
});
