import {test} from 'node:test';
import assert from 'node:assert/strict';
import {AI_FRAMES,AI_MODEL,marketPacket,marketClosed,packetKey,inferAnalysis,validateModelAnalysis} from '../lib/ai-analysis.js';
// A fixed Wednesday: gold and EUR/USD are open whatever day the suite runs.
const now=Date.UTC(2026,9,28,12,0,30),open={closed:()=>false};
export function dataset(interval,at=now){
  const ms=AI_FRAMES[interval],end=Math.floor(at/ms)*ms;
  return {interval,source:'Fixture synthetic',bars:Array.from({length:100},(_,i)=>{
    const close=4200+i*.2+Math.sin(i/8);
    return {time:end-(100-i)*ms,open:close-.3,close,high:close+1.5,low:close-1.5,closed:true};
  })};
}
export function modelValue(packet,decision='buy'){
  const f={...packet.frames[0],atr:Number(packet.frames[0].atr.toFixed(2))},entry=Number(f.latestClose.toFixed(2));
  return {decision,summary:'Les périodes montrent une reprise à confirmer.',structure:'Clôtures en progression.',liquidity:'Les mèches testent les creux récents.',context:'Comparer la tendance horaire.',invalidation:'Le scénario est invalidé sous le creux.',
    scenario:decision==='wait'?null:{direction:decision,entry,stop:entry+(decision==='sell'?1:-1)*f.atr,tp1:entry+(decision==='sell'?-1:1)*f.atr,tp2:entry+(decision==='sell'?-1:1)*2*f.atr,tp3:entry+(decision==='sell'?-1:1)*3*f.atr,triggerLevel:entry,trigger:'Attendre une clôture de confirmation au niveau d’entrée.',exitRule:'Prises de profit aux trois objectifs ; sortie au stop si invalidé.'},evidenceTimes:[f.candles.at(-1)[0]]};
}

test('Bitcoin analysis uses two price decimals and the same independent risk and stale-data validation',()=>{
 const data=dataset('5min');for(const bar of data.bars)for(const key of ['open','high','low','close'])bar[key]*=25;
 const packet=marketPacket('BTC','5min',[data],now),value=modelValue(packet),result=validateModelAnalysis(value,packet,now);
 assert.equal(result.symbol,'BTC');assert.equal(result.status,'ready');assert.equal(result.plan.targets.length,3);assert.equal(result.plan.entry,Number(result.plan.entry.toFixed(2)));
 const bad=structuredClone(value);bad.scenario.stop=bad.scenario.entry+1;assert.throws(()=>validateModelAnalysis(bad,packet,now),/invalid_output/);
 assert.throws(()=>marketPacket('BTC','5min',[data],now+300000),/stale/);
});
test('market packets exclude open candles, reject stale/gapped data, and keep cache identities independent of request time',async()=>{
  const data=dataset('5min'),packet=marketPacket('XAU','5min',[data],now);
  data.bars.push({time:now,open:9999,high:10000,low:9998,close:9999,closed:false});
  assert.equal(marketPacket('XAU','5min',[data],now).frames[0].latestClose,packet.frames[0].latestClose);
  assert.equal(await packetKey(packet),await packetKey(marketPacket('XAU','5min',[data],now+1)));
  assert.throws(()=>marketPacket('XAU','5min',[dataset('5min')],now+300000),/stale/);
  const gap=dataset('5min');gap.bars.splice(-2,1);assert.throws(()=>marketPacket('XAU','5min',[gap],now),/history/);
  const bad=dataset('5min');bad.bars.at(-1).close=NaN;assert.throws(()=>marketPacket('XAU','5min',[bad],now),/market_data/);
});

test('default fetch preserves its runtime receiver and credentials reject internal whitespace before transmission',async()=>{
  const at=Date.now(),packet=marketPacket('XAU','5min',[dataset('5min',at)],at,open),original=globalThis.fetch;let calls=0;
  try{
    globalThis.fetch=async function(_url,init){assert.equal(this,globalThis);calls++;assert.equal(init.headers.authorization,'Bearer fixture-only');return new Response(JSON.stringify({status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(modelValue(packet,'wait'))}]}]}));};
    assert.equal((await inferAnalysis(packet,{key:'  fixture-only\n'})).status,'wait');
    await assert.rejects(()=>inferAnalysis(packet,{key:'fixture\ninvalid'}),/invalid_credential/);assert.equal(calls,1);
  }finally{globalThis.fetch=original;}
});
test('only referenced, bounded and correctly ordered model levels become a trade plan',()=>{
  const packet=marketPacket('XAU','5min',[dataset('5min')],now),value=modelValue(packet);
  const valid=validateModelAnalysis(value,packet,now);assert.equal(valid.status,'ready');assert.equal(valid.plan.rewardRisk,2);
  assert.equal(valid.plan.adjusted,false);
  for(const patch of [{entry:1},{stop:value.scenario.entry+2},{trigger:''},{exitRule:''},{direction:'sell'}]){
    assert.throws(()=>validateModelAnalysis({...value,scenario:{...value.scenario,...patch}},packet,now),/invalid_output/);
  }
  for(const patch of [{evidenceTimes:[1]},{summary:''},{scenario:null}])assert.throws(()=>validateModelAnalysis({...value,...patch},packet,now),/invalid_output/);
  const sell=validateModelAnalysis(modelValue(packet,'sell'),packet,now);assert.equal(sell.status,'ready');assert.ok(sell.plan.stop>sell.plan.entry&&sell.plan.targets[0]>sell.plan.targets[1]&&sell.plan.targets[1]>sell.plan.targets[2]);
  assert.equal(validateModelAnalysis(modelValue(packet,'wait'),packet,now).plan,null);
  assert.equal(validateModelAnalysis(value,packet,packet.validUntil).plan,null);
});

test('an unconfirmed scenario has all levels and exit rules without becoming an active signal',()=>{
  const packet=marketPacket('XAU','5min',[dataset('5min')],now),value={...modelValue(packet),decision:'wait'};
  const result=validateModelAnalysis(value,packet,now);assert.equal(result.status,'conditional');assert.equal(result.plan.conditional,true);
  assert.equal(result.plan.targets.length,3);assert.equal(result.plan.target,result.plan.targets[1]);assert.deepEqual(result.plan.rewardRisks,[1,2,3]);assert.ok(result.plan.trigger&&result.plan.exitRule);
  assert.equal(validateModelAnalysis(value,packet,packet.validUntil).plan,null);
  assert.throws(()=>validateModelAnalysis({...value,evidenceTimes:[]},packet,now),/invalid_output/);
});
test('the real model request is bounded, server authenticated and structured; refusals and incomplete replies never become plans',async()=>{
  const at=Date.now(),packet=marketPacket('XAU','5min',[dataset('5min',at)],at,open);
  let requests=0;
  const fetcher=async(url,init)=>{
    requests++;assert.equal(url,'https://api.openai.com/v1/responses');
    assert.equal(init.headers.authorization,'Bearer fixture-only');assert.equal(init.redirect,'manual');
    const body=JSON.parse(init.body);assert.equal(body.model,AI_MODEL);assert.equal(body.store,false);assert.equal(body.max_output_tokens,2500);
    assert.equal(body.text.format.strict,true);assert.equal(body.text.format.schema.additionalProperties,false);
    assert.ok(!body.input.includes('user_id'));assert.ok(!body.input.includes('fixture-only'));
    return new Response(JSON.stringify({status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(modelValue(packet,'wait'))}]}]}));
  };
  assert.equal((await inferAnalysis(packet,{key:'fixture-only',fetcher})).status,'wait');assert.equal(requests,1);
  let redirects=0;await assert.rejects(()=>inferAnalysis(packet,{key:'fixture-only',fetcher:async(_url,init)=>{redirects++;assert.equal(init.redirect,'manual');return new Response(null,{status:307,headers:{location:'https://untrusted.invalid'}});}}),/provider_unavailable/);assert.equal(redirects,1);
  for(const response of [{status:'incomplete'}, {status:'completed',output:[{type:'message',content:[{type:'refusal',refusal:'No'}]}]}]){
    await assert.rejects(()=>inferAnalysis(packet,{key:'fixture-only',fetcher:async()=>new Response(JSON.stringify(response))}),/incomplete|refused/);
  }
});

test('the server recomputes stop and targets the model got wrong instead of failing the analysis',()=>{
  const packet=marketPacket('XAU','5min',[dataset('5min')],now),value=modelValue(packet),atr=packet.frames[0].atr,entry=value.scenario.entry;
  for(const patch of [{tp1:entry-2},{tp2:value.scenario.tp1},{tp3:entry+20*atr},{stop:entry-.001},{stop:entry-30*atr},{tp1:entry+.1,tp2:entry+.1,tp3:entry+.1}]){
    const plan=validateModelAnalysis({...value,scenario:{...value.scenario,...patch}},packet,now).plan,risk=plan.entry-plan.stop,r=plan.targets.map(t=>(t-plan.entry)/risk);
    assert.equal(plan.adjusted,true);assert.equal(plan.entry,entry);
    assert.ok(risk>=atr*.3-.01&&risk<=atr*5+.01,'stop distance '+risk);
    assert.ok(r[0]>=1&&r[1]>=1.5&&r[2]>=2&&r[2]<=5.01&&r[0]<r[1]&&r[1]<r[2],'targets '+r);
    assert.deepEqual(plan.rewardRisks,r.map(n=>Number(n.toFixed(2))));
    for(const n of [plan.stop,...plan.targets])assert.equal(n,Number(n.toFixed(2)));
  }
  const sell=modelValue(packet,'sell');sell.scenario.tp3=sell.scenario.entry+5;
  const plan=validateModelAnalysis(sell,packet,now).plan;assert.ok(plan.stop>plan.entry&&plan.entry>plan.targets[0]&&plan.targets[0]>plan.targets[1]&&plan.targets[1]>plan.targets[2]);
  const eur=dataset('5min');for(const bar of eur.bars)for(const key of ['open','high','low','close'])bar[key]/=4000;
  const eurPacket=marketPacket('EUR','5min',[eur],now),eurValue=modelValue(eurPacket);
  const e={...eurValue.scenario,entry:Number(eurPacket.frames[0].latestClose.toFixed(5))};e.stop=e.entry-eurPacket.frames[0].atr;e.tp1=e.tp2=e.tp3=e.entry+eurPacket.frames[0].atr/10;
  const ep=validateModelAnalysis({...eurValue,scenario:e},eurPacket,now).plan;assert.ok(ep.rewardRisks[0]>=1&&ep.rewardRisks[2]>ep.rewardRisks[1]);
  for(const n of [ep.stop,...ep.targets])assert.equal(n,Number(n.toFixed(5)));
});

test('closed sessions and frozen feeds never reach the model',()=>{
  for(const at of [Date.UTC(2026,9,31,12),Date.UTC(2026,9,30,21,30),Date.UTC(2026,10,1,1,8),Date.UTC(2026,10,1,21,59)])assert.equal(marketClosed('XAU',at),true,new Date(at).toISOString());
  for(const at of [Date.UTC(2026,10,1,22),Date.UTC(2026,9,28,12),Date.UTC(2026,9,30,20,59)])assert.equal(marketClosed('EUR',at),false);
  assert.equal(marketClosed('BTC',Date.UTC(2026,9,31,12)),false);
  assert.throws(()=>marketPacket('XAU','5min',[dataset('5min',Date.UTC(2026,10,1,1,8,30))],Date.UTC(2026,10,1,1,8,30)),/market_closed/);
  // Sunday 2026-11-01 01:05 UTC: the provider kept emitting candles about 0.2 wide after a normal session.
  const flat=dataset('5min');flat.bars.slice(-12).forEach(b=>{b.open=b.close=3875.4;b.high=3875.5;b.low=3875.3;});
  assert.throws(()=>marketPacket('XAU','5min',[flat],now),/market_closed/);
  const h=dataset('1h');h.interval='1h';h.bars.slice(-12).forEach(b=>{b.open=b.close=3875.4;b.high=3875.5;b.low=3875.3;});
  assert.equal(marketPacket('XAU','5min',[dataset('5min'),h],now).frames.length,2);
});
test('a conditional scenario carries one close trigger and stays usable for twelve candles',()=>{
  const packet=marketPacket('XAU','5min',[dataset('5min')],now),value={...modelValue(packet),decision:'wait'},atr=packet.frames[0].atr;
  value.scenario={...value.scenario,triggerLevel:value.scenario.entry+atr/2};
  const plan=validateModelAnalysis(value,packet,now).plan;
  assert.equal(plan.triggerLevel,Number((value.scenario.entry+atr/2).toFixed(2)));assert.equal(plan.activeUntil,packet.asOf+12*AI_FRAMES['5min']);
  const firm=validateModelAnalysis(modelValue(packet),packet,now).plan;assert.equal(firm.triggerLevel,undefined);assert.equal(firm.activeUntil,undefined);
  for(const triggerLevel of [value.scenario.stop-1,packet.frames[0].latestClose+3*atr])
    assert.throws(()=>validateModelAnalysis({...value,scenario:{...value.scenario,triggerLevel}},packet,now),/invalid_output/);
});
test('Ethereum and Solana analyses trade every day and round to their own price precision',()=>{
  const saturday=Date.UTC(2026,9,31,12,0,30),eth=dataset('5min',saturday),sol=dataset('5min',saturday);
  for(const bar of sol.bars)for(const key of ['open','high','low','close'])bar[key]=Number((bar[key]/23).toFixed(3));
  assert.equal(marketPacket('ETH','5min',[eth],saturday).symbol,'ETH');
  const packet=marketPacket('SOL','5min',[sol],saturday),plan=validateModelAnalysis(modelValue(packet),packet,saturday).plan;
  for(const n of [plan.entry,plan.stop,...plan.targets])assert.equal(n,Number(n.toFixed(3)));
  assert.throws(()=>marketPacket('DOGE','5min',[eth],saturday),/invalid_analysis/);
});
