import worker from "../worker/index.js";

export const config = { runtime: "edge" };

function createWorkerRequest(request) {
  const url = new URL(request.url);
  const path = url.searchParams.get("__path") || "";
  url.searchParams.delete("__path");
  url.pathname = "/" + path.replace(/^\/+/, "");

  const headers = new Headers(request.headers);
  headers.set("oai-authenticated-user-id", "vercel-public-visitor");
  headers.set("oai-authenticated-user-email", "visitor@blh-xauusd.local");

  return new Request(url, {
    method: request.method,
    headers,
    body: request.method === "GET" || request.method === "HEAD" ? undefined : request.body,
    redirect: "manual",
  });
}

function requestedPath(request) {
  const path = new URL(request.url).searchParams.get("__path") || "";
  return "/" + path.replace(/^\/+/, "");
}

const plannerEngine = String.raw`// Web port of Signal Trade Planner Strategy by abderhman209.
const SmartEngine={analyze(bars,{atrLength=14,zone=1.5,rr=[.5,1,1.5]}={}){
 const val=(id,fallback)=>{const n=Number(document.querySelector(id)?.value);return Number.isFinite(n)?n:fallback},checked=(id,fallback=true)=>document.querySelector(id)?.checked??fallback;
 const fastLength=val('#planner-fast',21),slowLength=val('#planner-slow',50),rsiLength=val('#planner-rsi-length',14),rsiThreshold=val('#planner-rsi-threshold',52),minSeparation=val('#planner-separation',.05),minBody=val('#planner-body',.10),cooldown=val('#planner-cooldown',3),swingLookback=val('#planner-swing',7),trailingMultiplier=val('#planner-trailing-atr',1.5);
 const mode=document.querySelector('#planner-mode')?.value||'Hybrid',stopMode=document.querySelector('#planner-stop-mode')?.value||'ATR',directionMode=document.querySelector('#planner-direction')?.value||'Both',priority=document.querySelector('#planner-priority')?.value||'Stop first',trailing=checked('#planner-trailing',true);
 const result={sides:[],signals:[],fast:[],slow:[],stats:{signals:0,closed:0,wins:0,tp1:0,tp2:0,tp3:0,stops:0,netR:0},active:null};if(bars.length<slowLength+2)return result;
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
  if(active&&i>active.index){const stopHit=active.direction===1?b.low<=active.stop:b.high>=active.stop,hits=active.tps.map(t=>active.direction===1?b.high>=t:b.low<=t);if(stopHit&&priority==='Stop first'){result.stats.stops++;result.stats.closed++;result.stats.netR+=active.tp1Reached?0:-1;active=null;lastExit=i}else{for(let t=0;t<3;t++)if(hits[t]&&!active?.reached[t]){active.reached[t]=true;result.stats['tp'+(t+1)]++;if(t===0){active.tp1Reached=true;result.stats.wins++}if(t===2){result.stats.closed++;result.stats.netR+=rr[2];active=null;lastExit=i;break}}if(active&&stopHit){result.stats.stops++;result.stats.closed++;result.stats.netR+=active.tp1Reached?rr[0]:-1;active=null;lastExit=i}if(active&&trailing&&active.tp1Reached){active.best=active.direction===1?Math.max(active.best,b.high):Math.min(active.best,b.low);const candidate=active.direction===1?active.best-a*trailingMultiplier:active.best+a*trailingMultiplier;active.stop=active.direction===1?Math.max(active.entry,candidate,active.stop):Math.min(active.entry,candidate,active.stop);active.plan.stop=active.stop}}}
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
  lastPlan=plan;active={...plan,plan,reached:[false,false,false],tp1Reached:false,best:entry};result.signals.push({index:i,direction,price:direction===1?b.low:b.high});result.stats.signals++;
 }
 result.active=active;result.sides=lastPlan?[lastPlan]:[];return result;
}};
if(typeof module!=='undefined')module.exports=SmartEngine;
function renderSmart(model,x,y,width,height,layer='all'){
 const enabled=id=>document.querySelector(id)?.checked!==false;let shapes='<g data-indicator="planner">',labels='<g data-indicator="planner-labels">';
 const path=(values,color)=>{let d='';for(let i=0;i<values.length;i++){if(!Number.isFinite(values[i]))continue;const xx=x(i);if(xx<0||xx>width)continue;d+=(d?' L ':'M ')+xx+' '+y(values[i])}return d?'<path d="'+d+'" fill="none" stroke="'+color+'" stroke-width="1.7" opacity=".9"/>':''};
 if(enabled('#smart-trend')){shapes+=path(model.fast,'#00d9ff')+path(model.slow,'#8b5cf6')}
 for(const z of model.sides){const color=z.direction===1?'#089981':'#f23645',name=z.direction===1?'BUY':'SELL',left=x(z.index),right=Math.min(width-4,x(z.index+25));if(right<0||left>width)continue;
  const x1=Math.max(0,left),x2=Math.max(x1+34,right),w=x2-x1,rewardTop=y(Math.max(z.entry,z.tps[2])),rewardBottom=y(Math.min(z.entry,z.tps[2])),riskTop=y(Math.max(z.entry,z.stop)),riskBottom=y(Math.min(z.entry,z.stop));
  shapes+='<rect x="'+x1+'" y="'+rewardTop+'" width="'+w+'" height="'+Math.max(1,rewardBottom-rewardTop)+'" fill="#7c3aed" fill-opacity=".18" stroke="#9b6cff" stroke-width="1.2"/><rect x="'+x1+'" y="'+riskTop+'" width="'+w+'" height="'+Math.max(1,riskBottom-riskTop)+'" fill="#7f1d1d" fill-opacity=".28" stroke="#f23645" stroke-width="1.2"/><line x1="'+x1+'" y1="'+y(z.entry)+'" x2="'+x2+'" y2="'+y(z.entry)+'" stroke="#5b9cf6" stroke-width="2"/><line x1="'+x1+'" y1="'+y(z.stop)+'" x2="'+x2+'" y2="'+y(z.stop)+'" stroke="#f23645" stroke-dasharray="8 5" stroke-width="2"/>';
  const badge=(price,title,fill)=>{const yy=y(price),bx=Math.min(width-58,x2+4);labels+='<g><rect x="'+bx+'" y="'+(yy-13)+'" width="56" height="26" rx="5" fill="'+fill+'"/><text x="'+(bx+28)+'" y="'+(yy-2)+'" text-anchor="middle" fill="white" font-size="9" font-weight="700">'+title+'</text><text x="'+(bx+28)+'" y="'+(yy+9)+'" text-anchor="middle" fill="white" font-size="8">'+price.toFixed(2)+'</text></g>'};
  if(enabled('#smart-tps'))z.tps.forEach((price,i)=>{shapes+='<line x1="'+x1+'" y1="'+y(price)+'" x2="'+x2+'" y2="'+y(price)+'" stroke="#a78bfa" stroke-dasharray="7 6" stroke-width="1.2"/>';badge(price,'TP'+(i+1),'#7551c7')});
  badge(z.entry,'ENTRY','#3b82c4');badge(z.stop,model.active?.tp1Reached?'TRAIL':'SL','#ef3340');
 }
 if(enabled('#smart-signals'))for(const signal of model.signals){const xx=x(signal.index);if(xx<0||xx>width)continue;const up=signal.direction===1,yy=y(signal.price),color=up?'#089981':'#f23645',name=up?'BUY':'SELL';labels+='<g><path d="M '+(xx-6)+' '+(yy+(up?10:-10))+' L '+xx+' '+yy+' L '+(xx+6)+' '+(yy+(up?10:-10))+'" fill="'+color+'"/><rect x="'+(xx-20)+'" y="'+(yy+(up?10:-34))+'" width="40" height="22" rx="4" fill="'+color+'"/><text x="'+xx+'" y="'+(yy+(up?25:-19))+'" text-anchor="middle" fill="white" font-size="10">'+name+'</text></g>'}
 if(enabled('#planner-dashboard')&&model.stats){const q=model.stats,rate=q.closed?Math.round(q.wins/q.closed*100):0,status=model.active?(model.active.direction===1?'LONG ACTIVE':'SHORT ACTIVE'):'WAITING',bx=Math.max(8,width-250);labels+='<g><rect x="'+bx+'" y="12" width="238" height="116" rx="8" fill="#071a14" fill-opacity=".94" stroke="#089981"/><text x="'+(bx+12)+'" y="32" fill="white" font-size="12" font-weight="700">SIGNAL TRADE PLANNER</text><text x="'+(bx+12)+'" y="52" fill="#aeb2ba" font-size="10">'+status+' · WIN '+rate+'%</text><text x="'+(bx+12)+'" y="72" fill="#69d4bb" font-size="10">SIGNALS '+q.signals+'   CLOSED '+q.closed+'   TP1 '+q.tp1+'</text><text x="'+(bx+12)+'" y="91" fill="#c4a7ff" font-size="10">TP2 '+q.tp2+'   TP3 '+q.tp3+'   SL '+q.stops+'</text><text x="'+(bx+12)+'" y="111" fill="'+(q.netR>=0?'#69d4bb':'#ff6b78')+'" font-size="11">NET '+q.netR.toFixed(2)+'R</text></g>'}
 return layer==='labels'?labels+'</g>':shapes+'</g>';
}`;

function configureIndicators(source) {
  return source
    .replace(
      "[['structure','structureSub','show-structure','signals'],['smart','smartSub','show-smart','performance'],['heat','heatSub','show-heatmap','weekly']]",
      "[['structure','structureSub','show-structure','signals'],['smart','smartSub','show-smart','performance']]",
    )
    .replace(
      "indicatorForm.append(...Object.values(groups));indicatorDialog",
      "indicatorForm.append(...Object.values(groups));const heatToggle=$('#show-heatmap');if(heatToggle){heatToggle.checked=false;groups.heat.hidden=true;$('#indicator-tab-heat').hidden=true;heatToggle.dispatchEvent(new Event('input',{bubbles:true}))}indicatorDialog",
    )
    .replace(
      "event.key==='Home'?0:event.key==='End'?2:(indicatorKeys.indexOf(selectedIndicator)+delta+3)%3",
      "event.key==='Home'?0:event.key==='End'?1:(indicatorKeys.indexOf(selectedIndicator)+delta+2)%2",
    )
    .replace(
      "['show-structure','show-smart','show-heatmap'].filter",
      "['show-structure','show-smart'].filter",
    )
    .replace("smart:['Buy & Sell zones','Kauf- & Verkaufszonen','Zones d’achat et de vente','Zonas de compra y venta','مناطق الشراء والبيع','مناطق الشراء والبيع']", "smart:['Signal Trade Planner','Signal Trade Planner','Signal Trade Planner','Signal Trade Planner','مخطط إشارات التداول','مخطط إشارات التداول']")
    .replace("smartSub:['Swing zones · TP1 / TP2 / TP3','Swing-Zonen · TP1 / TP2 / TP3','Zones swing · TP1 / TP2 / TP3','Zonas swing · TP1 / TP2 / TP3','مناطق السوينغ · أهداف 1 / 2 / 3','مناطق السوينغ · أهداف 1 / 2 / 3']", "smartSub:['EMA 21/50 · RSI · Entry / SL / TP1–3','EMA 21/50 · RSI · Einstieg / SL / TP1–3','EMA 21/50 · RSI · Entrée / SL / TP1–3','EMA 21/50 · RSI · Entrada / SL / TP1–3','EMA 21/50 · RSI · دخول / وقف / أهداف','EMA 21/50 · RSI · دخول / وقف / أهداف']");
}

async function customizeResponse(response, path) {
  if (path !== "/" && path !== "/index.html" && path !== "/portal.js" && path !== "/smart.js" && path !== "/indicator.js") {
    return response;
  }

  let body = await response.text();
  if (path === "/" || path === "/index.html") {
    body = body
      .replace(
        '<label><input id="show-smart" type="checkbox"> Smart Buy & Sell Zones + TP Engine V2</label>',
        '<label><input id="show-smart" type="checkbox" checked> Signal Trade Planner Strategy</label>',
      )
      .replace(
        '<label><input id="show-smart" type="checkbox" checked> Smart Buy & Sell Zones + TP Engine V2</label>',
        '<label><input id="show-smart" type="checkbox" checked> Signal Trade Planner Strategy</label>',
      )
      .replace(
        '<label><input id="show-smart" type="checkbox" checked> Signal Trade Planner Strategy</label>',
        '<label><input id="show-smart" type="checkbox" checked> Signal Trade Planner Strategy</label><label>Signal mode<select id="planner-mode"><option>Hybrid</option><option>EMA crossover</option><option>Pullback continuation</option></select></label><label>Fast EMA<input id="planner-fast" type="number" min="1" value="21"></label><label>Slow EMA<input id="planner-slow" type="number" min="2" value="50"></label><label>RSI length<input id="planner-rsi-length" type="number" min="2" value="14"></label><label>RSI threshold<input id="planner-rsi-threshold" type="number" min="50" max="70" value="52"></label><label>Minimum EMA separation (ATR)<input id="planner-separation" type="number" min="0" step="0.05" value="0.05"></label><label>Minimum candle body (ATR)<input id="planner-body" type="number" min="0" step="0.05" value="0.10"></label><label>Cooldown bars<input id="planner-cooldown" type="number" min="0" value="3"></label><label>Stop mode<select id="planner-stop-mode"><option>ATR</option><option>Recent swing</option></select></label><label>Swing lookback<input id="planner-swing" type="number" min="2" value="7"></label><label>Same-bar priority<select id="planner-priority"><option>Stop first</option><option>Targets first</option></select></label><label>Trade direction<select id="planner-direction"><option>Both</option><option>Long only</option><option>Short only</option></select></label><label><input id="planner-trailing" type="checkbox" checked> Trailing stop after TP1</label><label>Trailing ATR multiplier<input id="planner-trailing-atr" type="number" min="0.1" step="0.1" value="1.5"></label><label><input id="planner-dashboard" type="checkbox" checked> Show backtest dashboard</label>',
      )
      .replace('<label>Swing Length<input id="smart-swing" type="number" min="2" max="100" value="5"></label>', '<input id="smart-swing" type="hidden" value="5">')
      .replace('ATR Length<input id="smart-atr" type="number" min="1" max="100" value="14">', 'ATR Length<input id="smart-atr" type="number" min="1" max="100" value="14">')
      .replace('Zone Size ATR<input id="smart-zone" type="number" min="0.1" step="0.1" value="0.5">', 'Stop ATR multiplier<input id="smart-zone" type="number" min="0.1" step="0.1" value="1.5">')
      .replace('TP1 RR<input id="smart-tp1" type="number" min="0.1" step="0.1" value="1">', 'TP1 R<input id="smart-tp1" type="number" min="0.1" step="0.1" value="0.5">')
      .replace('TP2 RR', 'TP2 R')
      .replace('TP3 RR', 'TP3 R')
      .replace('id="smart-tp2" type="number" min="0.1" step="0.1" value="2"', 'id="smart-tp2" type="number" min="0.1" step="0.1" value="1"')
      .replace('id="smart-tp3" type="number" min="0.1" step="0.1" value="3"', 'id="smart-tp3" type="number" min="0.1" step="0.1" value="1.5"')
      .replace('<label><input id="smart-zones" type="checkbox" checked> Zones BUY / SELL</label>', '<label hidden><input id="smart-zones" type="checkbox"> Zones BUY / SELL</label>')
      .replace('Lignes de tendance', 'EMA 21 / EMA 50')
      .replace(
        '<input id="show-heatmap" type="checkbox" checked>',
        '<input id="show-heatmap" type="checkbox">',
      );
  } else if (path === "/portal.js") {
    body = configureIndicators(body);
  } else if (path === "/smart.js") {
    body = plannerEngine;
  } else if (path === "/indicator.js") {
    body = body
      .replace('Intelligente BUY- & SELL-Zonen + TP Engine V2', 'Signal Trade Planner Strategy')
      .replace('Smart: vorläufige Signale bis zum Kerzenschluss', 'Trade Planner: Signale nach Kerzenschluss')
      .replace("'Smart: '+smart.signals.length+' Signale · offene Kerze: vorläufiges Signal'", "'Trade Planner: '+smart.signals.length+' bestätigte Signale'")
      .replace("'● Smart Buy / Sell · TP Engine V2'", "'● Signal Trade Planner · EMA 21/50 · RSI'")
      .replace('step=(pw-(smartOn?135:0))/(count+space)', 'step=(pw-34)/(count+Math.min(space,3))')
      .replace('right=82,top=20,bottom=30,pw=W-right', 'right=82,top=20,bottom=48,pw=W-right')
      .replace(
        'const tickCount=Math.max(2,Math.min(6,Math.floor(pw/120)+1));for(let j=0;j<tickCount;j++){const i=start+Math.floor(j*(count-1)/(tickCount-1)),tx=j===0?4:j===tickCount-1?pw-4:x(i),anchor=j===0?"start":j===tickCount-1?"end":"middle";s+=`<text x="${tx}" y="${H-8}" text-anchor="${anchor}" fill="#999" font-size="12">${new Date(sourceBars[i].time).toISOString().slice(5,16).replace(\'T\',\' \')}</text>`}',
        `s+=\`<line x1="0" y1="\${H-bottom}" x2="\${pw}" y2="\${H-bottom}" stroke="#2b2e36"/>\`;for(let j=0;j<count;j++){const i=start+j,date=new Date(sourceBars[i].time),previous=i>0?new Date(sourceBars[i-1].time):null,newDay=!previous||date.getUTCDate()!==previous.getUTCDate()||date.getUTCMonth()!==previous.getUTCMonth(),tx=x(i),time=String(date.getUTCHours()).padStart(2,'0')+':'+String(date.getUTCMinutes()).padStart(2,'0'),rotate=step<44;s+=rotate?\`<text x="\${tx}" y="\${H-7}" transform="rotate(-55 \${tx} \${H-7})" text-anchor="start" fill="#aeb2ba" font-size="9">\${time}</text>\`:\`<text x="\${tx}" y="\${H-7}" text-anchor="middle" fill="#aeb2ba" font-size="10">\${time}</text>\`;if(newDay){const months=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'],dateText=date.getUTCDate()+' '+months[date.getUTCMonth()]+' \\''+String(date.getUTCFullYear()).slice(-2),boxWidth=74,boxX=Math.max(2,Math.min(pw-boxWidth,tx-boxWidth/2));s+=\`<line x1="\${tx}" y1="\${top}" x2="\${tx}" y2="\${H-bottom}" stroke="#343842" stroke-dasharray="2 4"/><rect x="\${boxX}" y="\${H-bottom+3}" width="\${boxWidth}" height="21" rx="5" fill="#292c33" stroke="#414550"/><text x="\${boxX+boxWidth/2}" y="\${H-bottom+17}" text-anchor="middle" fill="#f1f3f5" font-size="10" font-weight="600">\${dateText}</text>\`}}`,
      );
  }

  const headers = new Headers(response.headers);
  headers.delete("content-length");
  headers.delete("etag");
  return new Response(body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

async function yahooGoldFallback(request) {
  const interval = new URL(request.url).searchParams.get("interval") || "15min";
  const binanceInterval = { "1min": "1m", "5min": "5m", "15min": "15m", "30min": "30m", "1h": "1h" }[interval];
  if (!binanceInterval) return null;

  const url = "https://api.binance.com/api/v3/klines?symbol=PAXGUSDT&interval=" + binanceInterval + "&limit=1000";
  const upstream = await fetch(url, { headers: { Accept: "application/json" } });
  if (!upstream.ok) throw new Error("Binance gold fallback unavailable");
  const rows = await upstream.json();
  if (!Array.isArray(rows)) throw new Error("Binance gold fallback returned no candles");

  const duration = { "1min": 60000, "5min": 300000, "15min": 900000, "30min": 1800000, "1h": 3600000 }[interval];
  const now = Date.now();
  const bars = rows.map(row => ({
    time: Number(row[0]),
    open: Number(row[1]),
    high: Number(row[2]),
    low: Number(row[3]),
    close: Number(row[4]),
    volume: Number(row[5] || 0),
    closed: Number(row[0]) + duration <= now,
  })).filter(bar => [bar.time, bar.open, bar.high, bar.low, bar.close].every(Number.isFinite));
  if (bars.length < 41) throw new Error("Binance gold fallback returned insufficient candles");

  return Response.json({
    symbol: "XAU/USD",
    interval,
    source: "Binance · PAXG/USDT fallback",
    volumeMode: "provider",
    fetchedAt: now,
    bars: bars.slice(-1000),
  }, { headers: { "cache-control": "public, s-maxage=30, stale-while-revalidate=300" } });
}

export default async function handler(request) {
  const path = requestedPath(request);
  const response = await worker.fetch(createWorkerRequest(request), {
    TWELVEDATA_API_KEY: process.env.TWELVEDATA_API_KEY,
  });
  if (path === "/api/gold" && response.status === 503) {
    try {
      const fallback = await yahooGoldFallback(request);
      if (fallback) return fallback;
    } catch (error) {
      console.error("[gold-fallback]", String(error));
      return Response.json({ error: "market data unavailable" }, { status: 503 });
    }
  }
  return customizeResponse(response, path);
}
