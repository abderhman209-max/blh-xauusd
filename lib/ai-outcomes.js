// Replays closed candles after each AI plan to record what actually happened, without any model call.
// Model: a conditional plan with triggerLevel first needs one close beyond it (a stop touched before that cancels it);
// entry when a later candle trades through the entry price within ENTRY_BARS; one third of the position
// closes at each TP; the stop is fixed; when stop and a target share a candle the stop counts first.
export const OUTCOME_VERSION=1,ENTRY_BARS=12,MAX_BARS=200;
const FINAL=new Set(['closed','not_triggered','unknown']);
export function initialOutcome(result){
  if(!result?.plan)return null;
  return {v:OUTCOME_VERSION,state:'waiting',checkedThrough:result.asOf,reached:[false,false,false],enteredAt:null,bars:0,exit:null};
}
export function isFinal(outcome){return !!outcome&&FINAL.has(outcome.state);}
function exitR(plan,reached,price){
  const d=plan.direction==='buy'?1:-1,risk=(plan.entry-plan.stop)*d,thirds=reached.filter(Boolean).length;
  const banked=plan.targets.reduce((sum,t,i)=>reached[i]?sum+(t-plan.entry)*d/risk:sum,0);
  return Number(((banked+(3-thirds)*(price-plan.entry)*d/risk)/3).toFixed(2));
}
export function advanceOutcome(outcome,result,bars,ms,now=Date.now()){
  if(!outcome||isFinal(outcome))return outcome;
  const plan=result.plan,d=plan.direction==='buy'?1:-1,o={...outcome,reached:[...outcome.reached]};
  const closed=bars.filter(b=>b.closed!==false&&b.time+ms<=now);
  // The candle history must still reach back to where the last check stopped, or the gap cannot be verified.
  if(!closed.length||closed[0].time>o.checkedThrough){
    if(closed.length&&closed[0].time>o.checkedThrough)return {...o,state:'unknown'};
    return o;
  }
  for(const bar of closed){
    if(bar.time<o.checkedThrough)continue;
    o.checkedThrough=bar.time+ms;
    const stopHit=d>0?bar.low<=plan.stop:bar.high>=plan.stop;
    if(o.state==='waiting'){
      if(bar.time>=result.asOf+ENTRY_BARS*ms)return {...o,state:'not_triggered'};
      if(plan.conditional&&Number.isFinite(plan.triggerLevel)&&!o.activatedAt){
        if(stopHit)return {...o,state:'not_triggered'};
        if((bar.close-plan.triggerLevel)*d>0)o.activatedAt=bar.time;
        continue;
      }
      if(!(bar.low<=plan.entry&&bar.high>=plan.entry))continue;
      o.state='open';o.enteredAt=bar.time;
      // Order inside the entry candle is unknown: only a stop can close the trade on it.
      if(stopHit)return {...o,state:'closed',exit:{reason:'stop',time:bar.time,resultR:-1}};
      continue;
    }
    o.bars++;
    if(stopHit)return {...o,state:'closed',exit:{reason:'stop',time:bar.time,resultR:exitR(plan,o.reached,plan.stop)}};
    plan.targets.forEach((t,i)=>{if(d>0?bar.high>=t:bar.low<=t)o.reached[i]=true;});
    // Targets are progressive, so a farther one implies the nearer ones were crossed.
    for(let i=2;i>0;i--)if(o.reached[i])o.reached[i-1]=true;
    if(o.reached[2])return {...o,state:'closed',exit:{reason:'tp3',time:bar.time,resultR:exitR(plan,o.reached,plan.targets[2])}};
    if(o.bars>=MAX_BARS)return {...o,state:'closed',exit:{reason:'timeout',time:bar.time,resultR:exitR(plan,o.reached,bar.close)}};
  }
  return o;
}
function bucket(){return {plans:0,triggered:0,notTriggered:0,pending:0,unknown:0,closed:0,wins:0,losses:0,tp:[0,0,0],stops:0,totalR:0};}
function add(b,row){
  const o=row.outcome;b.plans++;
  if(!o||o.state==='waiting'){b.pending++;return;}
  if(o.state==='not_triggered'){b.notTriggered++;return;}
  if(o.state==='unknown'){b.unknown++;return;}
  b.triggered++;o.reached.forEach((hit,i)=>{if(hit)b.tp[i]++;});
  if(o.state==='open'){b.pending++;return;}
  b.closed++;b.totalR+=o.exit.resultR;
  if(o.exit.resultR>0)b.wins++;else b.losses++;
  if(o.exit.reason==='stop')b.stops++;
}
function finish(b){
  return {...b,totalR:Number(b.totalR.toFixed(2)),avgR:b.closed?Number((b.totalR/b.closed).toFixed(2)):null,
    winRate:b.closed?Math.round(b.wins/b.closed*100):null,tpRate:b.triggered?b.tp.map(n=>Math.round(n/b.triggered*100)):[null,null,null]};
}
export function summarizeOutcomes(rows){
  const all=bucket(),groups=new Map(),kinds={ready:bucket(),conditional:bucket()},adjusted=bucket();
  for(const row of rows){
    const r=row.result,key=r.symbol+'|'+r.interval;
    add(all,row);add(kinds[r.plan.conditional?'conditional':'ready'],row);if(r.plan.adjusted)add(adjusted,row);
    if(!groups.has(key))groups.set(key,{symbol:r.symbol,interval:r.interval,...bucket()});add(groups.get(key),row);
  }
  return {overall:finish(all),ready:finish(kinds.ready),conditional:finish(kinds.conditional),adjusted:finish(adjusted),
    markets:[...groups.values()].map(finish).sort((a,b)=>b.plans-a.plans),
    recent:rows.slice(0,20).map(({result:r,outcome:o})=>({generatedAt:r.generatedAt,symbol:r.symbol,interval:r.interval,direction:r.plan.direction,
      conditional:!!r.plan.conditional,adjusted:!!r.plan.adjusted,entry:r.plan.entry,state:o?.state||'waiting',reached:o?.reached||[false,false,false],
      reason:o?.exit?.reason||null,resultR:o?.exit?.resultR??null}))};
}
