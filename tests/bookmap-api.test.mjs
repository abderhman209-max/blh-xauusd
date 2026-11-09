import {test,after} from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
import handler from '../api/index.js';
import {fixtureToken} from './auth-fixture.mjs';
import {createApprovalProvider} from './account-approval-fixture.mjs';
const originalFetch=globalThis.fetch;after(()=>globalThis.fetch=originalFetch);
process.env.SUPABASE_URL='https://bookmap-fixture.invalid';process.env.SUPABASE_PUBLISHABLE_KEY='fixture-public';process.env.SUPABASE_SECRET_KEY='fixture-secret';
const adminId='11111111-1111-4111-8111-111111111111',memberId='22222222-2222-4222-8222-222222222222';
const get=(route,id)=>new Request('https://site.invalid/api?route='+route,{headers:{cookie:'blh_access='+fixtureToken(id)}});
function withWorker(){
  createApprovalProvider();const provider=globalThis.fetch,calls=[];
  globalThis.fetch=async(url,init={})=>{if(String(url).startsWith('https://worker.invalid')){calls.push({url:String(url),secret:init.headers['x-bookmap-secret']});
    return new Response('data: {"t":1}\n\n',{status:200,headers:{'content-type':'text/event-stream'}});}return provider(url,init);};
  return calls;
}
test('the Bookmap feed is proxied only for the super admin, with the worker secret kept server-side',async()=>{
  delete process.env.BOOKMAP_URL;delete process.env.BOOKMAP_SECRET;withWorker();
  assert.equal((await handler(get('bookmap/stream&since=5',adminId))).status,503);
  process.env.BOOKMAP_URL='http://worker.invalid';process.env.BOOKMAP_SECRET='shared';
  assert.equal((await handler(get('bookmap/stream',adminId))).status,503,'plain http is refused');
  process.env.BOOKMAP_URL='https://worker.invalid';const calls=withWorker();
  assert.ok([401,403].includes((await handler(get('bookmap/stream',memberId))).status),'members never reach the feed');
  assert.equal((await handler(new Request('https://site.invalid/api?route=bookmap/stream'))).status,401);
  const ok=await handler(get('bookmap/stream&since=12.7',adminId));
  assert.equal(ok.status,200);assert.match(ok.headers.get('content-type'),/text\/event-stream/);assert.equal(await ok.text(),'data: {"t":1}\n\n');
  assert.deepEqual(calls,[{url:'https://worker.invalid/stream?since=12',secret:'shared'}]);
});
test('the client keeps frames in order, drops duplicates after a reconnect and caps its history',()=>{
  const ctx={Math,JSON,Number,Array};vm.createContext(ctx);ctx.globalThis=ctx;vm.runInContext(fs.readFileSync('public/bookmap.js','utf8'),ctx);
  const bm=ctx.PipvoriaBookmap,frame=t=>({t,bids:[[1,1]],asks:[[2,1]],trades:[]});
  bm.addFrame(frame(2));bm.addFrame(frame(1));bm.addFrame(frame(2));bm.addFrame({t:3,bids:'x'});bm.addFrame(frame(3));
  assert.equal(JSON.stringify(bm.state.frames.map(f=>f.t)),'[2,3]');
  for(let t=4;t<3000;t++)bm.addFrame(frame(t));assert.equal(bm.state.frames.length,2400);assert.equal(bm.state.frames.at(-1).t,2999);
  assert.match(bm.heat(0),/^rgb\(13,17,40\)$/);assert.match(bm.heat(5),/^rgb\(255,250,235\)$/);
});
