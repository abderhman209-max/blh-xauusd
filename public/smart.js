// Web port of Signal Trade Planner Strategy by abderhman209.
const SmartEngine={analyze(bars,{atrLength=14,zone=1.5,rr=[.5,1,1.5],preferences={}}={}){
 const val=(id,fallback)=>{const n=Number(preferences[id.slice(1)]??document.querySelector(id)?.value);return Number.isFinite(n)?n:fallback},checked=(id,fallback=true)=>preferences[id.slice(1)]??document.querySelector(id)?.checked??fallback;
 const fastLength=val('#planner-fast',21),slowLength=val('#planner-slow',50),rsiLength=val('#planner-rsi-length',14),rsiThreshold=val('#planner-rsi-threshold',52),minSeparation=val('#planner-separation',.05),minBody=val('#planner-body',.10),cooldown=val('#planner-cooldown',3),swingLookback=val('#planner-swing',7),trailingMultiplier=val('#planner-trailing-atr',1.5);
 const mode=(preferences['planner-mode']??document.querySelector('#planner-mode')?.value)||'Hybrid',stopMode=(preferences['planner-stop-mode']??document.querySelector('#planner-stop-mode')?.value)||'ATR',directionMode=(preferences['planner-direction']??document.querySelector('#planner-direction')?.value)||'Both',priority=(preferences['planner-priority']??document.querySelector('#planner-priority')?.value)||'Stop first',trailing=checked('#planner-trailing',true);
 const result={sides:[],signals:[],fast:[],slow:[],stats:{signals:0,closed:0,wins:0,losses:0,breakeven:0,tp1:0,tp2:0,tp3:0,stops:0,netR:0},trades:[],active:null};if(!PIPVORIA_CORE.validTargets(rr))return {...result,error:'invalid_targets'};if(bars.length<slowLength+2)return result;
 const ema=(length,out)=>{const k=2/(length+1);let value=bars[0].close;for(let i=0;i<bars.length;i++){value=i?bars[i].close*k+value*(1-k):value;out[i]=value}};
 ema(fastLength,result.fast);ema(slowLength,result.slow);
 let atr=null,atrSum=0,avgGain=null,avgLoss=null,gainSum=0,lossSum=0;const atrs=[],rsis=[];
 for(let i=0;i<bars.length;i++){
  const b=bars[i],p=bars[i-1],tr=p?Math.max(b.high-b.low,Math.abs(b.high-p.close),Math.abs(b.low-p.close)):b.high-b.low;
  atrSum+=tr;if(i===atrLength-1)atr=atrSum/atrLength;else if(i>=atrLength)atr=(atr*(atrLength-1)+tr)/atrLength;atrs[i]=atr;
  if(i){const change=b.close-p.close,gain=Math.max(change,0),loss=Math.max(-change,0);if(i<=rsiLength){gainSum+=gain;lossSum+=loss;if(i===rsiLength){avgGain=gainSum/rsiLength;avgLoss=lossSum/rsiLength}}else{avgGain=(avgGain*(rsiLength-1)+gain)/rsiLength;avgLoss=(avgLoss*(rsiLength-1)+loss)/rsiLength}if(avgGain!==null)rsis[i]=avgLoss===0?100:100-100/(1+avgGain/avgLoss)}
 }
 let active=null,lastPlan=null,lastExit=-100;
 for(let i=slowLength+1;i<bars.length;i++){
  const b=bars[i],p=bars[i-1],a=atrs[i],rsi=rsis[i];if(!a||!Number.isFinite(rsi))continue;
  if(active&&i>active.index){
   const step=PIPVORIA_CORE.advanceTrade(active,b,{priority,trailing,atr:a,multiplier:trailingMultiplier});
   for(const event of step.events)result.stats[event]++;
   if(step.result){const trade={...active,...step.result,closedAt:b.time,direction:active.direction};result.trades.push(trade);result.stats.closed++;result.stats.netR+=step.result.resultR;result.stats[step.result.resultR>1e-9?'wins':step.result.resultR<-1e-9?'losses':'breakeven']++;if(step.result.reason==='stop')result.stats.stops++;active=null;lastExit=i;}
   else{active=step.position;active.plan.stop=active.stop;}
  }
  if(active||i-lastExit<=cooldown)continue;
  const crossLong=result.fast[i]>result.slow[i]&&result.fast[i-1]<=result.slow[i-1],crossShort=result.fast[i]<result.slow[i]&&result.fast[i-1]>=result.slow[i-1];
  const pullLong=result.fast[i]>result.slow[i]&&b.close>result.fast[i]&&p.close<=result.fast[i-1]&&rsi>rsiThreshold;
  const pullShort=result.fast[i]<result.slow[i]&&b.close<result.fast[i]&&p.close>=result.fast[i-1]&&rsi<100-rsiThreshold;
  const separation=Math.abs(result.fast[i]-result.slow[i])/a,body=Math.abs(b.close-b.open)/a;
  const qualityLong=separation>=minSeparation&&b.close>b.open&&body>=minBody,qualityShort=separation>=minSeparation&&b.close<b.open&&body>=minBody;
  const longSignal=(mode==='EMA crossover'?crossLong:mode==='Pullback continuation'?pullLong&&qualityLong:crossLong||pullLong&&qualityLong)&&directionMode!=='Short only';
  const shortSignal=(mode==='EMA crossover'?crossShort:mode==='Pullback continuation'?pullShort&&qualityShort:crossShort||pullShort&&qualityShort)&&directionMode!=='Long only';
  if(!longSignal&&!shortSignal)continue;const direction=longSignal?1:-1,entry=b.close,atrRisk=a*Math.max(.1,zone),recent=bars.slice(Math.max(0,i-swingLookback+1),i+1),swingStop=direction===1?Math.min(...recent.map(v=>v.low))-.01:Math.max(...recent.map(v=>v.high))+.01,selectedStop=stopMode==='Recent swing'?swingStop:entry-direction*atrRisk,risk=Math.max(Math.abs(entry-selectedStop),a*.1),stop=entry-direction*risk;
  const plan={direction,index:i,top:entry+a*.04,bottom:entry-a*.04,secondTop:entry+a*.04,secondBottom:entry-a*.04,entry,stop,tps:rr.map(v=>entry+direction*risk*v),trend:{a:{index:Math.max(0,i-20),price:result.slow[Math.max(0,i-20)]},b:{index:i+25,price:result.slow[i]}}};
  lastPlan=plan;active={...plan,initialStop:stop,initialRisk:risk,plan,reached:[false,false,false],tp1Reached:false,best:entry};result.signals.push({index:i,direction,price:direction===1?b.low:b.high,time:b.time});result.stats.signals++;
 }
 result.active=active;result.sides=lastPlan?[lastPlan]:[];return result;
}};
if(typeof module!=='undefined')module.exports=SmartEngine;
