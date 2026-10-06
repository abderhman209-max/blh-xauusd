import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const context=vm.createContext({});
vm.runInContext(fs.readFileSync(new URL('../public/indicator-performance.js',import.meta.url),'utf8'),context);
const P=context.PIPVORIA_INDICATOR_PERFORMANCE;
const bars=[{time:1,high:130,low:80},{time:2,high:105,low:95},{time:3,high:121,low:99}];
test('close entry ignores earlier wicks and exits at final target without partial payouts',()=>{
  const plan={index:0,direction:1,entry:100,stop:90,tps:[105,110,120]};
  const s=P.plansSummary([plan],bars);
  assert.equal(s.closed,1);assert.equal(s.wins,1);assert.equal(s.netR,2);assert.equal(s.excluded,0);
  assert.equal(P.plansSummary([plan],bars.slice(0,2)).active,1);
});
test('ambiguous final target and stop are excluded instead of inventing a win or loss',()=>{
  const s=P.plansSummary([{index:0,direction:1,entry:100,stop:90,target:120}],[bars[0],{time:2,high:125,low:85}]);
  assert.equal(s.closed,0);assert.equal(s.excluded,1);assert.equal(s.netR,0);assert.equal(s.winRate,null);
});
test('short plans resolve independently, count once, and retain unresolved positions',()=>{
  const a={index:0,direction:-1,entry:100,stop:110,target:80};
  const b={index:1,direction:1,entry:100,stop:90,target:130};
  const s=P.plansSummary([a,a,b],[{time:1,high:100,low:100},{time:2,high:105,low:95},{time:3,high:105,low:79}]);
  assert.equal(s.signals,2);assert.equal(s.closed,2);assert.equal(s.wins,1);assert.equal(s.losses,1);assert.equal(s.netR,1);
});
test('structure respects native outcomes and excludes replaced or unknown exits',()=>{
  const trade=status=>({index:0,end:1,entry:100,sl:90,tp:120,status});
  const s=P.structureSummary({setups:['TP touché','SL touché','SL et TP touchés · ordre inconnu','remplacé','active'].map(status=>({direction:1,trade:trade(status)}))},bars);
  assert.equal(s.closed,2);assert.equal(s.netR,1);assert.equal(s.active,1);assert.equal(s.excluded,2);
});
test('summary keeps planner breakeven and computes drawdown from exit order',()=>{
  const s=P.summary([{closedAt:4,resultR:1},{closedAt:1,resultR:2},{closedAt:2,resultR:-1},{closedAt:3,resultR:-2},{closedAt:5,resultR:0}]);
  assert.equal(s.closed,5);assert.equal(s.netR,0);assert.equal(s.breakeven,1);assert.equal(s.drawdown,3);assert.equal(s.winRate,40);
});
test('structure does not turn entry-candle wicks into a completed trade',()=>{
  const s=P.structureSummary({setups:[{direction:1,trade:{index:0,end:0,entry:100,sl:90,tp:120,status:'TP touché'}}]},bars);
  assert.equal(s.closed,0);assert.equal(s.excluded,1);assert.equal(s.netR,0);
});
test('each indicator has its own result, while off, missing data and BLH restrictions are explicit',()=>{
  const loaded=Array.from({length:41},(_,i)=>({time:i+1,high:101,low:99}));
  const value=P.build({bars:loaded,symbol:'XAU/USD',interval:'5min',enabled:{planner:true,pa:true,blh:true,structure:false},models:{planner:{signals:[{}],trades:[{resultR:3}],active:null},pa:{plans:[]},blh:{plans:[]}}});
  assert.equal(value.planner.netR,3);assert.equal(value.pa.netR,0);assert.equal(value.structure.status,'disabled');assert.equal(value.structure.netR,undefined);
  assert.equal(P.build({bars:loaded,symbol:'BTC/USD',interval:'5min',enabled:{blh:true}}).blh.status,'unsupported');
  assert.equal(P.build({bars:[],symbol:'XAU/USD',interval:'5min',enabled:{planner:true}}).planner.status,'unavailable');
});
