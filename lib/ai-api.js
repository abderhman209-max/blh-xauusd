import {AI_MODEL,AI_FRAMES,AI_SYMBOLS,marketPacket,marketClosed,packetKey,inferAnalysis} from './ai-analysis.js';
import {CALENDAR,newsWindow,nextNews} from './economic-calendar.js';
import {initialOutcome,advanceOutcome,isFinal,summarizeOutcomes} from './ai-outcomes.js';
const safeErrors=new Set(['analysis_news_window','analysis_market_closed','analysis_data_stale','analysis_history_insufficient','analysis_in_progress','analysis_daily_limit','ai_not_configured']);
const trackable=r=>{const p=r?.plan;return AI_SYMBOLS.includes(r?.symbol)&&Object.hasOwn(AI_FRAMES,r?.interval)&&Number.isFinite(r?.asOf)&&
  ['buy','sell'].includes(p?.direction)&&Array.isArray(p.targets)&&p.targets.length===3&&[p.entry,p.stop,...p.targets].every(Number.isFinite);};
export function analysisApi({currentSession,supabaseAdminData,sessionJson,json,body,gold,additionalMarket,marketHours=marketClosed,calendar=CALENDAR}){
  // Shared bot track record: plans from every account, advanced with the latest closed candles and persisted.
  async function stats(now=Date.now()){
    const since=new Date(now-90*86400000).toISOString();
    const response=await supabaseAdminData('ai_analysis_cache?status=eq.completed&created_at=gte.'+since+'&select=cache_key,result,outcome&order=created_at.desc&limit=1000');
    if(!response.ok)throw Error('analysis_storage_unavailable');
    const stored=await response.json();if(!Array.isArray(stored))throw Error('analysis_storage_unavailable');
    const rows=stored.filter(row=>/^[a-f0-9]{64}$/.test(row.cache_key)&&trackable(row.result)).map(row=>({...row,saved:row.outcome,outcome:row.outcome??initialOutcome(row.result)}));
    const groups=new Map();
    for(const row of rows)if(!isFinal(row.outcome)){const key=row.result.symbol+'|'+row.result.interval;if(!groups.has(key))groups.set(key,[]);groups.get(key).push(row);}
    await Promise.all([...groups].map(async([key,list])=>{
      const [symbol,interval]=key.split('|');let data;
      try{data=symbol==='XAU'?await gold(interval):await additionalMarket(symbol,interval);}catch{return;}
      if(!Array.isArray(data?.bars))return;
      await Promise.all(list.map(async row=>{
        row.outcome=advanceOutcome(row.outcome,row.result,data.bars,AI_FRAMES[interval],now);
        if(JSON.stringify(row.outcome)===JSON.stringify(row.saved))return;
        try{await supabaseAdminData('ai_analysis_cache?cache_key=eq.'+row.cache_key+'&status=eq.completed',{method:'PATCH',body:JSON.stringify({outcome:row.outcome})});}catch{}
      }));
    }));
    return {...summarizeOutcomes(rows),since,checkedAt:now};
  }
  return async(request,url,action)=>{
    const session=await currentSession(request);
    if(!session)return json({error:'authentication_required'},401);
    if(action==='stats'){try{return sessionJson(await stats(),200,session);}catch{return json({error:'analysis_stats_unavailable'},503);}}
    if(action==='config')return sessionJson({configured:!!process.env.OPENAI_API_KEY,model:AI_MODEL,perUserDailyLimit:20,globalDailyLimit:100},200,session);
    if(!process.env.OPENAI_API_KEY)return json({error:'ai_not_configured'},503);
    const input=await body(request);
    if(!input||Object.keys(input).some(k=>!['symbol','interval'].includes(k))||!AI_SYMBOLS.includes(input.symbol)||!Object.hasOwn(AI_FRAMES,input.interval))return json({error:'invalid_analysis'},400);
    const stop=new AbortController();let closed=false;
    const encoder=new TextEncoder();
    const stream=new ReadableStream({
      start(controller){
        const emit=(type,data)=>{if(!closed)controller.enqueue(encoder.encode(JSON.stringify({type,...data})+'\n'));};
        (async()=>{
          let reservation=null,stage='market';
          const finish=async(status,result)=>{
            if(!reservation)return;
            const response=await supabaseAdminData('ai_analysis_cache?cache_key=eq.'+reservation.cacheKey+'&claim_id=eq.'+reservation.claimId+'&status=eq.running',{
              method:'PATCH',headers:{prefer:'return=representation'},body:JSON.stringify({status,result})
            });
            const rows=response.ok?await response.json():null;
            if(!Array.isArray(rows)||rows.length!==1)throw Error('analysis_storage_unavailable');
          };
          try{
            // High-impact US releases make the candles unreliable for 30 minutes on each side: no new plan then.
            const news=newsWindow(Date.now(),calendar);
            if(news)throw Object.assign(Error('analysis_news_window'),{event:{name:news.name,at:news.at}});
            emit('stage',{stage:'market',label:'Récupération des dernières bougies clôturées'});
            const intervals=[...new Set([input.interval,'15min','1h'])];
            const datasets=await Promise.all(intervals.map(async interval=>{
              const data=input.symbol==='XAU'?await gold(interval):await additionalMarket(input.symbol,interval);
              return {...data,interval};
            }));
            const packet=marketPacket(input.symbol,input.interval,datasets,Date.now(),{closed:marketHours});
            const cacheKey=await packetKey(packet);
            stage='context';emit('stage',{stage,label:'Recoupement des périodes et vérification de la fraîcheur'});
            if(stop.signal.aborted)throw Error('analysis_cancelled');
            const reserved=await supabaseAdminData('rpc/pipvoria_reserve_ai_analysis',{method:'POST',body:JSON.stringify({
              p_cache_key:cacheKey,p_user_id:session.user.id,p_expires_at:new Date(packet.validUntil).toISOString()
            })});
            if(!reserved.ok)throw Error('analysis_storage_unavailable');
            const claim=await reserved.json();
            if(claim.status==='cached'){
              if(Date.parse(claim.expiresAt)<=Date.now()||!claim.result||claim.result.validUntil<=Date.now())throw Error('analysis_data_stale');
              emit('result',{result:{...claim.result,cached:true}});return;
            }
            if(claim.status==='limited')throw Error('analysis_daily_limit');
            if(claim.status==='running')throw Error('analysis_in_progress');
            if(claim.status!=='reserved'||typeof claim.claimId!=='string')throw Error('analysis_storage_unavailable');
            reservation={cacheKey,claimId:claim.claimId};
            stage='model';emit('stage',{stage,label:'Lecture IA de la structure, de la liquidité et du contexte'});
            const inferred=await inferAnalysis(packet,{key:process.env.OPENAI_API_KEY,signal:stop.signal});
            const upcoming=nextNews(Date.now(),inferred.plan?.activeUntil??inferred.validUntil,calendar);
            const result=upcoming?{...inferred,news:{name:upcoming.name,at:upcoming.at}}:inferred;
            stage='validation';emit('stage',{stage,label:'Contrôle des niveaux, du risque et des références de bougies'});
            await finish('completed',result);reservation=null;
            emit('result',{result:{...result,cached:false}});
          }catch(error){
            try{await finish('failed',null);}catch{}
            const code=/^analysis_[a-z_]+$/.test(error.message)?error.message:'analysis_unavailable';
            const kind=['TypeError','SyntaxError','AbortError','TimeoutError'].includes(error.name)?error.name:'Error';
            const reason=/illegal invocation/i.test(error.message)?'illegal_invocation':/fetch failed/i.test(error.message)?'fetch_failed':/JSON/i.test(error.message)?'invalid_json':null;
            const keywords=['header','ByteString','character','redirect','receiver','context','signal','output','flatMap','undefined','network'].filter(word=>String(error.message).toLowerCase().includes(word.toLowerCase()));
            console.warn('Pipvoria AI:',JSON.stringify({code,stage,kind,reason,keywords}));
            emit('error',{error:safeErrors.has(error.message)?error.message:'analysis_unavailable',...(error.event?{event:error.event}:{})});
          }finally{if(!closed){closed=true;controller.close();}}
        })();
      },
      cancel(){closed=true;stop.abort();}
    });
    const headers=new Headers(sessionJson({},200,session).headers);
    headers.set('content-type','application/x-ndjson; charset=utf-8');
    headers.set('cache-control','no-store');headers.set('x-content-type-options','nosniff');
    return new Response(stream,{status:200,headers});
  };
}
