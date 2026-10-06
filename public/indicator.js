let sourceBars=[],selectedInterval='5min',selectedSymbol='XAU/USD';const intervalLabels={'1min':'1 min','5min':'5 min','15min':'15 min','30min':'30 min','1h':'1 h'},marketLabels={'XAU/USD':'Gold / US-Dollar','BTC/USD':'Bitcoin / US-Dollar'},marketSources={'XAU/USD':'Twelve Data','BTC/USD':'Coinbase'};
document.documentElement.lang='de';document.title='PIPVORIA — Goldmarkt im Blick';
function germanUI(){
 const structureLabel=document.querySelector('#term')?.closest('label');const structureText=structureLabel&&[...structureLabel.childNodes].find(n=>n.nodeType===3&&n.textContent.trim());if(structureText)structureText.textContent='Struktur';
 const text=(selector,value)=>{const node=document.querySelector(selector);if(node)node.textContent=value},label=(id,value)=>{const node=document.querySelector(id)?.closest('label');const child=node&&[...node.childNodes].find(n=>n.nodeType===3&&n.textContent.trim());if(child)child.textContent=(node.firstElementChild?.id===id?' ':'')+value},tool=(id,title)=>{const node=document.querySelector(id);if(node){node.title=title;node.setAttribute('aria-label',title)}};
 text('.settings summary','⚙ Indikatoren');label('#show-structure','Marktstruktur & Fibonacci + CRV');label('#rr','Risiko / Ertrag');label('#valid','Ersetzte Setups ohne Einstieg ausblenden');label('#show-smart','Signal Trade Planner Strategy');label('#smart-swing','Swing-Länge');label('#smart-atr','ATR-Länge');label('#smart-zone','ATR-Zonengröße');label('#smart-tp1','TP1 CRV');label('#smart-tp2','TP2 CRV');label('#smart-tp3','TP3 CRV');label('#smart-zones','BUY- / SELL-Zonen');label('#smart-tps','TP1 / TP2 / TP3');label('#smart-signals','BUY- / SELL-Signale');label('#smart-trend','Trendlinien');label('#show-heatmap','Volumetrische Regressions-Heatmap');label('#heat-source','Quelle');label('#heat-base','Basisperiode');label('#heat-bins','Rasterzeilen je Seite');label('#heat-smoothing','Verlaufsglättung');label('#heat-band','Signalband (SD)');label('#heat-threshold','Schwellenwert für flache Steigung');label('#heat-extension','Projektion in die Zukunft');label('#heat-lineWidth','Heatmap-Linienbreite');label('#heat-profileWidth','Profilbreite');label('#heat-deltaScale','Delta-Höhe');label('#heat-deltaWidth','Delta-Breite');label('#heat-dynamic','Dynamische Periode');label('#heat-signals','Mittelwert-Rückkehrsignale');label('#heat-profile','Volumenprofil');label('#heat-delta','Delta-Histogramme');
 const terms=document.querySelectorAll('#term option');[['Short','Kurz'],['Mid','Mittel'],['Long','Lang']].forEach(([value,name],i)=>{if(terms[i]){terms[i].value=value;terms[i].textContent=name}});const sources=document.querySelectorAll('#heat-source option');if(sources[0]){sources[0].value='hl2';sources[0].textContent='Hoch/Tief-Mittel'}if(sources[1]){sources[1].value='close';sources[1].textContent='Schlusskurs'}
 const ps=document.querySelectorAll('.settings p');if(ps[0])ps[0].textContent='Für XAU/USD nutzt die Heatmap die Kerzenaktivität und ergänzt sie mit den direkt empfangenen Live-Ticks. Die Signale werden über das gesamte Fenster neu berechnet.';if(ps[1])ps[1].textContent='BOS nutzt geschlossene Kerzen. Smart bezieht die offene Kerze ein; Signale können sich bis zum Kerzenschluss ändern.';
 const heading=document.querySelector('.chart-heading strong')?.firstChild;if(heading)heading.textContent='Gold / US-Dollar ';text('#chart-empty','Kerzen werden geladen…');
 const bottom=document.querySelector('.chart-bottom > span:last-child');if(bottom){bottom.firstChild.textContent='UTC · ';bottom.lastChild.textContent=' · Trade Planner: Signale nach Kerzenschluss'}
 document.querySelector('.frames')?.setAttribute('aria-label','Chart-Zeitrahmen');document.querySelector('.drawing-tools')?.setAttribute('aria-label','Chart-Werkzeuge');tool('#full-screen','Vollbild');tool('#cursor-tool','Cursor / Verschieben');tool('#line-tool','Horizontale Linie hinzufügen');tool('#trend-tool','Trendlinie: zwei Punkte');tool('#zoom-in','Vergrößern');tool('#zoom-out','Verkleinern');tool('#reset-view','Ansicht zurücksetzen');tool('#delete-line','Letzte Linie dieses Zeitrahmens löschen');
 const svg=document.querySelector('#structure-chart');if(svg)svg.setAttribute('aria-label','XAU/USD-Chart mit Kerzen, BOS, Fibonacci sowie Risiko und Ertrag.');text('#feed-status','Verbindung…');text('#candle-state','Wird geladen…');text('#feed-update','Verbindung zu Twelve Data…');text('#tool-status','Mausrad: Zoom · Ziehen: Verschieben · Rechte Achse: Preisskala · Doppelklick: automatische Skala');
 const switcher=document.createElement('div');switcher.className='symbol-switcher';switcher.setAttribute('aria-label','Markt auswählen');switcher.innerHTML='<button type="button" data-symbol="XAU/USD" class="active">XAU/USD</button><button type="button" data-symbol="BTC/USD">BTC/USD</button>';document.querySelector('.logo').after(switcher);
}
germanUI();
let viewCount=80,viewOffset=0,chartScale=null,lineMode=false,manualLevels={},drag=null,viewInitialized=false;
let priceView=null,trendMode=false,trendStart=null,trendLines={};
let lastWorkspaceStateKey='';
const feedMeta={receivedAt:0,error:true,reason:null};
document.addEventListener('blh-language-change',()=>{if(feedMeta.error&&!sourceBars.length&&feedMeta.reason)document.querySelector('#chart-empty').textContent=PIPVORIA_FEED.text(feedMeta.reason,document.documentElement.lang)});
const modelMemo=new Map();
function analyzeCached(name,options,run){const controls=JSON.stringify([...document.querySelectorAll('#indicator-controls input,#indicator-controls select')].map(n=>[n.id,n.type==='checkbox'?n.checked:n.value]));const key=JSON.stringify([selectedSymbol,selectedInterval,options,controls,window.PIPVORIA_SETTINGS?.get().confirmedOnly]);const cached=modelMemo.get(name);if(cached?.bars===sourceBars&&cached.key===key)return cached.value;const value=run();modelMemo.set(name,{bars:sourceBars,key,value});return value;}
function performanceEnabled(){return Object.fromEntries([['structure','show-structure'],['planner','show-smart'],['blh','show-blh-clean'],['pa','show-pa-liquidity']].map(([key,id])=>[key,!!document.getElementById(id)?.checked]));}
function resetWorkspaceState(){window.PIPVORIA_CHART_STATE={symbol:selectedSymbol,interval:selectedInterval,source:marketSources[selectedSymbol],signal:null,price:null,stale:true,receivedAt:0,feedError:feedMeta.reason,indicatorResults:PIPVORIA_INDICATOR_PERFORMANCE.build({enabled:performanceEnabled(),symbol:selectedSymbol,interval:selectedInterval})};document.dispatchEvent(new CustomEvent('pipvoria-chart-state',{detail:window.PIPVORIA_CHART_STATE}));}

try{const saved=JSON.parse(localStorage.getItem('blh-drawings')||'{}');manualLevels=saved.levels||{};trendLines=saved.trends||{}}catch{}
const drawingKey=()=>selectedSymbol+'|'+selectedInterval;
function saveDrawings(){try{localStorage.setItem('blh-drawings',JSON.stringify({levels:manualLevels,trends:trendLines}))}catch{document.querySelector('#tool-status').textContent='Speicher nicht verfügbar: Zeichnungen bleiben für diese Sitzung erhalten.'}}
const svgNode=document.querySelector('#structure-chart');
function publishWorkspaceState(smart,blh,bars,indicatorResults){
 const smartPlan=smart?.sides?.at(-1)||null,blhPlan=blh?.plan||null,last=bars.at(-1)||null;
 const useBlh=!!blhPlan&&(!smartPlan||blhPlan.index>=smartPlan.index);
 const plan=useBlh?blhPlan:smartPlan,latestSignal=useBlh?blh?.signals?.at(-1):smart?.signals?.at(-1);
 const signalTime=plan?(latestSignal?.time||plan.time||bars[plan.index]?.time||null):null;
 const engine=useBlh?'blh':'planner',finished=!useBlh&&plan?smart?.trades?.find(t=>t.index===plan.index):null;
 const initialRisk=useBlh?Math.abs(plan?.entry-plan?.stop):smart?.active?.initialRisk||finished?.initialRisk||Math.abs(plan?.entry-plan?.stop);const live=sourceBars.at(-1)||last,duration=PIPVORIA_CORE.intervals[selectedInterval];const state={symbol:selectedSymbol,interval:selectedInterval,source:marketSources[selectedSymbol],price:live?.close??null,bar:live,priority:document.querySelector('#planner-priority')?.value||'Stop first',receivedAt:feedMeta.receivedAt,feedError:feedMeta.reason,stale:feedMeta.error||Date.now()-feedMeta.receivedAt>120000,updatedAt:Date.now(),stats:smart?.stats||null,signal:plan?{key:[selectedSymbol,selectedInterval,engine,signalTime||plan.index,plan.direction].join('|'),engine,direction:plan.direction===1?'buy':'sell',status:useBlh?(plan.index>=bars.length-2?'active':'historical'):smart?.active&&smart.active.index===plan.index?'active':'historical',confirmed:!!bars[plan.index]&&bars[plan.index].closed!==false&&bars[plan.index].time+duration<=Date.now(),targetHits:useBlh?[false,false,false]:smart?.active?.index===plan?.index?smart.active.reached:finished?.reached||[false,false,false],exitReason:finished?.reason||null,closedAt:finished?.closedAt||null,time:signalTime,entry:plan.entry,stopLoss:plan.stop,takeProfits:plan.tps.slice(0,3),riskReward:initialRisk>0?Math.abs((plan.tps.at(-1)-plan.entry)/initialRisk):null}:null};
 state.indicatorResults=indicatorResults;
 window.PIPVORIA_CHART_STATE=state;
 const nextKey=JSON.stringify([state.symbol,state.interval,state.price&&Number(state.price).toFixed(2),state.signal?.key,state.signal?.status,state.signal?.stopLoss,state.signal?.confirmed,state.stale,state.receivedAt,state.bar?.high,state.bar?.low,state.signal?.targetHits,state.signal?.exitReason,state.indicatorResults,state.feedError]);
 if(nextKey!==lastWorkspaceStateKey){lastWorkspaceStateKey=nextKey;document.dispatchEvent(new CustomEvent('pipvoria-chart-state',{detail:state}))}
}
function renderIndicator(){
 if(sourceBars.length<41){chartScale=null;publishWorkspaceState(null,null,[],PIPVORIA_INDICATOR_PERFORMANCE.build({enabled:performanceEnabled(),symbol:selectedSymbol,interval:selectedInterval}));return {mode:'unavailable'}}
 const term=document.querySelector('#term').value,rr=Number(document.querySelector('#rr').value),onlyValid=document.querySelector('#valid').checked;
 if(document.querySelector('#show-structure').checked&&(!Number.isFinite(rr)||rr<=0)){document.querySelector('#indicator-status').textContent='Das CRV muss größer als null sein.';resetWorkspaceState();return}
 const closedBars=sourceBars.filter(b=>b.closed!==false);
 const structureOn=document.querySelector('#show-structure').checked,smartOn=document.querySelector('#show-smart').checked;
 const model=structureOn?analyzeCached('structure',{term,rr,onlyValid},()=>StructureEngine.analyze(closedBars,{term,rr,onlyValid})):{setups:[],pivots:[],len:0};
 const number=(id,fallback,min,max=100)=>{const n=Number(document.querySelector(id).value);return Number.isFinite(n)&&n>=min&&n<=max?n:fallback};
 const smartBars=sourceBars.filter(b=>!b.partial&&(window.PIPVORIA_SETTINGS?.get().confirmedOnly===false||b.closed!==false&&b.time+PIPVORIA_CORE.intervals[selectedInterval]<=Date.now()));
 const smartOptions={swing:Math.floor(number('#smart-swing',5,2)),atrLength:Math.floor(number('#smart-atr',14,1)),zone:number('#smart-zone',.5,.1),rr:[1,2,3].map(i=>number('#smart-tp'+i,i,.1))};
 const smart=smartOn?analyzeCached('smart',{},()=>SmartEngine.analyze(smartBars,smartOptions)):{sides:[],signals:[]};
 const blhOn=document.querySelector('#show-blh-clean')?.checked&&selectedSymbol==='XAU/USD'&&selectedInterval==='5min';
 const blhOptions={
  swing:Math.floor(number('#blh-swing',4,2,20)),atrLength:Math.floor(number('#blh-atr',14,1,100)),
  emaLength:Math.floor(number('#blh-ema-length',50,1,200)),sweepWindow:Math.floor(number('#blh-sweep',5,1,50)),
  zoneBars:Math.floor(number('#blh-zone',30,1,100)),rr:[1,2,3].map(i=>number('#blh-rr'+i,i,.25,100))
 };
 const blh=blhOn?analyzeCached('blh',{},()=>BlhClean.analyze(smartBars,blhOptions)):null;
 const paOn=document.querySelector('#show-pa-liquidity')?.checked;
 const paOptions={
  pivotLength:Math.floor(number('#pa-pivot',5,2,50)),atrLength:Math.floor(number('#pa-atr',14,1,100)),
  tolerance:number('#pa-tolerance',.10,.01,1),rr:number('#pa-rr',2,.25,10),
  structure:document.querySelector('#pa-structure').checked,sweeps:document.querySelector('#pa-sweeps').checked,
  equalLevels:document.querySelector('#pa-equal').checked,tradeLevels:document.querySelector('#pa-levels').checked
 };
 const pa=paOn?analyzeCached('pa',{},()=>PALiquidity.analyze(closedBars,paOptions)):null;
 const paColors=paOn?{bull:document.querySelector('#pa-bull').value,bear:document.querySelector('#pa-bear').value,equal:document.querySelector('#pa-color').value}:null;
 const performanceBars=sourceBars.filter(b=>!b.partial&&b.closed!==false&&b.time+PIPVORIA_CORE.intervals[selectedInterval]<=Date.now());
 const performanceKey={last:performanceBars.at(-1)?.time,count:performanceBars.length};
 const resultModels={
  structure:structureOn?(performanceBars.length===closedBars.length&&!onlyValid?model:analyzeCached('structure-results',performanceKey,()=>StructureEngine.analyze(performanceBars,{term,rr,onlyValid:false}))):null,
  planner:smartOn?(performanceBars.length===smartBars.length?smart:analyzeCached('planner-results',performanceKey,()=>SmartEngine.analyze(performanceBars,smartOptions))):null,
  blh:blhOn?(performanceBars.length===smartBars.length?blh:analyzeCached('blh-results',performanceKey,()=>BlhClean.analyze(performanceBars,blhOptions))):null,
  pa:paOn?(performanceBars.length===closedBars.length?pa:analyzeCached('pa-results',performanceKey,()=>PALiquidity.analyze(performanceBars,paOptions))):null
 };
 publishWorkspaceState(smart,blh,smartBars,PIPVORIA_INDICATOR_PERFORMANCE.build({models:resultModels,bars:performanceBars,enabled:performanceEnabled(),symbol:selectedSymbol,interval:selectedInterval}));
 const demo=document.body.classList.contains('desk-demo'),demoSignal=window.PIPVORIA_CHART_STATE?.signal;
 const heatOn=document.querySelector('#show-heatmap').checked,heatOptions={source:document.querySelector('#heat-source').value};
 for(const input of document.querySelectorAll('[id^="heat-"]')){if(input.type==='checkbox')heatOptions[input.id.slice(5)]=input.checked;else if(input.type==='number'){const v=Number(input.value);heatOptions[input.id.slice(5)]=Number.isFinite(v)?Math.max(Number(input.min),Math.min(Number(input.max),v)):Number(input.defaultValue)}}
 for(const key of ['base','bins','smoothing','extension','lineWidth','profileWidth','deltaWidth'])heatOptions[key]=Math.round(heatOptions[key]);
 const heat=heatOn?analyzeCached('heat',heatOptions,()=>HeatmapEngine.analyze(smartBars,heatOptions)):null;
 const heatStatus=document.querySelector('#heat-status');heatStatus.hidden=!heatOn;
 if(heatOn)heatStatus.textContent=heat.error||((heatOptions.dashboard?'Heatmap · '+(heat.contraction?'Kontraktion':'Expansion')+' · '+(heat.slope>0?'Bullisch':'Bärisch')+' · '+heat.length+' Kerzen · Breite '+(heat.sd*6).toFixed(2)+' · ':'')+(!heat.hasVolume?'Nur Regressionskanal.':heat.maxVolume===0?'Keine Aktivität.':volumeMode==='provider'?'Volumen des Datenanbieters.':'Geschätzte Kerzenaktivität, ergänzt durch direkte Live-Ticks.')+' Historische Signale neu berechnet.');
 const W=Math.max(240,svgNode.clientWidth),H=Math.max(260,svgNode.clientHeight),right=82,top=20,bottom=48,pw=W-right;
 const count=Math.min(sourceBars.length,viewCount);viewOffset=Math.max(0,Math.min(sourceBars.length-count,viewOffset));const end=sourceBars.length-viewOffset,start=Math.max(0,end-count),shown=sourceBars.slice(start,end),space=heatOn&&!heat.error&&heat.hasVolume?Math.max(8,heat.extension+(heatOptions.profile?heatOptions.profileWidth:0)+2):8,step=pw/(Math.max(1,count)+4);
 let prices=shown.flatMap(b=>[b.high,b.low]);for(const s of model.setups)if(s.trade&&s.trade.end>=start&&s.trade.index<end)prices.push(s.trade.sl,s.trade.tp);
 for(const z of smart.sides)if(z.index+30>=start&&z.index-25<end){if(document.querySelector('#smart-zones').checked)prices.push(z.top,z.bottom,z.secondTop,z.secondBottom);if(document.querySelector('#smart-tps').checked)prices.push(...z.tps)}
 if(blh){const p=blh.plan,z=blh.zone;if(p&&p.end>=start&&p.index<end)prices.push(p.entry,p.stop,...p.tps);if(z&&z.end>=start&&z.index<end)prices.push(z.top,z.bottom)}
 if(pa?.plan&&pa.plan.index<end)prices.push(pa.plan.entry,pa.plan.stop,pa.plan.target);
 if(heatOn&&!heat.error){for(const index of [Math.max(start,heat.offset),Math.min(end+heat.extension,heat.offset+heat.length+heat.extension-1)]){const center=heat.start+heat.slope*(index-heat.offset);prices.push(center-3*heat.sd,center+3*heat.sd)}}
 if(demo){prices=shown.flatMap(b=>[b.high,b.low]);if(demoSignal)prices.push(demoSignal.entry,demoSignal.stopLoss,...demoSignal.takeProfits);}
 const low=Math.min(...prices),high=Math.max(...prices),range=Math.max(high-low,1),autoMin=low-range*.12,autoMax=high+range*.14,min=priceView?.min??autoMin,max=priceView?.max??autoMax;
 const x=i=>(i-start+.5)*step,y=p=>top+(max-p)/(max-min)*(H-top-bottom);
 chartScale={W,H,pw,min,max,top,bottom,start,end,step,x,y,space,plotWidth:step*(count+space)};svgNode.setAttribute('viewBox',`0 0 ${W} ${H}`);
 let s=`<defs><clipPath id="plot-area"><rect width="${pw}" height="${H-bottom}"/></clipPath></defs><line x1="${pw}" x2="${pw}" y2="${H}" stroke="#333"/>`;
 for(let j=0;j<9;j++){const p=min+(max-min)*j/8;s+=`<text x="${pw+8}" y="${y(p)+4}" fill="#adadad" font-size="12">${p.toFixed(2)}</text>`}
 s+='<g clip-path="url(#plot-area)">';
 if(document.body.dataset.dashboardLayout==='reference'){for(let j=0;j<=8;j++){const yy=top+j*(H-top-bottom)/8;s+=`<line x1="0" y1="${yy}" x2="${pw}" y2="${yy}" stroke="#27292e" stroke-width=".55"/>`}for(let j=0;j<=12;j++){const xx=j*pw/12;s+=`<line x1="${xx}" y1="${top}" x2="${xx}" y2="${H-bottom}" stroke="#27292e" stroke-width=".55"/>`}}
 if(!demo&&heatOn&&!heat.error)s+=renderHeatmap(heat,x,y,heatOptions);
 if(!demo)s+=renderSmart(smart,x,y,pw,H-bottom,"shapes");
 if(!demo&&blh)s+=renderBlhClean(blh,x,y,pw,H-bottom,"shapes");
 if(!demo&&pa)s+=renderPALiquidity(pa,x,y,pw,'shapes',paColors);
 s+='<g data-indicator="structure">';
 for(const z of demo?[]:model.setups){const c=z.direction===1?'#089981':'#f23645';s+=`<rect x="${x(z.origin.index)}" y="${y(z.top)}" width="${Math.max(2,x(z.end)-x(z.origin.index))}" height="${y(z.bottom)-y(z.top)}" fill="${c}" fill-opacity=".17" stroke="${c}" stroke-width=".65"/><line x1="${x(z.broken.index)}" y1="${y(z.broken.price)}" x2="${x(z.index)}" y2="${y(z.broken.price)}" stroke="${c}" stroke-width=".8" stroke-dasharray="5 3"/><text x="${x((z.broken.index+z.index)/2)}" y="${y(z.broken.price)-6}" fill="${c}" font-size="10">BOS</text>`;
 if(z.trade){const t=z.trade,xx=x(t.index),w=Math.max(step,x(t.end)-xx);for(const [a,b,c,label] of [[t.entry,t.sl,'#f23645','SL'],[t.entry,t.tp,'#089981','TP']])s+=`<rect x="${xx}" y="${y(Math.max(a,b))}" width="${w}" height="${Math.abs(y(a)-y(b))}" fill="${c}" fill-opacity=".20" stroke="${c}" stroke-width=".7"/><text x="${xx+3}" y="${y(b)-4}" fill="${c}" font-size="10">${label}</text>`;}
 }
 shown.forEach((b,j)=>{const i=start+j,c=demo?(b.close>=b.open?'#34d399':'#f87171'):document.body.dataset.dashboardLayout==='reference'?(b.close>=b.open?'#84ed43':'#ffe05b'):b.close>=b.open?(document.body.dataset.palette==='gold'?'#18c7a1':'#089981'):(document.body.dataset.palette==='gold'?'#606771':'#f23645'),w=Math.max(1,step*.55);s+=`<line x1="${x(i)}" y1="${y(b.high)}" x2="${x(i)}" y2="${y(b.low)}" stroke="${c}" stroke-width=".8"/><rect x="${x(i)-w/2}" y="${y(Math.max(b.open,b.close))}" width="${w}" height="${Math.max(1,Math.abs(y(b.open)-y(b.close)))}" fill="${c}"/>`});
 for(const p of demo?[]:model.pivots)if(p.index>=start-1&&p.index<=end+1)s+=`<text x="${x(p.index)-4}" y="${y(p.price)+(p.type==='high'?-7:14)}" fill="${p.type==='high'?'#087f71':'#a32b38'}" font-size="16">×</text>`;
 s+='</g>';
 if(!demo)s+=renderSmart(smart,x,y,pw,H-bottom,'labels');
 if(!demo&&blh)s+=renderBlhClean(blh,x,y,pw,H-bottom,'labels');
 if(!demo&&pa)s+=renderPALiquidity(pa,x,y,pw,'labels',paColors);
 const last=sourceBars.at(-1),lastColor=document.body.dataset.dashboardLayout==='reference'?(last.close>=last.open?'#84ed43':'#ffe05b'):document.body.dataset.palette==='gold'?'#18c7a1':last.close>=last.open?'#089981':'#f23645';s+=`<line x1="0" y1="${y(last.close)}" x2="${pw}" y2="${y(last.close)}" stroke="${lastColor}" stroke-dasharray="2 3"/>`;
 for(const p of demo?[]:manualLevels[drawingKey()]||[])s+=`<line x1="0" y1="${y(p)}" x2="${pw}" y2="${y(p)}" stroke="#ff7900" stroke-width="3"/>`;
 const duration={'1min':60000,'5min':300000,'15min':900000,'30min':1800000,'1h':3600000}[selectedInterval];
function timeX(t){let k=sourceBars.findIndex(b=>b.time>=t);if(k<0)k=sourceBars.length-1+(t-sourceBars.at(-1).time)/duration;else if(k>0&&sourceBars[k].time!==t)k=k-1+(t-sourceBars[k-1].time)/(sourceBars[k].time-sourceBars[k-1].time);return x(k)}
for(const t of demo?[]:trendLines[drawingKey()]||[])s+=`<line data-drawing="trend" x1="${timeX(t.a.time)}" y1="${y(t.a.price)}" x2="${timeX(t.b.time)}" y2="${y(t.b.price)}" stroke="#69a8ff" stroke-width="2"/><circle cx="${timeX(t.a.time)}" cy="${y(t.a.price)}" r="3" fill="#69a8ff"/><circle cx="${timeX(t.b.time)}" cy="${y(t.b.price)}" r="3" fill="#69a8ff"/>`;
if(!demo&&trendStart)s+=`<circle cx="${timeX(trendStart.time)}" cy="${y(trendStart.price)}" r="5" fill="#69a8ff"/>`;
if(demo&&demoSignal){const levels=[['ENTRY',demoSignal.entry,'#69a8ff'],['SL',demoSignal.stopLoss,'#f87171'],...demoSignal.takeProfits.map((p,i)=>['TP'+(i+1),p,'#34d399'])].sort((a,b)=>y(a[1])-y(b[1]));const from=Math.max(0,sourceBars.findIndex(b=>b.time>=demoSignal.time));let labelY=-100;for(const [label,price,color] of levels){labelY=Math.max(labelY+16,y(price)-5);s+=`<line data-demo-level="${label}" x1="${Math.max(0,x(from))}" x2="${pw}" y1="${y(price)}" y2="${y(price)}" stroke="${color}" stroke-width="1.5"/><text x="${Math.max(8,pw-130)}" y="${labelY}" fill="${color}" font-size="12">${label} ${price.toFixed(2)}</text>`;}}
s+='</g>';
 function priceTag(p,c){if(y(p)<0||y(p)>H-bottom)return '';return `<rect x="${pw}" y="${y(p)-10}" width="82" height="20" fill="${c}"/><text x="${pw+5}" y="${y(p)+4}" fill="white" font-size="12">${p.toFixed(2)}</text>`}
 for(const p of demo?[]:manualLevels[drawingKey()]||[])s+=priceTag(p,'#e76b00');
 if(y(last.close)>=0&&y(last.close)<=H-bottom)s+=`<g><rect x="${pw}" y="${y(last.close)-10}" width="82" height="36" fill="${lastColor}"/><text x="${pw+5}" y="${y(last.close)+4}" fill="${document.body.dataset.palette==='gold'?'#161300':'white'}" font-size="12">${last.close.toFixed(2)}</text><text id="candle-countdown" x="${pw+5}" y="${y(last.close)+19}" fill="${document.body.dataset.palette==='gold'?'#161300':'white'}" font-size="12" aria-label="Verbleibende Kerzenzeit">${candleCountdown()}</text></g>`;
 s+=`<line x1="0" y1="${H-bottom}" x2="${pw}" y2="${H-bottom}" stroke="#2b2e36"/>`;
 const labelEvery=Math.max(1,Math.ceil(70/step));let lastDateX=-100;
 for(let j=0;j<shown.length;j++){const i=start+j,date=new Date(sourceBars[i].time),previous=i>0?new Date(sourceBars[i-1].time):null,newDay=!previous||date.getUTCDate()!==previous.getUTCDate()||date.getUTCMonth()!==previous.getUTCMonth(),tx=x(i),time=String(date.getUTCHours()).padStart(2,'0')+':'+String(date.getUTCMinutes()).padStart(2,'0');
 if(j%labelEvery===0&&tx>25&&tx<pw-25)s+=`<text x="${tx}" y="${H-7}" text-anchor="middle" fill="#aeb2ba" font-size="11">${time}</text>`;
 if(newDay&&tx-lastDateX>=82&&tx>32&&tx<pw-32){lastDateX=tx;const months=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'],dateText=date.getUTCDate()+' '+months[date.getUTCMonth()]+' \''+String(date.getUTCFullYear()).slice(-2),boxWidth=74,boxX=Math.max(2,Math.min(pw-boxWidth,tx-boxWidth/2));s+=`<line x1="${tx}" y1="${top}" x2="${tx}" y2="${H-bottom}" stroke="#343842" stroke-dasharray="2 4"/><rect x="${boxX}" y="${H-bottom+3}" width="${boxWidth}" height="21" rx="5" fill="#292c33" stroke="#414550"/><text x="${boxX+boxWidth/2}" y="${H-bottom+17}" text-anchor="middle" fill="#f1f3f5" font-size="10" font-weight="600">${dateText}</text>`}}
 s+='<g id="crosshair" visibility="hidden" pointer-events="none"><line id="cross-x" stroke="#999" stroke-dasharray="4 5"/><line id="cross-y" stroke="#999" stroke-dasharray="4 5"/><rect id="cross-bg" width="82" height="20" fill="#555"/><text id="cross-price" fill="white" font-size="12"/></g>';
 svgNode.innerHTML=s;document.querySelector('#chart-empty').hidden=true;document.querySelector('#chart-period').textContent=intervalLabels[selectedInterval];setOHLC(last);document.querySelector('#candle-state').textContent=last.closed?'Letzte Kerze geschlossen':'Kerze in Bildung';
 const trades=model.setups.filter(z=>z.trade),latest=trades.at(-1);document.querySelector('#indicator-status').textContent=`${model.setups.length} BOS · ${trades.length} Auslösungen · Pivots nach ${model.len} Kerzen bestätigt`;
 const tradeStatus=latest&&({'active':'aktiv','remplacé':'ersetzt','SL touché':'SL berührt','TP touché':'TP berührt','SL et TP touchés · ordre inconnu':'SL und TP berührt · Reihenfolge unbekannt'}[latest.trade.status]||latest.trade.status);document.querySelector('#setup-detail').innerHTML=latest?`<strong>Letztes historisches Signal · ${latest.direction===1?'Kauf':'Verkauf'}</strong><span>Einstieg ${latest.trade.entry.toFixed(2)}</span><span>SL ${latest.trade.sl.toFixed(2)}</span><span>TP ${latest.trade.tp.toFixed(2)}</span><span>CRV ${rr}</span><span>${tradeStatus}</span>`:'Keine Auslösung in den geladenen Kerzen.';
 document.querySelector('#indicator-status').textContent=(structureOn?'BOS: '+model.setups.length+' · ':'')+(smartOn?'Trade Planner: '+smart.signals.length+' bestätigte Signale':'')+(blhOn?' · BLH M5: '+blh.signals.length+' signaux':document.querySelector('#show-blh-clean')?.checked?' · BLH: choisir XAU/USD · 5 min':'')+(paOn?' · PA Liquidity: '+pa.events.length+' événements':'')+(heatOn?' · Regression aktiv':'')+(!structureOn&&!smartOn&&!paOn&&!blhOn&&!heatOn?'Indikatoren deaktiviert':'');
 if(!structureOn)document.querySelector('#setup-detail').textContent='';
 document.querySelector('.indicator-legend').textContent=[structureOn?'● BOS · Fibonacci · CRV':null,smartOn?'● Signal Trade Planner · EMA 21/50 · RSI':null,blhOn?'● BLH M5 · Sweep · BOS/CHoCH':null,paOn?'● PA Liquidity · BOS/CHoCH · EQH/EQL':null,heatOn?(heat.error?'● Regression wartet':heat.hasVolume&&heat.maxVolume>0?'● Volumetric Regression':'● Preiskanal · ohne Volumen'):null,'Manuelle Linien'].filter(Boolean).join('   |   ');
 return {mode:'market-data',term,rr,setups:model.setups.length,trades:trades.length};
}
function setOHLC(b){document.querySelector('#ohlc').textContent=`O ${b.open.toFixed(2)}  H ${b.high.toFixed(2)}  L ${b.low.toFixed(2)}  C ${b.close.toFixed(2)}`}
function candleCountdown(){
 const last=sourceBars.at(-1);if(!last)return '--:--';
 const duration={'1min':60000,'5min':300000,'15min':900000,'30min':1800000,'1h':3600000}[selectedInterval];
 const seconds=Math.max(0,Math.ceil((last.time+duration-Date.now())/1000));
 return String(Math.floor(seconds/60)).padStart(2,'0')+':'+String(seconds%60).padStart(2,'0');
}
setInterval(()=>{const label=document.querySelector('#candle-countdown');if(label)label.textContent=candleCountdown()},1000);
function clampZoomState(){
 const total=sourceBars.length||240,minBars=Math.min(12,total);viewCount=Math.max(minBars,Math.min(total,Math.round(viewCount)));viewOffset=Math.max(-Math.min(30,Math.ceil(viewCount*.4)),Math.min(Math.max(0,total-viewCount),Math.round(viewOffset)||0));
}
function safePriceView(min,max){
 const bars=sourceBars.slice(Math.max(0,sourceBars.length-viewOffset-viewCount),Math.max(0,sourceBars.length-viewOffset));if(!bars.length)return null;
 const low=Math.min(...bars.map(b=>b.low)),high=Math.max(...bars.map(b=>b.high)),dataRange=Math.max(high-low,Math.abs(high)*.0005,1),center=(min+max)/2,half=Math.max(dataRange*.08,Math.min(dataRange*40,(max-min)/2));
 if(!Number.isFinite(center)||!Number.isFinite(half))return null;return {min:center-half,max:center+half};
}
function defaultViewCount(){return Math.min(80,Math.max(24,Math.round((svgNode.clientWidth-82)/8)))}
function zoom(f){const center=sourceBars.length-viewOffset-viewCount/2;viewCount*=f;clampZoomState();viewOffset=sourceBars.length-center-viewCount/2;clampZoomState();renderIndicator()}
function setMode(on){trendMode=false;trendStart=null;document.querySelector("#trend-tool").classList.remove("active");lineMode=on;document.querySelector('#line-tool').classList.toggle('active',on);document.querySelector('#cursor-tool').classList.toggle('active',!on);document.querySelector('#tool-status').textContent=on?'In den Chart klicken, um die orange Linie zu platzieren.':'Mausrad: Zoom · Ziehen: Verschieben · ━: horizontale Linie setzen'}
document.querySelector('#zoom-in').onclick=()=>zoom(.8);document.querySelector('#zoom-out').onclick=()=>zoom(1.25);document.querySelector('#reset-view').onclick=()=>{viewCount=defaultViewCount();viewOffset=0;priceView=null;renderIndicator()};document.querySelector('#line-tool').onclick=()=>setMode(!lineMode);document.querySelector('#cursor-tool').onclick=()=>setMode(false);document.querySelector('#delete-line').onclick=()=>{if(trendMode)trendLines[drawingKey()]?.pop();else manualLevels[drawingKey()]?.pop();saveDrawings();renderIndicator()};
const fullScreenButton=document.querySelector('#full-screen');
const chartWorkspace=document.querySelector('#workspace');
const chartExitButton=document.querySelector('#exit-chart-fullscreen');
let chartHome=null,closingChartFullscreen=false;
function setFullScreenButton(active){fullScreenButton.classList.toggle('active',active);fullScreenButton.setAttribute('aria-pressed',String(active));fullScreenButton.querySelector('.fullscreen-icon').textContent=active?'×':'⛶'}
function syncChartRotation(){document.body.classList.toggle('chart-landscape-rotate',document.body.classList.contains('chart-landscape')&&matchMedia('(orientation: portrait) and (max-width: 900px)').matches);requestAnimationFrame(renderIndicator)}
async function exitChartLandscape(){
 if(closingChartFullscreen||!document.body.classList.contains('chart-landscape'))return;
 closingChartFullscreen=true;
 document.body.classList.remove('chart-landscape','chart-landscape-rotate');setFullScreenButton(false);
 try{screen.orientation?.unlock()}catch{}
 if(document.fullscreenElement===chartWorkspace)try{await document.exitFullscreen()}catch{}
 if(chartHome?.parentNode)chartHome.replaceWith(chartWorkspace);
 chartHome=null;closingChartFullscreen=false;requestAnimationFrame(renderIndicator);
}
async function enterChartLandscape(){
 if(document.body.classList.contains('chart-landscape'))return;
 chartHome=document.createComment('chart workspace home');chartWorkspace.replaceWith(chartHome);document.body.append(chartWorkspace);
 document.body.classList.add('chart-landscape');setFullScreenButton(true);syncChartRotation();
 // iPhone Safari uses the fixed chart layer; native fullscreen can hide the rotated SVG.
 const ios=/iPad|iPhone|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
 try{if(!ios&&chartWorkspace.requestFullscreen&&!document.fullscreenElement)await chartWorkspace.requestFullscreen()}catch{}
 try{await screen.orientation?.lock?.('landscape')}catch{}
 if(document.body.classList.contains('chart-landscape'))syncChartRotation();
}
fullScreenButton.onclick=()=>document.body.classList.contains('chart-landscape')?exitChartLandscape():enterChartLandscape();
chartExitButton.onclick=exitChartLandscape;
document.addEventListener('fullscreenchange',()=>{if(!document.fullscreenElement&&document.body.classList.contains('chart-landscape')&&!closingChartFullscreen)exitChartLandscape();requestAnimationFrame(renderIndicator)});
window.addEventListener('orientationchange',()=>{if(document.body.classList.contains('chart-landscape'))syncChartRotation()});
function chartPoint(event){
 const rect=svgNode.getBoundingClientRect(),W=chartScale?.W||svgNode.clientWidth,H=chartScale?.H||svgNode.clientHeight;
 if(document.body.classList.contains('chart-landscape-rotate'))return {x:(event.clientY-rect.top)/rect.height*W,y:(rect.right-event.clientX)/rect.width*H};
 return {x:(event.clientX-rect.left)/rect.width*W,y:(event.clientY-rect.top)/rect.height*H};
}
svgNode.addEventListener('wheel',e=>{e.preventDefault();if(!chartScale)return;const c=chartScale,xx=chartPoint(e).x;if(xx>c.pw){const center=(c.min+c.max)/2,half=(c.max-c.min)/2*(e.deltaY>0?1.12:.88);priceView=safePriceView(center-half,center+half);renderIndicator();}else{const anchor=c.start+Math.max(0,Math.min(c.pw,xx))/c.step,oldCount=viewCount,ratio=Math.max(0,Math.min(1,(anchor-c.start)/Math.max(1,oldCount)));viewCount*=e.deltaY>0?1.12:.88;clampZoomState();const newStart=anchor-ratio*viewCount;viewOffset=sourceBars.length-(newStart+viewCount);clampZoomState();priceView=null;renderIndicator()}},{passive:false});
for(const name of ['gesturestart','gesturechange','gestureend'])svgNode.addEventListener(name,event=>{event.preventDefault();event.stopPropagation()},{passive:false});
svgNode.addEventListener('touchmove',event=>{if(event.touches.length>1)event.preventDefault()},{passive:false});
const activePointers=new Map();let pinch=null;
let lastGestureRender=0,gestureTimer=0;
function renderGesture(){
 const elapsed=performance.now()-lastGestureRender;
 if(elapsed>=85){clearTimeout(gestureTimer);gestureTimer=0;lastGestureRender=performance.now();renderIndicator()}
 else if(!gestureTimer)gestureTimer=setTimeout(()=>{gestureTimer=0;lastGestureRender=performance.now();renderIndicator()},85-elapsed);
}
svgNode.addEventListener('pointerdown',e=>{if(!chartScale)return;activePointers.set(e.pointerId,{x:e.clientX,y:e.clientY});if(activePointers.size===2){drag=null;const points=[...activePointers.values()],distance=Math.hypot(points[1].x-points[0].x,points[1].y-points[0].y),midpoint=chartPoint({clientX:(points[0].x+points[1].x)/2,clientY:(points[0].y+points[1].y)/2}),ratio=Math.max(0,Math.min(1,midpoint.x/chartScale.pw));pinch={distance,viewCount,anchor:chartScale.start+midpoint.x/chartScale.step,ratio};svgNode.setPointerCapture(e.pointerId);return}const {x:xx,y:yy}=chartPoint(e);if(yy>chartScale.H-chartScale.bottom)return;
if(xx>chartScale.pw){drag={kind:'scale',y:yy,min:chartScale.min,max:chartScale.max};svgNode.setPointerCapture(e.pointerId);return}
if(trendMode){const c=chartScale,i=Math.max(0,Math.min(sourceBars.length-1,Math.round(xx/c.step+c.start-.5))),point={time:sourceBars[i].time,price:c.max-(yy-c.top)/(c.H-c.top-c.bottom)*(c.max-c.min)};if(!trendStart){trendStart=point;document.querySelector('#tool-status').textContent='Klicken, um den zweiten Punkt zu setzen.'}else{(trendLines[drawingKey()]??=[]).push({a:trendStart,b:point});saveDrawings();trendStart=null;document.querySelector('#tool-status').textContent='Linie gespeichert. Klicken, um eine neue Linie zu beginnen.'}renderIndicator();return}
 if(lineMode){const c=chartScale,p=c.max-(yy-c.top)/(c.H-c.top-c.bottom)*(c.max-c.min);(manualLevels[drawingKey()]??=[]).push(p);saveDrawings();setMode(false);renderIndicator();return}drag={kind:'pan',x:xx,y:yy,offset:viewOffset,min:chartScale.min,max:chartScale.max,step:chartScale.step,height:chartScale.H-chartScale.top-chartScale.bottom};svgNode.setPointerCapture(e.pointerId)});
svgNode.addEventListener('pointerup',e=>{activePointers.delete(e.pointerId);if(activePointers.size<2)pinch=null;drag=null});svgNode.addEventListener('pointercancel',e=>{activePointers.delete(e.pointerId);pinch=null;drag=null});
svgNode.addEventListener('pointermove',e=>{if(!chartScale)return;if(activePointers.has(e.pointerId))activePointers.set(e.pointerId,{x:e.clientX,y:e.clientY});if(pinch&&activePointers.size>=2){const points=[...activePointers.values()],distance=Math.max(8,Math.hypot(points[1].x-points[0].x,points[1].y-points[0].y));viewCount=pinch.viewCount*pinch.distance/distance;clampZoomState();viewOffset=sourceBars.length-pinch.anchor-(1-pinch.ratio)*viewCount;clampZoomState();renderGesture();return}const {x:xx,y:yy}=chartPoint(e);if(drag){if(drag.kind==='scale'){const center=(drag.min+drag.max)/2,half=(drag.max-drag.min)/2*Math.exp(Math.max(-5,Math.min(5,(yy-drag.y)/200)));priceView=safePriceView(center-half,center+half)}else{viewOffset=drag.offset+(xx-drag.x)/drag.step;clampZoomState();const delta=(yy-drag.y)/drag.height*(drag.max-drag.min);priceView=safePriceView(drag.min+delta,drag.max+delta)}renderGesture();return}const c=chartScale,g=document.querySelector('#crosshair');if(!g)return;g.setAttribute('visibility',xx<c.pw?'visible':'hidden');const line=(id,a)=>{const n=document.querySelector(id);Object.entries(a).forEach(([k,v])=>n.setAttribute(k,v))};line('#cross-x',{x1:xx,x2:xx,y1:0,y2:c.H-c.bottom});line('#cross-y',{x1:0,x2:xx,y1:yy,y2:yy});line('#cross-bg',{x:c.pw,y:yy-10});line('#cross-price',{x:c.pw+5,y:yy+4});document.querySelector('#cross-price').textContent=(c.max-(yy-c.top)/(c.H-c.top-c.bottom)*(c.max-c.min)).toFixed(2);const b=sourceBars[Math.max(c.start,Math.min(sourceBars.length-1,c.end-1,Math.floor(xx/c.step+c.start)))];if(b)setOHLC(b)});
svgNode.addEventListener('pointerleave',()=>{document.querySelector('#crosshair')?.setAttribute('visibility','hidden');if(sourceBars.length)setOHLC(sourceBars.at(-1))});svgNode.addEventListener('keydown',e=>{if(e.key==='+'||e.key==='=')zoom(.8);else if(e.key==='-')zoom(1.2);else if(e.key==='ArrowLeft'){viewOffset+=15;renderIndicator()}else if(e.key==='ArrowRight'){viewOffset-=15;renderIndicator()}else return;e.preventDefault()});
new ResizeObserver(()=>renderIndicator()).observe(svgNode);document.querySelector('#indicator-controls').addEventListener('submit',event=>event.preventDefault());
document.querySelector('#indicator-controls').addEventListener('input',()=>{priceView=null;renderIndicator()});

let controller=null,requestId=0,historyBars=[],historyFetchedAt=0,volumeMode='activity-proxy-plus-live-ticks';
function prepareVolume(bars,mode){
 const provider=bars.every(b=>Number.isFinite(b.volume));
 if(!provider)bars.forEach((b,i)=>{if(Number.isFinite(b.volume))return;const previous=bars[i-1],range=Math.max(b.high-b.low,Math.abs(b.high-(previous?.close??b.open)),Math.abs(b.low-(previous?.close??b.open)),.001),body=Math.abs(b.close-b.open),efficiency=.65+.35*Math.min(1,body/range);b.volume=Math.max(1,Math.round(range*100*efficiency))});
 return mode||(provider?'provider':'activity-proxy-plus-live-ticks');
}
async function refreshGold(){
const id=++requestId,interval=selectedInterval,symbol=selectedSymbol;controller?.abort();controller=new AbortController();
try{
let data;if(symbol==='BTC/USD'){const bars=await CoinbaseMarket.history(interval,AbortSignal.any([controller.signal,AbortSignal.timeout(25000)]));data={symbol,interval,source:'Coinbase',volumeMode:'provider',fetchedAt:Date.now(),bars}}else{const response=await fetch('/api?route=gold&interval='+encodeURIComponent(interval),{credentials:'same-origin',signal:AbortSignal.any([controller.signal,AbortSignal.timeout(20000)])});if(response.status===401){document.dispatchEvent(new Event('blh-session-expired'));throw Object.assign(Error('Authentification requise'),{feedReason:'authentication_required'})}if(!response.ok){const failure=await response.json().catch(()=>({}));throw Object.assign(Error('Flux indisponible'),{feedReason:failure.reason})}data=await response.json()}
if(id!==requestId)return;
if(data.interval!==interval||!Array.isArray(data.bars)||data.bars.length<41)throw Error('Données invalides');historyBars=data.bars;historyFetchedAt=data.fetchedAt;feedMeta.receivedAt=data.fetchedAt||Date.now();feedMeta.error=false;feedMeta.reason=null;marketSources[symbol]=data.source||marketSources[symbol];volumeMode=prepareVolume(historyBars,data.volumeMode);sourceBars=GoldLive.merge(historyBars,interval,historyFetchedAt);if(!viewInitialized){viewCount=defaultViewCount();viewInitialized=true}renderIndicator();if(symbol==='XAU/USD')refreshGoldPrice();
const heading=document.querySelector('.chart-heading strong');heading.firstChild.textContent=marketLabels[symbol]+' ';heading.lastChild.textContent=' · '+marketSources[symbol];document.querySelector('#structure-chart').setAttribute('aria-label',symbol+'-Chart mit Kerzen, BOS, Fibonacci sowie Risiko und Ertrag.');const label=intervalLabels[interval],last=sourceBars.at(-1);document.querySelector('#feed-status').textContent=symbol+' · '+label+' · '+marketSources[symbol].toUpperCase();
document.querySelector('#feed-update').textContent=(last.closed?'Letzter Schlusskurs ':'Kerze in Bildung ')+label+': '+last.close.toFixed(2)+' USD · Kerze: '+new Date(last.time).toISOString().slice(0,16).replace('T',' ')+' UTC · Heatmap: '+(volumeMode==='provider'?'Volumen des Datenanbieters':'Kerzenaktivität + Live-Ticks')+' · Daten empfangen: '+new Date(data.fetchedAt).toLocaleTimeString('de-DE')+'.';
}catch(error){if(id!==requestId)return;feedMeta.error=true;feedMeta.reason=PIPVORIA_FEED.allowed(error?.feedReason)?error.feedReason:'provider_unavailable';if(!sourceBars.length)resetWorkspaceState();else renderIndicator();document.querySelector('#feed-status').textContent=sourceBars.length?'AKTUALISIERUNG FEHLGESCHLAGEN · VORHERIGE DATEN':'DATEN NICHT VERFÜGBAR';document.querySelector('#chart-empty').textContent=PIPVORIA_FEED.text(feedMeta.reason,document.documentElement.lang);document.querySelector('#feed-update').textContent=PIPVORIA_FEED.text(feedMeta.reason,document.documentElement.lang);}}
document.querySelectorAll('[data-interval]').forEach(button=>{button.setAttribute('aria-pressed',button.dataset.interval===selectedInterval);button.addEventListener('click',()=>{
if(button.dataset.interval===selectedInterval)return;selectedInterval=button.dataset.interval;sourceBars=[];historyBars=[];feedMeta.receivedAt=0;feedMeta.error=true;feedMeta.reason=null;resetWorkspaceState();chartScale=null;viewOffset=0;priceView=null;trendStart=null;document.querySelector("#ohlc").textContent="";document.querySelector("#chart-empty").hidden=false;document.querySelector("#chart-empty").textContent="Kerzen werden geladen…";document.querySelector("#chart-period").textContent=intervalLabels[selectedInterval];document.querySelector("#heat-status").hidden=true;
document.querySelectorAll('[data-interval]').forEach(b=>{b.classList.toggle('active',b===button);b.setAttribute('aria-pressed',b===button)});
document.querySelector('#structure-chart').replaceChildren();document.querySelector('#setup-detail').textContent='';document.querySelector('#indicator-status').textContent='';
document.querySelector('#feed-status').textContent='LADEN · '+intervalLabels[selectedInterval];document.querySelector('#feed-update').textContent='Kerzen werden abgerufen…';refreshGold();
})});
document.querySelectorAll('[data-symbol]').forEach(button=>button.addEventListener('click',()=>{if(button.dataset.symbol===selectedSymbol)return;selectedSymbol=button.dataset.symbol;controller?.abort();GoldLive.buckets.clear();GoldLive.last=null;CoinbaseMarket.stop();sourceBars=[];historyBars=[];feedMeta.receivedAt=0;feedMeta.error=true;feedMeta.reason=null;resetWorkspaceState();chartScale=null;viewOffset=0;priceView=null;trendStart=null;document.querySelector('#ohlc').textContent='';document.querySelector('#structure-chart').replaceChildren();document.querySelector('#chart-empty').hidden=false;document.querySelector('#chart-empty').textContent='Kerzen werden geladen…';document.querySelector('#setup-detail').textContent='';document.querySelector('#indicator-status').textContent='';document.querySelectorAll('[data-symbol]').forEach(b=>b.classList.toggle('active',b===button));document.title='Blh '+selectedSymbol.replace('/','')+' — Markt im Blick';if(selectedSymbol==='BTC/USD')CoinbaseMarket.start(handleCoinbaseTick);document.querySelector('#feed-status').textContent='LADEN · '+selectedSymbol+' · '+intervalLabels[selectedInterval];refreshGold()}));
if(window.BLH_AUTH?.authenticated){refreshGold();if(selectedSymbol==='BTC/USD')CoinbaseMarket.start(handleCoinbaseTick)}
document.addEventListener('blh-authenticated',()=>{refreshGold();if(selectedSymbol==='BTC/USD')CoinbaseMarket.start(handleCoinbaseTick)});
setInterval(()=>{if(!document.hidden&&window.BLH_AUTH?.authenticated)refreshGold()},60000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&window.BLH_AUTH?.authenticated){refreshGold();if(selectedSymbol==='BTC/USD')CoinbaseMarket.start(handleCoinbaseTick)}});

document.querySelector('#trend-tool').onclick=()=>{setMode(false);trendMode=true;document.querySelector('#trend-tool').classList.add('active');document.querySelector('#cursor-tool').classList.remove('active');document.querySelector('#tool-status').textContent='Zwei Punkte anklicken, um eine Trendlinie zu zeichnen. ⌫ löscht die letzte Trendlinie.'};
svgNode.addEventListener('dblclick',()=>{priceView=null;renderIndicator()});
svgNode.addEventListener('keydown',e=>{if(e.key==='Escape'){setMode(false);renderIndicator()}});

const isLocalFeed=location.hostname==='127.0.0.1'||location.hostname==='localhost',liveFeed=isLocalFeed?new EventSource('/api/stream'):null;
let quotePending=false;
async function refreshGoldPrice(){
 if(quotePending||selectedSymbol!=='XAU/USD'||document.hidden||!window.BLH_AUTH?.authenticated||!historyBars.length)return;
 quotePending=true;
 try{
  const response=await fetch('/api?route=gold/price',{credentials:'same-origin',cache:'no-store',signal:AbortSignal.timeout(12000)});
  if(response.status===401){document.dispatchEvent(new Event('blh-session-expired'));return}
  if(!response.ok){document.querySelector('#feed-update').textContent='Prix XAU/USD direct indisponible · Dernières bougies : '+marketSources['XAU/USD']+' · Synchronisation automatique en cours.';return}
  const data=await response.json(),price=Number(data.price),receivedAt=Number(data.receivedAt);
  if(selectedSymbol!=='XAU/USD'||!Number.isFinite(price)||!Number.isFinite(receivedAt)||Date.now()-receivedAt>60000)return;
  const tick={price,time:receivedAt,receivedAt};if(!GoldLive.add(tick))return;
  feedMeta.receivedAt=GoldLive.last?.receivedAt||Date.now();feedMeta.error=false;sourceBars=GoldLive.merge(historyBars,selectedInterval,historyFetchedAt);renderIndicator();
  document.querySelector('#feed-status').textContent='XAU/USD · '+intervalLabels[selectedInterval]+' · '+data.source.toUpperCase();
  document.querySelector('#feed-update').textContent='Prix actualisé : '+price.toFixed(2)+' USD · Reçu à '+new Date(receivedAt).toLocaleTimeString('fr-FR')+' · Historique synchronisé séparément.';
 }catch{}finally{quotePending=false}
}
setInterval(refreshGoldPrice,20000);
liveFeed?.addEventListener('price',event=>{
 let tick;try{tick=JSON.parse(event.data)}catch{return}
 if(selectedSymbol!=='XAU/USD')return;
 if(!GoldLive.add(tick)||!sourceBars.length)return;
 sourceBars=GoldLive.merge(historyBars,selectedInterval,historyFetchedAt);renderIndicator();
 document.querySelector('#feed-status').textContent='XAU/USD · '+intervalLabels[selectedInterval]+' · LIVE-FEED VERBUNDEN';
 document.querySelector('#feed-update').textContent='Preis empfangen: '+tick.price.toFixed(2)+' USD · Anbieterzeit: '+new Date(tick.time).toLocaleTimeString('de-DE',{timeZone:'UTC'})+' UTC · Empfangen: '+new Date(tick.receivedAt).toLocaleTimeString('de-DE')+(sourceBars.at(-1).partial?' · Teilkerze seit Verbindungsaufbau; Historie wird synchronisiert.':'');
});
function handleCoinbaseTick(tick){if(selectedSymbol!=='BTC/USD'||!GoldLive.add(tick)||!sourceBars.length)return;sourceBars=GoldLive.merge(historyBars,selectedInterval,historyFetchedAt);renderIndicator();document.querySelector('#feed-status').textContent='BTC/USD · '+intervalLabels[selectedInterval]+' · LIVE-FEED VERBUNDEN';document.querySelector('#feed-update').textContent='Preis empfangen: '+tick.price.toFixed(2)+' USD · Coinbase: '+new Date(tick.time).toLocaleTimeString('de-DE',{timeZone:'UTC'})+' UTC · Empfangen: '+new Date(tick.receivedAt).toLocaleTimeString('de-DE')}
liveFeed?.addEventListener('status',event=>{const status=JSON.parse(event.data);if(selectedSymbol==='XAU/USD'&&status.state!=='connected')document.querySelector('#feed-status').textContent='LIVE-FEED VERBINDET NEU · HISTORIE VERFÜGBAR'});
if(liveFeed)liveFeed.onerror=()=>{if(selectedSymbol==='XAU/USD')document.querySelector('#feed-status').textContent='LIVE-FEED UNTERBROCHEN · AUTOMATISCHE NEUVERBINDUNG'};
setInterval(()=>{if(liveFeed&&GoldLive.last&&Date.now()-GoldLive.last.receivedAt>30000)document.querySelector('#feed-status').textContent='WARTEN AUF NEUEN PREIS · '+selectedSymbol+' · '+intervalLabels[selectedInterval]},5000);

const indicatorPreferences=[...document.querySelectorAll('#indicator-controls input, #indicator-controls select')];
try{const saved=JSON.parse(localStorage.getItem('blh-indicators')||'{}');for(const input of indicatorPreferences)if(Object.hasOwn(saved,input.id)){if(input.type==='checkbox')input.checked=saved[input.id]===true;else if(typeof saved[input.id]==='string'&&(input.tagName!=='SELECT'||[...input.options].some(o=>o.value===saved[input.id])))input.value=saved[input.id]}}catch{}
document.querySelector('#indicator-controls').addEventListener('input',()=>{try{localStorage.setItem('blh-indicators',JSON.stringify(Object.fromEntries(indicatorPreferences.map(input=>[input.id,input.type==='checkbox'?input.checked:input.value]))))}catch{}renderIndicator()});
