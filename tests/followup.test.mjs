import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import '../public/core.js';
const C=globalThis.PIPVORIA_CORE;
function engines(){const ctx={document:{querySelector:()=>null}};vm.createContext(ctx);for(const name of ['core','smart','blh-clean'])vm.runInContext(fs.readFileSync('public/'+name+'.js','utf8')+(name==='smart'?';globalThis.SmartEngine=SmartEngine;':name==='blh-clean'?';globalThis.BlhClean=BlhClean;':''),ctx);return ctx;}
test('both engines refuse reversed, equal, negative and missing targets',()=>{
 const e=engines();for(const rr of [[3,2,1],[1,1,2],[-1,2,3],[1,2],['',2,3]]){
 assert.equal(e.SmartEngine.analyze([],{rr}).error,'invalid_targets');
 assert.equal(e.BlhClean.analyze([],{rr}).error,'invalid_targets');
 assert.throws(()=>C.advanceTrade({direction:1,entry:100,stop:90,tps:rr.map(v=>100+10*v)},{high:111,low:99}),RangeError);
 }assert.equal(C.validTargets([.5,1,1.5]),true);
});
test('invalid legacy targets are repaired in settings, profiles and presets; imports can be rejected',()=>{
 const bad={'smart-tp1':'3','smart-tp2':'2','smart-tp3':'1'};
 const value={indicators:bad,marketProfiles:{'XAU/USD|5min':bad},presets:[{name:'bad',indicators:bad}]};
 assert.equal(C.settingsTargetsValid(value),false);
 const clean=C.settings(value);assert.equal(C.settingsTargetsValid(clean),true);
 assert.deepEqual([1,2,3].map(i=>clean.indicators['smart-tp'+i]),['0.5','1','1.5']);
});
test('field rebase preserves nested changes, removals and other devices',()=>{
 const base={timezone:'UTC',marketProfiles:{'XAU/USD|5min':{'planner-fast':'21','show-smart':true}},presets:[{name:'old'}]};
 const local={...base,marketProfiles:{'XAU/USD|5min':{'planner-fast':'30'}},presets:[]};
 const remote={...base,timezone:'Asia/Riyadh',marketProfiles:{...base.marketProfiles,'XAU/USD|15min':{'planner-fast':'50'}}};
 const merged=C.mergeSettings(remote,C.settingsDiff(base,local));
 assert.equal(merged.timezone,'Asia/Riyadh');assert.equal(merged.marketProfiles['XAU/USD|5min']['planner-fast'],'30');assert.equal(merged.marketProfiles['XAU/USD|5min']['show-smart'],undefined);assert.ok(merged.marketProfiles['XAU/USD|15min']);assert.deepEqual(merged.presets,[]);
});
test('concurrent first edits of a market profile preserve independent fields',()=>{
 const base={indicators:{'planner-fast':'21','show-smart':true},marketProfiles:{}};
 const local={...base,indicators:{...base.indicators,'planner-fast':'30'},marketProfiles:{'XAU/USD|5min':{...base.indicators,'planner-fast':'30'}}};
 const remote={...base,indicators:{...base.indicators,'show-smart':false},marketProfiles:{'XAU/USD|5min':{...base.indicators,'show-smart':false}}};
 const merged=C.mergeSettings(remote,C.settingsDiff(base,local));
 assert.equal(merged.marketProfiles['XAU/USD|5min']['planner-fast'],'30');assert.equal(merged.marketProfiles['XAU/USD|5min']['show-smart'],false);
});
test('watcher passes actual engine closures between polls instead of cancellation',()=>{
 const e=engines(),now=Date.now();let seed=4,price=4300;
 const random=()=>((seed=(1664525*seed+1013904223)>>>0)/4294967296);
 const bars=Array.from({length:400},(_,i)=>{const open=price;price+=(random()-.5)*12;return{time:now-(400-i)*300000,open,close:price,high:Math.max(open,price)+random()*5,low:Math.min(open,price)-random()*5}});
 const a=e.SmartEngine.analyze(bars.slice(0,169)),b=e.SmartEngine.analyze(bars.slice(0,170));
 assert.ok(a.active);assert.equal(b.active,null);assert.equal(b.trades.at(-1).reason,'stop');
 const options={symbol:'XAU/USD',interval:'5min',source:'synthetic',receivedAt:now};
 const before=C.watchSnapshot({...options,bars:bars.slice(0,169),model:a}),after=C.watchSnapshot({...options,bars:bars.slice(0,170),model:b});
 const tracker=C.tracker();tracker.update({...before,bar:null,price:a.active.entry},{now});
 const events=tracker.update(after,{now}).map(e=>e.event);assert.ok(events.includes('stop'));assert.ok(!events.includes('cancel'));assert.equal(tracker.update(after,{now}).length,0);
});
test('watcher closes TP3 before a new plan and sends intermediate target hits once',()=>{
 const now=Date.now(),bars=[{time:now-600000,closed:true,close:100},{time:now-300000,closed:true,close:140,high:140,low:101}];
 const p={index:0,direction:1,entry:100,stop:90,tps:[110,120,130]};
 const options={symbol:'XAU/USD',interval:'5min',bars,receivedAt:now};
 const tracker=C.tracker(),initial=C.watchSnapshot({...options,model:{active:p,sides:[p],trades:[]}});
 tracker.update({...initial,price:100,bar:null},{now});
 const next={index:1,direction:-1,entry:140,stop:150,tps:[130,120,110]};
 const snapshot=C.watchSnapshot({...options,model:{active:next,sides:[next],trades:[{...p,reason:'tp3',reached:[true,true,true],closedAt:bars[1].time}]}});
 const events=tracker.update({...snapshot,bar:null},{now}).map(e=>e.event);
 assert.deepEqual(events,['tp1','tp2','tp3','new','entry']);assert.equal(tracker.update({...snapshot,bar:null},{now}).length,0);
});
test('BLH surveillance carries TP/SL outcome and keeps an unclosed older plan',()=>{
 const now=Date.now(),p={index:0,direction:-1,entry:100,stop:110,tps:[90,80,70]},options={symbol:'XAU/USD',interval:'5min',receivedAt:now,model:{active:null,sides:[],trades:[]},blh:{plan:p}};
 const bars=Array.from({length:5},(_,i)=>({time:now-(5-i)*300000,closed:true,close:100,high:101,low:99}));
 assert.equal(C.watchSnapshot({...options,bars}).signal.status,'active');
 const tracker=C.tracker();tracker.update({...C.watchSnapshot({...options,bars}),bar:null},{now});
 bars.push({time:now-100000,close:112,high:112,low:100,closed:true});
 const result=C.watchSnapshot({...options,bars});assert.equal(result.signal,null);
 assert.deepEqual(tracker.update(result,{now}).map(e=>e.event),['stop']);
});
test('BLH exit before a replacement is reported for the previously watched plan',()=>{
 const now=Date.now(),bars=[{time:now-900000,closed:true,close:100,high:101,low:99},{time:now-600000,closed:true,close:111,high:112,low:100},{time:now-300000,closed:true,close:111,high:113,low:110}];
 const previousSignal={engine:'blh',direction:'sell',time:bars[0].time,entry:100,stopLoss:110,takeProfits:[90,80,70]};
 const result=C.watchSnapshot({symbol:'XAU/USD',interval:'5min',bars,receivedAt:now,previousSignal,model:{active:null,sides:[],trades:[]},blh:{plan:{index:2,direction:1,entry:111,stop:105,tps:[117,123,129]}}});
 assert.equal(result.transitions[0].key,['XAU/USD','5min','blh',bars[0].time,-1].join('|'));
 assert.equal(result.transitions[0].exitReason,'stop');assert.equal(result.signal.direction,'buy');
});
test('stop updates are coalesced to the latest value and discarded after closure or reset',()=>{
 let time=0,callback=null,cleared=0;const sent=[];
 const gate=C.alertGate(300000,{now:()=>time,schedule:fn=>(callback=fn,1),clear:()=>{cleared++;callback=null}});
 const update=price=>({key:'a',event:'update-'+price,stopLoss:price});
 gate.submit(update(91),d=>sent.push(d.stopLoss));time=1000;gate.submit(update(92),d=>sent.push(d.stopLoss));gate.submit(update(93),d=>sent.push(d.stopLoss));
 assert.deepEqual(sent,[91]);time=300000;callback();assert.deepEqual(sent,[91,93]);
 time++;gate.submit(update(94),d=>sent.push(d.stopLoss));gate.cancel('a');assert.equal(cleared,1);assert.equal(callback,null);
 gate.submit({...update(95),key:'b'},d=>sent.push(d.stopLoss));time++;gate.submit({...update(96),key:'b'},d=>sent.push(d.stopLoss));gate.reset();assert.equal(cleared,2);
});
