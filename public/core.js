/* Shared, deterministic workspace rules. No network, storage or DOM access. */
(function (root) {
  'use strict';
  const intervals = Object.freeze({'1min':60000,'5min':300000,'15min':900000,'30min':1800000,'1h':3600000});
  const closedStatuses = ['win','loss','breakeven'];
  const numeric = value => value !== null && value !== '' && value !== undefined && Number.isFinite(Number(value));
  const epoch = value => typeof value === 'number' ? value : Date.parse(value) || null;
  function risk(input) {
    const errors = {};
    const limits = {balance:[1,1e12],riskPercent:[.01,100],entry:[.00000001,1e9],stop:[.00000001,1e9],contract:[.00000001,1e9],lotStep:[.00000001,1e7]};
    for (const [key,[min,max]] of Object.entries(limits)) if (!numeric(input[key]) || Number(input[key]) < min || Number(input[key]) > max) errors[key] = 'bounds';
    if (numeric(input.entry) && numeric(input.stop) && Number(input.entry) === Number(input.stop)) errors.stop = 'same';
    if (Object.keys(errors).length) return {valid:false,errors};
    const balance=Number(input.balance),riskPercent=Number(input.riskPercent),distance=Math.abs(Number(input.entry)-Number(input.stop));
    const riskAmount=balance*riskPercent/100,rawSize=riskAmount/(distance*Number(input.contract));
    const positionSize=Math.floor((rawSize+Number.EPSILON)/Number(input.lotStep))*Number(input.lotStep);
    if (!Number.isFinite(positionSize) || positionSize <= 0) return {valid:false,errors:{lotStep:'tooSmall'}};
    return {valid:true,errors:{},balance,riskPercent,distance,riskAmount,positionSize:Number(positionSize.toPrecision(12)),actualRisk:positionSize*distance*Number(input.contract)};
  }
  function advanceTrade(position, bar, {priority='Stop first',trailing=false,atr=0,multiplier=1.5}={}) {
    const p={...position,reached:[...(position.reached||[false,false,false])]};
    const initialRisk=p.initialRisk||Math.abs(p.entry-(p.initialStop??p.stop));
    if(!Number.isFinite(initialRisk)||initialRisk<=0)throw new RangeError('Trade requires a positive initial risk');
    const stopped=p.direction===1?bar.low<=p.stop:bar.high>=p.stop;
    const hits=p.tps.map(target=>p.direction===1?bar.high>=target:bar.low<=target);
    const events=[];
    const exit=(price,reason)=>({position:null,events,result:{exitPrice:price,reason,resultR:p.direction*(price-p.entry)/initialRisk,time:bar.time,reached:p.reached}});
    if (stopped && priority==='Stop first') return exit(p.stop,'stop');
    for (let index=0;index<3;index++) if (hits[index]&&!p.reached[index]) {p.reached[index]=true;events.push('tp'+(index+1));if(index===2)return exit(p.tps[2],'tp3');}
    if (stopped) return exit(p.stop,'stop');
    p.tp1Reached=p.reached[0];
    if (trailing&&p.tp1Reached&&atr>0) {
      p.best=p.direction===1?Math.max(p.best??p.entry,bar.high):Math.min(p.best??p.entry,bar.low);
      const candidate=p.best-p.direction*atr*multiplier;
      p.stop=p.direction===1?Math.max(p.entry,candidate,p.stop):Math.min(p.entry,candidate,p.stop);
    }
    return {position:p,events,result:null};
  }
  function dateKey(timestamp,timezone='UTC') {
    const parts=new Intl.DateTimeFormat('en-CA',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(timestamp));
    const get=key=>parts.find(p=>p.type===key).value;return `${get('year')}-${get('month')}-${get('day')}`;
  }
  function validTimezone(value) {try {new Intl.DateTimeFormat('en',{timeZone:value}).format();return typeof value==='string'&&value.length<80;}catch{return false;}}
  function periodContains(timestamp,period,timezone='UTC',now=Date.now()) {
    if (!numeric(timestamp)||timestamp>now) return false;
    if (period==='all') return true;
    const today=dateKey(now,timezone),day=dateKey(timestamp,timezone);
    if(period==='today')return day===today;
    const start=new Date(today+'T12:00:00Z');start.setUTCDate(start.getUTCDate()-(period==='week'?6:29));
    return day>=start.toISOString().slice(0,10)&&day<=today;
  }
  function closeTime(row) {return epoch(row.closedAt)||epoch(row.updated_at)||row.updatedAt||row.createdAt;}
  function summary(rows,{period='all',timezone='UTC',now=Date.now()}={}) {
    const trades=rows.filter(row=>row.kind==='trade');
    const closed=trades.filter(row=>closedStatuses.includes(row.status)&&periodContains(closeTime(row),period,timezone,now)).sort((a,b)=>closeTime(a)-closeTime(b));
    const known=closed.filter(row=>numeric(row.resultR));
    let equity=0,peak=0,drawdown=0;const points=[0];
    for(const row of known){equity+=Number(row.resultR);peak=Math.max(peak,equity);drawdown=Math.max(drawdown,peak-equity);points.push(equity);}
    return {closed:closed.length,wins:closed.filter(r=>r.status==='win').length,losses:closed.filter(r=>r.status==='loss').length,breakeven:closed.filter(r=>r.status==='breakeven').length,winRate:closed.length?closed.filter(r=>r.status==='win').length/closed.length*100:null,netR:known.length?equity:null,drawdown:known.length?drawdown:null,missingResults:closed.length-known.length,targets:[0,1,2].map(index=>closed.filter(r=>r.targetHits?.[index]===true).length),rows:closed,points};
  }
  function mergeRecords(remote,local) {
    const map=new Map(remote.map(row=>[row.id,row]));
    for(const row of local){const server=map.get(row.id);if(!server||row.syncStatus==='pending'||row.syncStatus==='conflict'||(row.updatedAt||0)>(server.updatedAt||0))map.set(row.id,row);}
    return [...map.values()].sort((a,b)=>b.createdAt-a.createdAt);
  }
  function settings(value) {
    const v=value&&typeof value==='object'&&!Array.isArray(value)?value:{};
    const entries=Object.entries(v.indicators||{}).filter(([key,val])=>/^(show-|planner-|smart-|blh-|pa-|heat-|term$|rr$|valid$)/.test(key)&&key.length<80&&(typeof val==='boolean'||typeof val==='string'&&val.length<120)).slice(0,150);
    const profiles={};
    for(const [key,profile] of Object.entries(v.marketProfiles||{}).slice(0,10))if(/^(XAU\/USD|BTC\/USD)\|(1min|5min|15min|30min|1h)$/.test(key))profiles[key]=settings({indicators:profile}).indicators;
    const presets=(Array.isArray(v.presets)?v.presets:[]).slice(0,20).filter(p=>p&&typeof p.name==='string').map(p=>({name:p.name.slice(0,50),indicators:settings({indicators:p.indicators}).indicators}));
    return {version:1,timezone:validTimezone(v.timezone)?v.timezone:'UTC',confirmedOnly:v.confirmedOnly!==false,demo:!!v.demo,risk:{balance:numeric(v.risk?.balance)&&v.risk.balance>=1&&v.risk.balance<=1e12?Number(v.risk.balance):10000,percent:numeric(v.risk?.percent)&&v.risk.percent>=.01&&v.risk.percent<=100?Number(v.risk.percent):1},indicators:Object.fromEntries(entries),marketProfiles:profiles,presets,contract:numeric(v.contract)&&v.contract>0&&v.contract<=1e9?Number(v.contract):100,lotStep:numeric(v.lotStep)&&v.lotStep>0&&v.lotStep<=1e7?Number(v.lotStep):.01,btcContract:numeric(v.btcContract)&&v.btcContract>0?Number(v.btcContract):1,btcLotStep:numeric(v.btcLotStep)&&v.btcLotStep>0?Number(v.btcLotStep):.0001,goal:v.goal&&numeric(v.goal.targetR)&&v.goal.targetR>0&&numeric(v.goal.maxRisk)&&v.goal.maxRisk>0&&v.goal.maxRisk<=100?{targetR:Number(v.goal.targetR),maxRisk:Number(v.goal.maxRisk)}:null};
  }
  function tracker() {
    const markets=new Map();
    return {reset(){markets.clear();},update(snapshot,{confirmedOnly=true,now=Date.now()}={}) {
      const market=snapshot.symbol+'|'+snapshot.interval,signal=snapshot.signal,previous=markets.get(market),events=[];
      const emit=(kind,record)=>{const key=record.signal.key+'|'+kind;if(record.sent.has(key))return;record.sent.add(key);events.push({...record.signal,symbol:snapshot.symbol,interval:snapshot.interval,event:kind,eventKey:key});};
      if(previous&&(!signal||previous.signal.key!==signal.key)) {if(previous.announced&&!previous.done)emit('cancel',previous);markets.delete(market);}
      if(!signal||!numeric(signal.entry)||!numeric(signal.stopLoss)||!Array.isArray(signal.takeProfits))return events;
      const fresh=now-(signal.time||0)<=intervals[snapshot.interval]*2;
      let record=markets.get(market);
      if(!record){record={signal:{...signal},sent:new Set(),announced:false,done:signal.status==='historical',entered:false};markets.set(market,record);}
      if(record.done)return events;
      const eligible=!confirmedOnly||signal.confirmed===true;
      if(!eligible)return events;
      if(!record.announced){record.announced=true;if(fresh)emit('new',record);}
      if(record.signal.stopLoss!==signal.stopLoss){record.signal={...signal};emit('update-'+signal.stopLoss,record);}else record.signal={...signal};
      // The engine also reports transitions between polls; a later candle may no longer touch the exit level.
      for(let i=0;i<3;i++)if(signal.targetHits?.[i])emit('tp'+(i+1),record);
      if(signal.exitReason){emit(signal.exitReason==='tp3'?'tp3':'stop',record);record.done=true;return events;}
      const price=Number(snapshot.price);if(!Number.isFinite(price))return events;
      const sameCandle=numeric(snapshot.bar?.time)&&snapshot.bar.time<=signal.time;
      const high=!sameCandle&&numeric(snapshot.bar?.high)?Number(snapshot.bar.high):price,low=!sameCandle&&numeric(snapshot.bar?.low)?Number(snapshot.bar.low):price;
      if(!record.entered&&(signal.direction==='buy'?high>=signal.entry:low<=signal.entry)){record.entered=true;if(fresh)emit('entry',record);}
      if(!record.entered)return events;
      const stop=signal.direction==='buy'?low<=signal.stopLoss:high>=signal.stopLoss;
      if(stop&&snapshot.priority!=='Targets first'){emit('stop',record);record.done=true;return events;}
      signal.takeProfits.slice(0,3).forEach((target,index)=>{if(signal.direction==='buy'?high>=target:low<=target){emit('tp'+(index+1),record);if(index===2)record.done=true;}});
      if(stop&&!record.done){emit('stop',record);record.done=true;}
      return events;
    }};
  }
  root.PIPVORIA_CORE=Object.freeze({intervals,closedStatuses,numeric,epoch,risk,advanceTrade,dateKey,periodContains,validTimezone,closeTime,summary,mergeRecords,settings,tracker});
})(globalThis);
