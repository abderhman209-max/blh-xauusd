import {test} from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
import {cryptoHistory,createCryptoMarket,krakenHistory} from '../lib/crypto-market.js';import {marketPacket} from '../lib/ai-analysis.js';
const now=Math.floor(Date.now()/3600000)*3600000+30000;
const rows=(seconds,at=now)=>Array.from({length:300},(_,i)=>[Math.floor(at/seconds/1000)*seconds-i*seconds,99000,100500,100000,100100+i*.1,5]);
const json=value=>new Response(JSON.stringify(value));
test('crypto candles use one allowlisted request and produce fresh closed BTC packets on every timeframe',async()=>{
 for(const frame of ['1min','5min','15min','30min','1h']){let calls=0;
  const data=await cryptoHistory('BTC',frame,{now,fetcher:async raw=>{calls++;const url=new URL(raw);assert.equal(url.origin,'https://api.exchange.coinbase.com');assert.equal(url.pathname,'/products/BTC-USD/candles');return json(rows(Number(url.searchParams.get('granularity'))));}});
  const packet=marketPacket('BTC',frame,[data],now);assert.equal(calls,1);assert.ok(data.bars.length>=100);assert.ok(packet.frames[0].candles.length>=60);assert.ok(data.source.includes('Coinbase'));assert.ok(packet.asOf<=now);
 }
 let calls=0;for(const [symbol,interval] of [['URL','5min'],['BTC','1sec']])await assert.rejects(()=>cryptoHistory(symbol,interval,{fetcher:()=>calls++}),/invalid_market/);assert.equal(calls,0);
});
test('30 minute aggregation excludes incomplete closed buckets and never invents missing candles',async()=>{
 const data=await cryptoHistory('BTC','30min',{now,fetcher:async()=>json(rows(900).filter(r=>r[0]!==Math.floor(now/1800000)*1800-900))});
 assert.ok(!data.bars.some(b=>b.time===Math.floor(now/1800000)*1800000-1800000));assert.throws(()=>marketPacket('BTC','30min',[data],now),/stale|history/);
 await assert.rejects(()=>cryptoHistory('BTC','5min',{now,fetcher:async()=>json([[now/1000,-1,2,1,2,1]])}),/unavailable/);
});
test('shared crypto history deduplicates concurrent requests and refreshes at the next candle boundary',async()=>{
 let at=now,calls=0,finish;const provider=createCryptoMarket({clock:()=>at,fetcher:()=>{calls++;return new Promise(resolve=>finish=()=>resolve(json(rows(60,at))));}});
 const a=provider('BTC','1min'),b=provider('BTC','1min');assert.equal(calls,1);finish();assert.equal(await a,await b);await provider('BTC','1min');assert.equal(calls,1);
 at=now+29000;const c=provider('BTC','1min');finish();await c;assert.equal(calls,2);at=now+31000;const d=provider('BTC','1min');finish();await d;assert.equal(calls,3);
 let failures=0;const offline=createCryptoMarket({fetcher:async()=>{failures++;throw Error('offline');}});await assert.rejects(()=>offline('BTC','5min'),/offline/);await assert.rejects(()=>offline('BTC','5min'),/offline/);assert.equal(failures,4,'each attempt tries Coinbase then Kraken');
});
function liveFixture(){
 const sockets=[],timeouts=new Map(),intervals=new Map();let id=0;
 class Socket{readyState=0;constructor(url){assert.equal(url,'wss://ws-feed.exchange.coinbase.com');sockets.push(this);}send(text){this.sent=JSON.parse(text);}open(){this.readyState=1;this.onopen?.();}message(value){this.onmessage?.({data:JSON.stringify(value)});}close(){this.readyState=3;this.onclose?.();}}
 const context={Date,Map,Number,JSON,Math,WebSocket:Socket,setTimeout:(fn,ms)=>{const key=++id;timeouts.set(key,{fn,ms});return key;},clearTimeout:key=>timeouts.delete(key),setInterval:fn=>{const key=++id;intervals.set(key,fn);return key;},clearInterval:key=>intervals.delete(key)};vm.createContext(context);vm.runInContext(fs.readFileSync('public/live.js','utf8')+';globalThis.market=CoinbaseMarket;globalThis.buffers=CryptoLive;',context);return{...context,sockets,timeouts,intervals};
}
test('live crypto feeds subscribe to the selected product, filter stale ticks and reconnect without reviving stopped sockets',()=>{
 const f=liveFixture(),ticks=[],states=[];f.market.start(t=>ticks.push(t),'BTC-USD',s=>states.push(s));const first=f.sockets[0];first.open();assert.deepEqual(Array.from(first.sent.product_ids),['BTC-USD']);assert.ok(first.sent.channels.includes('heartbeat'));
 const event={type:'ticker',product_id:'BTC-USD',price:'100123.45',time:new Date().toISOString()};first.message(event);assert.equal(ticks.length,1);assert.equal(states.at(-1),'live');
 first.message({...event,product_id:'ETH-USD'});first.message({...event,price:'NaN'});first.message({...event,time:new Date(Date.now()-60000).toISOString()});assert.equal(ticks.length,1);
 first.close();assert.equal(states.at(-1),'reconnecting');const reconnect=[...f.timeouts.values()][0];assert.equal(reconnect.ms,1000);reconnect.fn();assert.equal(f.sockets.length,2);const next=f.sockets[1];next.open();first.message(event);assert.equal(ticks.length,1);
 f.market.start(t=>ticks.push(t),'ETH-USD');const eth=f.sockets.at(-1);eth.open();assert.deepEqual(Array.from(eth.sent.product_ids),['ETH-USD']);next.message(event);assert.equal(ticks.length,1);
 f.market.stop();eth.message({...event,product_id:'ETH-USD'});assert.equal(ticks.length,1);assert.equal(f.market.socket,null);assert.equal(f.intervals.size,0);
});
test('stream candles preserve provider volume and product boundaries and remain unconfirmed until REST reconciliation',()=>{
 const f=liveFixture(),btc=f.buffers.for('BTC-USD'),eth=f.buffers.for('ETH-USD'),time=Date.now(),bucket=Math.floor(time/300000)*300000;
 const base=[{time:bucket,open:100,high:103,low:99,close:102,volume:8,closed:false}];btc.add({price:105,time,receivedAt:time});let merged=btc.merge(base,'5min',0);assert.equal(merged.at(-1).close,105);assert.equal(merged.at(-1).volume,8);assert.equal(merged.at(-1).closed,false);
 merged=btc.merge(merged,'5min',0);assert.equal(merged.at(-1).volume,8);assert.equal(eth.last,null);assert.equal(btc.add({price:1,time:time-1000,receivedAt:time}),false);
});

test('Kraken serves closed candles when Coinbase refuses the server, and both calls identify the client',async()=>{
 const t=Math.floor(now/300000)*300000,seen=[];
 const kraken=Array.from({length:120},(_,i)=>{const time=(t-(119-i)*300000)/1000,o=78000+i;return [time,String(o),String(o+20),String(o-15),String(o+5),String(o+2),'1.5',42];});
 const fetcher=async(raw,init)=>{const url=new URL(raw);seen.push(url.hostname);assert.match(init.headers['user-agent'],/^Pipvoria/);
   if(url.hostname==='api.exchange.coinbase.com')return new Response('{"message":"Forbidden"}',{status:403});
   assert.equal(url.searchParams.get('pair'),'XBTUSD');assert.equal(url.searchParams.get('interval'),'5');
   return json({error:[],result:{XXBTZUSD:kraken,last:t/1000}});};
 const data=await cryptoHistory('BTC','5min',{now,fetcher});
 assert.deepEqual(seen,['api.exchange.coinbase.com','api.kraken.com']);assert.equal(data.source,'Kraken · BTC/USD');
 assert.equal(data.bars.length,120);assert.equal(data.bars.at(-1).closed,false);assert.equal(data.bars.at(-2).closed,true);
 assert.ok(marketPacket('BTC','5min',[{...data,interval:'5min'}],now).frames[0].candles.length>=60);
 await assert.rejects(()=>krakenHistory('SOL','1h',{now,fetcher:async()=>json({error:['EQuery:Unknown asset pair']})}),/unavailable/);
});
