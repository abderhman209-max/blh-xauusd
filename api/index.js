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
 const fastLength=21,slowLength=50,rsiLength=14,rsiThreshold=52,atrMultiplier=1.5,minSeparation=.05,minBody=.10;
 const result={sides:[],signals:[],fast:[],slow:[]};if(bars.length<slowLength+2)return result;
 const ema=(length,out)=>{const k=2/(length+1);let value=bars[0].close;for(let i=0;i<bars.length;i++){value=i?bars[i].close*k+value*(1-k):value;out[i]=value}};
 ema(fastLength,result.fast);ema(slowLength,result.slow);
 let atr=null,atrSum=0,avgGain=null,avgLoss=null,gainSum=0,lossSum=0;const atrs=[],rsis=[];
 for(let i=0;i<bars.length;i++){
  const b=bars[i],p=bars[i-1],tr=p?Math.max(b.high-b.low,Math.abs(b.high-p.close),Math.abs(b.low-p.close)):b.high-b.low;
  atrSum+=tr;if(i===atrLength-1)atr=atrSum/atrLength;else if(i>=atrLength)atr=(atr*(atrLength-1)+tr)/atrLength;atrs[i]=atr;
  if(i){const change=b.close-p.close,gain=Math.max(change,0),loss=Math.max(-change,0);if(i<=rsiLength){gainSum+=gain;lossSum+=loss;if(i===rsiLength){avgGain=gainSum/rsiLength;avgLoss=lossSum/rsiLength}}else{avgGain=(avgGain*(rsiLength-1)+gain)/rsiLength;avgLoss=(avgLoss*(rsiLength-1)+loss)/rsiLength}if(avgGain!==null)rsis[i]=avgLoss===0?100:100-100/(1+avgGain/avgLoss)}
 }
 const latest={};let lastSignal=-100;
 for(let i=slowLength+1;i<bars.length;i++){
  const b=bars[i],p=bars[i-1],a=atrs[i],rsi=rsis[i];if(!a||!Number.isFinite(rsi)||i-lastSignal<=3)continue;
  const crossLong=result.fast[i]>result.slow[i]&&result.fast[i-1]<=result.slow[i-1],crossShort=result.fast[i]<result.slow[i]&&result.fast[i-1]>=result.slow[i-1];
  const pullLong=result.fast[i]>result.slow[i]&&b.close>result.fast[i]&&p.close<=result.fast[i-1]&&rsi>rsiThreshold;
  const pullShort=result.fast[i]<result.slow[i]&&b.close<result.fast[i]&&p.close>=result.fast[i-1]&&rsi<100-rsiThreshold;
  const separation=Math.abs(result.fast[i]-result.slow[i])/a,body=Math.abs(b.close-b.open)/a;
  const longSignal=crossLong||(pullLong&&separation>=minSeparation&&b.close>b.open&&body>=minBody);
  const shortSignal=crossShort||(pullShort&&separation>=minSeparation&&b.close<b.open&&body>=minBody);
  if(!longSignal&&!shortSignal)continue;const direction=longSignal?1:-1,entry=b.close,risk=a*Math.max(.1,zone),stop=entry-direction*risk;
  const plan={direction,index:i,top:entry+a*.04,bottom:entry-a*.04,secondTop:entry+a*.04,secondBottom:entry-a*.04,entry,stop,tps:rr.map(v=>entry+direction*risk*v),trend:{a:{index:Math.max(0,i-20),price:result.slow[Math.max(0,i-20)]},b:{index:i+25,price:result.slow[i]}}};
  latest[direction]=plan;result.signals.push({index:i,direction,price:direction===1?b.low:b.high});lastSignal=i;
 }
 result.sides=Object.values(latest);return result;
}};
if(typeof module!=='undefined')module.exports=SmartEngine;
function renderSmart(model,x,y,width,height,layer='all'){
 const enabled=id=>document.querySelector(id)?.checked!==false;let shapes='<g data-indicator="planner">',labels='<g data-indicator="planner-labels">';
 const path=(values,color)=>{let d='';for(let i=0;i<values.length;i++){if(!Number.isFinite(values[i]))continue;const xx=x(i);if(xx<0||xx>width)continue;d+=(d?' L ':'M ')+xx+' '+y(values[i])}return d?'<path d="'+d+'" fill="none" stroke="'+color+'" stroke-width="1.7" opacity=".9"/>':''};
 if(enabled('#smart-trend')){shapes+=path(model.fast,'#00d9ff')+path(model.slow,'#8b5cf6')}
 for(const z of model.sides){const color=z.direction===1?'#089981':'#f23645',name=z.direction===1?'BUY':'SELL',left=x(z.index),right=Math.min(width-4,x(z.index+25));if(right<0||left>width)continue;
  shapes+='<line x1="'+left+'" y1="'+y(z.entry)+'" x2="'+right+'" y2="'+y(z.entry)+'" stroke="#5b9cf6" stroke-width="2"/><line x1="'+left+'" y1="'+y(z.stop)+'" x2="'+right+'" y2="'+y(z.stop)+'" stroke="#f23645" stroke-dasharray="6 4" stroke-width="2"/>';
  if(enabled('#smart-tps'))z.tps.forEach((price,i)=>{shapes+='<line x1="'+left+'" y1="'+y(price)+'" x2="'+right+'" y2="'+y(price)+'" stroke="#8b5cf6" stroke-dasharray="5 4"/>';labels+='<text x="'+Math.max(4,right-46)+'" y="'+(y(price)-5)+'" fill="#c4a7ff" font-size="11">TP'+(i+1)+' '+price.toFixed(2)+'</text>'});
  labels+='<text x="'+Math.max(4,left+3)+'" y="'+(y(z.entry)-7)+'" fill="#69a8ff" font-size="11">ENTRY '+z.entry.toFixed(2)+'</text><text x="'+Math.max(4,right-52)+'" y="'+(y(z.stop)-5)+'" fill="#f23645" font-size="11">SL '+z.stop.toFixed(2)+'</text>';
 }
 if(enabled('#smart-signals'))for(const signal of model.signals){const xx=x(signal.index);if(xx<0||xx>width)continue;const up=signal.direction===1,yy=y(signal.price),color=up?'#089981':'#f23645',name=up?'BUY':'SELL';labels+='<g><path d="M '+(xx-6)+' '+(yy+(up?10:-10))+' L '+xx+' '+yy+' L '+(xx+6)+' '+(yy+(up?10:-10))+'" fill="'+color+'"/><rect x="'+(xx-20)+'" y="'+(yy+(up?10:-34))+'" width="40" height="22" rx="4" fill="'+color+'"/><text x="'+xx+'" y="'+(yy+(up?25:-19))+'" text-anchor="middle" fill="white" font-size="10">'+name+'</text></g>'}
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
      .replace('Swing Length<input id="smart-swing" type="number" min="2" max="100" value="5">', 'Signal mode<input value="Hybrid" disabled><input id="smart-swing" type="hidden" value="5">')
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
      .replace("'● Smart Buy / Sell · TP Engine V2'", "'● Signal Trade Planner · EMA 21/50 · RSI'");
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

export default async function handler(request) {
  const response = await worker.fetch(createWorkerRequest(request), {
    TWELVEDATA_API_KEY: process.env.TWELVEDATA_API_KEY,
  });
  return customizeResponse(response, requestedPath(request));
}
