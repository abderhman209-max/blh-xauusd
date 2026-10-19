import {test} from 'node:test';
import assert from 'node:assert/strict';
import {AI_FRAMES,AI_MODEL,marketPacket,packetKey,inferAnalysis,validateModelAnalysis} from '../lib/ai-analysis.js';
const now=Math.floor(Date.now()/3600000)*3600000+30000;
export function dataset(interval,at=now){
  const ms=AI_FRAMES[interval],end=Math.floor(at/ms)*ms;
  return {interval,source:'Fixture synthetic',bars:Array.from({length:100},(_,i)=>{
    const close=4200+i*.2+Math.sin(i/8);
    return {time:end-(100-i)*ms,open:close-.3,close,high:close+1.5,low:close-1.5,closed:true};
  })};
}
export function modelValue(packet,decision='buy'){
  const f=packet.frames[0],entry=f.latestClose;
  return {decision,summary:'Les périodes montrent une reprise à confirmer.',structure:'Clôtures en progression.',liquidity:'Les mèches testent les creux récents.',context:'Comparer la tendance horaire.',invalidation:'Le scénario est invalidé sous le creux.',
    entry:decision==='wait'?null:entry,stop:decision==='wait'?null:entry-f.atr,target:decision==='wait'?null:entry+2*f.atr,evidenceTimes:[f.candles.at(-1)[0]]};
}
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
  const at=Date.now(),packet=marketPacket('XAU','5min',[dataset('5min',at)],at),original=globalThis.fetch;let calls=0;
  try{
    globalThis.fetch=async function(_url,init){assert.equal(this,globalThis);calls++;assert.equal(init.headers.authorization,'Bearer fixture-only');return new Response(JSON.stringify({status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(modelValue(packet,'wait'))}]}]}));};
    assert.equal((await inferAnalysis(packet,{key:'  fixture-only\n'})).status,'wait');
    await assert.rejects(()=>inferAnalysis(packet,{key:'fixture\ninvalid'}),/invalid_credential/);assert.equal(calls,1);
  }finally{globalThis.fetch=original;}
});
test('only referenced, bounded and correctly ordered model levels become a trade plan',()=>{
  const packet=marketPacket('XAU','5min',[dataset('5min')],now),value=modelValue(packet);
  const valid=validateModelAnalysis(value,packet,now);assert.equal(valid.status,'ready');assert.equal(valid.plan.rewardRisk,2);
  for(const patch of [{entry:1},{stop:value.entry+2},{target:value.entry-2},{evidenceTimes:[1]},{stop:value.entry-.001},{summary:''}]){
    assert.throws(()=>validateModelAnalysis({...value,...patch},packet,now),/invalid_output/);
  }
  assert.equal(validateModelAnalysis(modelValue(packet,'wait'),packet,now).plan,null);
  assert.equal(validateModelAnalysis(value,packet,packet.validUntil).plan,null);
});
test('the real model request is bounded, server authenticated and structured; refusals and incomplete replies never become plans',async()=>{
  const at=Date.now(),packet=marketPacket('XAU','5min',[dataset('5min',at)],at);
  let requests=0;
  const fetcher=async(url,init)=>{
    requests++;assert.equal(url,'https://api.openai.com/v1/responses');
    assert.equal(init.headers.authorization,'Bearer fixture-only');assert.equal(init.redirect,'error');
    const body=JSON.parse(init.body);assert.equal(body.model,AI_MODEL);assert.equal(body.store,false);assert.equal(body.max_output_tokens,2500);
    assert.equal(body.text.format.strict,true);assert.equal(body.text.format.schema.additionalProperties,false);
    assert.ok(!body.input.includes('user_id'));assert.ok(!body.input.includes('fixture-only'));
    return new Response(JSON.stringify({status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(modelValue(packet,'wait'))}]}]}));
  };
  assert.equal((await inferAnalysis(packet,{key:'fixture-only',fetcher})).status,'wait');assert.equal(requests,1);
  for(const response of [{status:'incomplete'}, {status:'completed',output:[{type:'message',content:[{type:'refusal',refusal:'No'}]}]}]){
    await assert.rejects(()=>inferAnalysis(packet,{key:'fixture-only',fetcher:async()=>new Response(JSON.stringify(response))}),/incomplete|refused/);
  }
});
