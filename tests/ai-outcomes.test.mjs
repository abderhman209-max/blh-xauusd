import {test} from 'node:test';import assert from 'node:assert/strict';
import {initialOutcome,advanceOutcome,isFinal,summarizeOutcomes,ENTRY_BARS} from '../lib/ai-outcomes.js';
const ms=300000,asOf=1_800_000_000_000;
const plan=(direction='buy',extra={})=>direction==='buy'?{direction,entry:100,stop:90,targets:[110,120,130],...extra}:{direction,entry:100,stop:110,targets:[90,80,70],...extra};
const result=(p=plan(),symbol='XAU',interval='5min')=>({symbol,interval,asOf,generatedAt:asOf+1000,plan:p});
// History starts before the plan, like a real provider window.
const bars=list=>[{time:asOf-ms,open:100,high:101,low:99,close:100},...list.map(([high,low,close=(high+low)/2],i)=>({time:asOf+i*ms,open:close,high,low,close}))];
const run=(r,list,now=asOf+1e9)=>advanceOutcome(initialOutcome(r),r,bars(list),ms,now);

test('entry, three thirds at TP1-TP3 and a final TP3 exit give the average R of the targets',()=>{
  const o=run(result(),[[101,99],[112,101],[125,111],[131,120]]);
  assert.equal(o.state,'closed');assert.equal(o.exit.reason,'tp3');assert.deepEqual(o.reached,[true,true,true]);assert.equal(o.exit.resultR,2);
});
test('a stop after TP1 keeps the banked third; a stop before any TP is -1R',()=>{
  assert.equal(run(result(),[[101,99],[111,101],[105,89]]).exit.resultR,Number(((1-1-1)/3).toFixed(2)));
  assert.equal(run(result(),[[101,99],[100,89]]).exit.resultR,-1);
  const sell=run(result(plan('sell')),[[101,99],[100,89],[101,79],[101,69]]);assert.equal(sell.exit.reason,'tp3');assert.equal(sell.exit.resultR,2);
});
test('stop and target in one candle counts the stop first, also on the entry candle',()=>{
  const same=run(result(),[[101,99],[131,89]]);assert.equal(same.exit.reason,'stop');assert.equal(same.exit.resultR,-1);assert.deepEqual(same.reached,[false,false,false]);
  const entry=run(result(),[[131,89]]);assert.equal(entry.exit.resultR,-1);
});
test('an untouched entry expires, open candles are ignored and missing history is reported',()=>{
  const away=Array.from({length:ENTRY_BARS+1},()=>[99,95]);assert.equal(run(result(),away).state,'not_triggered');
  const open=run(result(),[[101,99]],asOf+ms-1);assert.equal(open.state,'waiting');assert.equal(isFinal(open),false);
  const r=result(),gap=advanceOutcome(initialOutcome(r),r,[{time:asOf+5*ms,open:100,high:101,low:99,close:100}],ms,asOf+1e9);assert.equal(gap.state,'unknown');
  assert.equal(initialOutcome({...r,plan:null}),null);
});
test('progress resumes from the last checked candle without double counting',()=>{
  const r=result(),first=advanceOutcome(initialOutcome(r),r,bars([[101,99],[111,101]]),ms,asOf+2*ms);
  assert.equal(first.state,'open');assert.deepEqual(first.reached,[true,false,false]);
  const again=advanceOutcome(first,r,bars([[101,99],[111,101]]),ms,asOf+2*ms);assert.deepEqual(again,first);
  const done=advanceOutcome(first,r,bars([[101,99],[111,101],[131,112]]),ms,asOf+1e9);assert.equal(done.exit.reason,'tp3');assert.equal(done.bars,2);
});
test('summaries split markets and plan types and leave pending plans out of the win rate',()=>{
  const win={result:result(),outcome:run(result(),[[101,99],[131,101]])};
  const loss={result:result(plan('buy',{conditional:true,adjusted:true}),'BTC'),outcome:run(result(),[[101,99],[100,89]])};
  const pending={result:result(),outcome:null},skipped={result:result(),outcome:run(result(),Array.from({length:ENTRY_BARS+1},()=>[99,95]))};
  const s=summarizeOutcomes([win,loss,pending,skipped]);
  assert.equal(s.overall.plans,4);assert.equal(s.overall.closed,2);assert.equal(s.overall.winRate,50);assert.equal(s.overall.pending,1);assert.equal(s.overall.notTriggered,1);
  assert.equal(s.overall.totalR,1);assert.equal(s.overall.avgR,.5);assert.deepEqual(s.overall.tpRate,[50,50,50]);
  assert.equal(s.conditional.plans,1);assert.equal(s.adjusted.losses,1);assert.equal(s.markets[0].symbol,'XAU');assert.equal(s.markets.find(m=>m.symbol==='BTC').avgR,-1);
  assert.equal(s.recent.length,4);assert.equal(s.recent[0].state,'closed');assert.equal(s.recent[2].state,'waiting');
});
test('a conditional plan with a trigger enters only after a close beyond it and is cancelled by an earlier stop',()=>{
  const p=plan('buy',{conditional:true,triggerLevel:102}),r=result(p);
  const touchedOnly=run(r,[[103,99,101],[101,99,100]]);assert.equal(touchedOnly.state,'waiting');
  const activated=run(r,[[103,99,102.5],[101,99],[131,101]]);assert.equal(activated.state,'closed');assert.equal(activated.exit.reason,'tp3');assert.equal(activated.activatedAt,asOf);
  assert.equal(run(r,[[101,89,95]]).state,'not_triggered');
  assert.equal(run(result(plan('buy',{conditional:true})),[[101,99],[131,101]]).exit.reason,'tp3');
});
