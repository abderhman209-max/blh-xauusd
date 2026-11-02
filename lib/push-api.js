// Phone notifications for AI plans and the background tick that keeps the bot's track record current.
// Secrets (VAPID key pair, tick secret) live in Supabase Vault and are read by the server with the service role.
import {outcomeTracker,analysisRunner} from './ai-api.js';
import {AI_SYMBOLS,marketClosed} from './ai-analysis.js';
import {newsWindow} from './economic-calendar.js';
import {sendPush,validSubscription} from './web-push.js';
const LABELS={XAU:'XAU/USD',EUR:'EUR/USD',BTC:'BTC/USD',ETH:'ETH/USD',SOL:'SOL/USD'};
const TF={'1min':'1m','5min':'5m','15min':'15m','30min':'30m','1h':'1h'};
export function planMessage({row,before},now=Date.now()){
  const r=row.result,o=row.outcome,p=r.plan,side=p.direction==='buy'?'ACHAT':'VENTE',market=LABELS[r.symbol]+' '+TF[r.interval];
  if(now-r.generatedAt>86400000)return null;
  if(o.activatedAt&&!before?.activatedAt&&o.state!=='not_triggered')
    return {title:'Scénario IA activé · '+market,body:side+' · entrée '+p.entry+' · SL '+p.stop+' · TP '+p.targets.join(' / '),tag:row.cache_key};
  if(o.state==='closed'&&before?.state!=='closed'){
    const r2=o.exit.resultR,label=o.exit.reason==='tp3'?'TP3 atteint':o.exit.reason==='stop'?'Stop touché':'Clôturé (durée max.)';
    return {title:'Plan IA clôturé · '+market,body:label+' · '+(r2>0?'+':'')+r2+' R',tag:row.cache_key};
  }
  if(o.state==='not_triggered'&&before?.state!=='not_triggered'&&p.conditional)
    return {title:'Scénario IA annulé · '+market,body:side+' non déclenché : n’utilisez plus ce plan.',tag:row.cache_key};
  return null;
}
const WATCH_FRAMES=['5min','15min','30min','1h'],WATCH_EVERY=55*60000;
// The notification for a fresh plan from an automatic watch.
export function signalMessage(result){
  const p=result.plan;if(!p)return null;
  const side=p.direction==='buy'?'ACHAT':'VENTE',market=LABELS[result.symbol]+' '+TF[result.interval],levels='entrée '+p.entry+' · SL '+p.stop+' · TP '+p.targets.join(' / ');
  return p.conditional?{title:'Signal IA à confirmer · '+market,body:side+' si clôture '+(p.direction==='buy'?'au-dessus de ':'au-dessous de ')+(p.triggerLevel??p.entry)+' · '+levels,tag:'signal-'+result.symbol}
    :{title:'Nouveau signal IA · '+market,body:side+' · '+levels,tag:'signal-'+result.symbol};
}
const timingSafeEqual=(a,b)=>{if(typeof a!=='string'||typeof b!=='string'||a.length!==b.length)return false;let diff=0;for(let i=0;i<a.length;i++)diff|=a.charCodeAt(i)^b.charCodeAt(i);return diff===0;};
export function pushApi({currentSession,supabaseAdminData,sessionJson,json,body,gold,additionalMarket,subject='mailto:support@pipvoria.invalid',
  run=analysisRunner({supabaseAdminData,gold,additionalMarket}),marketHours=marketClosed,news=newsWindow}){
  const advance=outcomeTracker({supabaseAdminData,gold,additionalMarket});
  let cached=null;
  async function secrets(){
    if(cached&&Date.now()-cached.at<600000)return cached.value;
    const response=await supabaseAdminData('rpc/pipvoria_push_secrets',{method:'POST',body:'{}'});
    const value=response.ok?await response.json():null;
    cached={at:Date.now(),value:value?.vapidPublic&&value?.vapidPrivate&&value?.tick?value:null};return cached.value;
  }
  async function deliver(rows,payload,vapid){
    let sent=0;
    await Promise.all(rows.map(async s=>{
      const result=await sendPush({endpoint:s.endpoint,keys:{p256dh:s.p256dh,auth:s.auth}},payload,vapid).catch(()=>'failed');
      if(result==='sent')sent++;
      if(result==='gone')await supabaseAdminData('push_subscriptions?endpoint=eq.'+encodeURIComponent(s.endpoint),{method:'DELETE'}).catch(()=>{});
    }));
    return sent;
  }
  const iso=t=>new Date(t).toISOString();
  async function paidUsers(users,now){
    if(!users.length)return new Set();
    const paid=await supabaseAdminData('payment_subscriptions?user_id=in.('+users.join(',')+')&paid_until=gt.'+iso(now)+'&select=user_id');
    return paid.ok?new Set((await paid.json()).map(r=>r.user_id)):new Set();
  }
  async function subscriptions(users,now){
    const valid=[...new Set(users)].filter(id=>/^[0-9a-f-]{36}$/.test(id));if(!valid.length)return [];
    const subs=await supabaseAdminData('push_subscriptions?user_id=in.('+valid.join(',')+')&select=user_id,endpoint,p256dh,auth,paid_exempt');
    if(!subs.ok)return [];
    const active=await paidUsers(valid,now);return (await subs.json()).filter(s=>s.paid_exempt||active.has(s.user_id));
  }
  // At most one automatic analysis per tick (one model call), for the watch that waited longest and whose market is open.
  async function watchTick(now,vapid){
    if(!process.env.OPENAI_API_KEY)return null;
    const due=await supabaseAdminData('ai_auto_watch?or=(last_run_at.is.null,last_run_at.lt.'+iso(now-WATCH_EVERY)+')&order=last_run_at.asc.nullsfirst&limit=10&select=user_id,symbol,interval,paid_exempt,last_cache_key');
    if(!due.ok||news(now))return null;
    const watches=(await due.json()).filter(w=>AI_SYMBOLS.includes(w.symbol)&&WATCH_FRAMES.includes(w.interval)&&!marketHours(w.symbol,now));
    const paid=await paidUsers(watches.filter(w=>!w.paid_exempt).map(w=>w.user_id).filter(id=>/^[0-9a-f-]{36}$/.test(id)),now);
    for(const w of watches){
      const save=patch=>supabaseAdminData('ai_auto_watch?user_id=eq.'+w.user_id,{method:'PATCH',body:JSON.stringify({last_run_at:iso(now),...patch})});
      if(!w.paid_exempt&&!paid.has(w.user_id)){await save({last_status:'inactive'});continue;}
      let result;
      try{result=await run({symbol:w.symbol,interval:w.interval,userId:w.user_id});}
      catch(error){await save({last_status:/^analysis_[a-z_]+$/.test(error.message)?error.message:'analysis_unavailable'});return {watch:w.symbol+' '+w.interval,status:'error'};}
      await save({last_status:result.plan?result.status:'wait',last_cache_key:result.cacheKey});
      const message=result.cacheKey!==w.last_cache_key?signalMessage(result):null;
      const sent=message&&vapid?await deliver(await subscriptions([w.user_id],now),{...message,url:'/#signals'},vapid):0;
      return {watch:w.symbol+' '+w.interval,status:result.plan?result.status:'wait',notified:sent};
    }
    return null;
  }
  async function tick(now=Date.now()){
    const value=await secrets(),vapid=value?{publicKey:value.vapidPublic,privateKey:value.vapidPrivate,subject}:null;
    const {changes}=await advance(now);
    let messages=changes.map(change=>({change,message:planMessage(change,now)})).filter(m=>m.message);
    // Plans reach their generating account and every account whose automatic watch received the same plan.
    const keys=[...new Set(messages.map(m=>m.change.row.cache_key))];
    const watchers=keys.length?await supabaseAdminData('ai_auto_watch?last_cache_key=in.('+keys.join(',')+')&select=user_id,last_cache_key'):null;
    const byKey=new Map();for(const w of watchers?.ok?await watchers.json():[]){if(!byKey.has(w.last_cache_key))byKey.set(w.last_cache_key,[]);byKey.get(w.last_cache_key).push(w.user_id);}
    let notified=0;
    if(vapid&&messages.length){
      const recipients=messages.map(m=>[...new Set([m.change.row.user_id,...(byKey.get(m.change.row.cache_key)||[])].filter(Boolean))]);
      const rows=await subscriptions(recipients.flat(),now);
      for(const [i,m] of messages.entries())notified+=await deliver(rows.filter(s=>recipients[i].includes(s.user_id)),{...m.message,url:'/#signals'},vapid);
    }
    const watch=await watchTick(now,vapid).catch(()=>null);
    return {advanced:changes.length,notified,...(watch?{watch}:{})};
  }
  return async(request,url,action)=>{
    if(action==='tick'){
      const value=await secrets().catch(()=>null);
      if(!value)return json({error:'push_not_configured'},503);
      if(!timingSafeEqual(request.headers.get('x-cron-secret')||'',value.tick))return json({error:'not_found'},404);
      // A model call can outlast the Edge first-byte limit: send a byte at once, then the JSON summary.
      const encoder=new TextEncoder();
      return new Response(new ReadableStream({async start(c){c.enqueue(encoder.encode(' '));
        try{c.enqueue(encoder.encode(JSON.stringify(await tick())));}catch{c.enqueue(encoder.encode('{"error":"tick_failed"}'));}c.close();}}),
        {status:200,headers:{'content-type':'application/json','cache-control':'no-store'}});
    }
    const session=await currentSession(request);
    if(!session)return json({error:'authentication_required'},401);
    const value=await secrets().catch(()=>null);
    if(action==='config'){
      const watch=await supabaseAdminData('ai_auto_watch?user_id=eq.'+encodeURIComponent(session.user.id)+'&select=symbol,interval,last_run_at,last_status').then(r=>r.ok?r.json():[]).catch(()=>[]);
      return sessionJson({configured:!!value,publicKey:value?.vapidPublic||null,watch:watch[0]||null},200,session);
    }
    if(!value)return json({error:'push_not_configured'},503);
    const input=await body(request);
    if(action==='subscribe'){
      if(!validSubscription(input))return json({error:'invalid_subscription'},400);
      const response=await supabaseAdminData('push_subscriptions?on_conflict=endpoint',{method:'POST',headers:{prefer:'resolution=merge-duplicates'},
        body:JSON.stringify({user_id:session.user.id,endpoint:input.endpoint,p256dh:input.keys.p256dh,auth:input.keys.auth,paid_exempt:session.user.app_metadata?.role==='super_admin'})});
      return response.ok?sessionJson({subscribed:true},200,session):json({error:'push_storage_unavailable'},503);
    }
    if(action==='watch'){
      if(input?.enabled===false){await supabaseAdminData('ai_auto_watch?user_id=eq.'+encodeURIComponent(session.user.id),{method:'DELETE'});return sessionJson({watch:null},200,session);}
      if(!input||Object.keys(input).some(k=>!['symbol','interval'].includes(k))||!AI_SYMBOLS.includes(input.symbol)||!WATCH_FRAMES.includes(input.interval))return json({error:'invalid_watch'},400);
      const watch={user_id:session.user.id,symbol:input.symbol,interval:input.interval,paid_exempt:session.user.app_metadata?.role==='super_admin',last_run_at:null,last_cache_key:null,last_status:null};
      const response=await supabaseAdminData('ai_auto_watch?on_conflict=user_id',{method:'POST',headers:{prefer:'resolution=merge-duplicates'},body:JSON.stringify(watch)});
      return response.ok?sessionJson({watch:{symbol:watch.symbol,interval:watch.interval,last_run_at:null,last_status:null}},200,session):json({error:'push_storage_unavailable'},503);
    }
    if(action==='unsubscribe'){
      if(typeof input?.endpoint!=='string'||input.endpoint.length>1024)return json({error:'invalid_subscription'},400);
      await supabaseAdminData('push_subscriptions?endpoint=eq.'+encodeURIComponent(input.endpoint)+'&user_id=eq.'+encodeURIComponent(session.user.id),{method:'DELETE'});
      return sessionJson({subscribed:false},200,session);
    }
    if(action==='test'){
      const subs=await supabaseAdminData('push_subscriptions?user_id=eq.'+encodeURIComponent(session.user.id)+'&select=user_id,endpoint,p256dh,auth');
      if(!subs.ok)return json({error:'push_storage_unavailable'},503);
      const sent=await deliver(await subs.json(),{title:'Pipvoria · notifications actives',body:'Vous recevrez ici l’activation et la clôture des plans de l’agent IA.',url:'/#signals',tag:'test'},
        {publicKey:value.vapidPublic,privateKey:value.vapidPrivate,subject});
      return sessionJson({sent},200,session);
    }
    return json({error:'not_found'},404);
  };
}
