// Phone notifications for AI plans and the background tick that keeps the bot's track record current.
// Secrets (VAPID key pair, tick secret) live in Supabase Vault and are read by the server with the service role.
import {outcomeTracker} from './ai-api.js';
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
const timingSafeEqual=(a,b)=>{if(typeof a!=='string'||typeof b!=='string'||a.length!==b.length)return false;let diff=0;for(let i=0;i<a.length;i++)diff|=a.charCodeAt(i)^b.charCodeAt(i);return diff===0;};
export function pushApi({currentSession,supabaseAdminData,sessionJson,json,body,gold,additionalMarket,subject='mailto:support@pipvoria.invalid'}){
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
  async function tick(now=Date.now()){
    const {changes}=await advance(now);
    const messages=changes.map(change=>({user:change.row.user_id,message:planMessage(change,now)})).filter(m=>m.user&&m.message);
    const value=await secrets();if(!messages.length||!value)return {advanced:changes.length,notified:0};
    const users=[...new Set(messages.map(m=>m.user))].filter(id=>/^[0-9a-f-]{36}$/.test(id));
    const subs=await supabaseAdminData('push_subscriptions?user_id=in.('+users.join(',')+')&select=user_id,endpoint,p256dh,auth,paid_exempt');
    const paid=await supabaseAdminData('payment_subscriptions?user_id=in.('+users.join(',')+')&paid_until=gt.'+new Date(now).toISOString()+'&select=user_id');
    if(!subs.ok||!paid.ok)return {advanced:changes.length,notified:0};
    const active=new Set((await paid.json()).map(r=>r.user_id)),rows=(await subs.json()).filter(s=>s.paid_exempt||active.has(s.user_id));
    const vapid={publicKey:value.vapidPublic,privateKey:value.vapidPrivate,subject};let notified=0;
    for(const m of messages)notified+=await deliver(rows.filter(s=>s.user_id===m.user),{...m.message,url:'/#signals'},vapid);
    return {advanced:changes.length,notified};
  }
  return async(request,url,action)=>{
    if(action==='tick'){
      const value=await secrets().catch(()=>null);
      if(!value)return json({error:'push_not_configured'},503);
      if(!timingSafeEqual(request.headers.get('x-cron-secret')||'',value.tick))return json({error:'not_found'},404);
      try{return json(await tick(),200);}catch{return json({error:'tick_failed'},503);}
    }
    const session=await currentSession(request);
    if(!session)return json({error:'authentication_required'},401);
    const value=await secrets().catch(()=>null);
    if(action==='config')return sessionJson({configured:!!value,publicKey:value?.vapidPublic||null},200,session);
    if(!value)return json({error:'push_not_configured'},503);
    const input=await body(request);
    if(action==='subscribe'){
      if(!validSubscription(input))return json({error:'invalid_subscription'},400);
      const response=await supabaseAdminData('push_subscriptions?on_conflict=endpoint',{method:'POST',headers:{prefer:'resolution=merge-duplicates'},
        body:JSON.stringify({user_id:session.user.id,endpoint:input.endpoint,p256dh:input.keys.p256dh,auth:input.keys.auth,paid_exempt:session.user.app_metadata?.role==='super_admin'})});
      return response.ok?sessionJson({subscribed:true},200,session):json({error:'push_storage_unavailable'},503);
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
