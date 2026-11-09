// Bookmap for the super admin: CME gold futures depth (MBP-10) as a heatmap over time, with trades as bubbles.
// Frames arrive over SSE from /api?route=bookmap/stream (proxied, admin only). The view mounts itself whenever
// the #pv-bookmap-canvas element is on the page and the tab is visible, and closes the stream otherwise.
(function(root){
  const TICK=0.1,COL=3,MAX_FRAMES=2400;
  const state={frames:[],source:null,lastT:0,status:null,error:'',zoom:1,raf:0,canvas:null};

  // Colour scale from quiet (deep blue) to heavy liquidity (white), like a thermal map.
  function heat(t){
    const stops=[[13,17,40],[24,74,140],[38,166,191],[240,180,91],[255,250,235]];
    const x=Math.max(0,Math.min(1,t))*(stops.length-1),i=Math.min(stops.length-2,Math.floor(x)),f=x-i,a=stops[i],b=stops[i+1];
    return 'rgb('+a.map((v,k)=>Math.round(v+(b[k]-v)*f)).join(',')+')';
  }
  function percentile(values,p){if(!values.length)return 1;const v=values.slice().sort((a,b)=>a-b);return v[Math.min(v.length-1,Math.floor(v.length*p))]||1;}
  function addFrame(frame){
    if(!frame||!Number.isFinite(frame.t)||frame.t<=state.lastT||!Array.isArray(frame.bids)||!Array.isArray(frame.asks))return;
    state.lastT=frame.t;state.frames.push(frame);if(state.frames.length>MAX_FRAMES)state.frames.splice(0,state.frames.length-MAX_FRAMES);
  }
  function setStatus(text,tone){const el=document.getElementById('pv-bookmap-status');if(el&&el.textContent!==text){el.textContent=text;el.dataset.tone=tone||'';}}

  function draw(){
    state.raf=0;const canvas=state.canvas;if(!canvas||!canvas.isConnected)return;
    const dpr=root.devicePixelRatio||1,w=canvas.clientWidth,h=canvas.clientHeight;
    if(canvas.width!==Math.round(w*dpr)||canvas.height!==Math.round(h*dpr)){canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);}
    const ctx=canvas.getContext('2d');ctx.setTransform(dpr,0,0,dpr,0,0);ctx.fillStyle='#0a0d16';ctx.fillRect(0,0,w,h);
    const axis=64,plotW=Math.max(10,w-axis),visible=state.frames.slice(-Math.floor(plotW/COL));
    if(!visible.length){ctx.fillStyle='#8d93a8';ctx.font='13px Instrument Sans, sans-serif';ctx.fillText(state.error||'En attente du flux CME…',16,h/2);return;}
    const last=visible.at(-1),bestBid=last.bids[0]?.[0],bestAsk=last.asks[0]?.[0],mid=bestBid&&bestAsk?(bestBid+bestAsk)/2:(bestBid||bestAsk||last.last);
    let span=0;for(const f of visible.slice(-60))for(const [p] of f.bids.concat(f.asks))span=Math.max(span,Math.abs(p-mid));
    const half=Math.max(1,span*1.15)/state.zoom,top=mid+half,bottom=mid-half,y=p=>(top-p)/(top-bottom)*h,row=Math.max(1,h*TICK/(top-bottom));
    // Newest frame on the right edge, like Bookmap; history scrolls left.
    const x0=plotW-visible.length*COL;
    const ref=percentile(visible.flatMap(f=>f.bids.concat(f.asks).map(l=>l[1])),0.95);
    visible.forEach((f,i)=>{const x=x0+i*COL;for(const [p,s] of f.bids.concat(f.asks)){if(p<bottom||p>top)continue;ctx.fillStyle=heat(s/ref);ctx.fillRect(x,y(p)-row/2,COL,row);}});
    // Best bid and ask as step lines.
    for(const [side,color] of [['bids','#3fd2a4'],['asks','#f2707a']]){ctx.strokeStyle=color;ctx.lineWidth=1.5;ctx.beginPath();let started=false;
      visible.forEach((f,i)=>{const p=f[side][0]?.[0];if(p==null){started=false;return;}const yy=y(p),x=x0+i*COL;if(!started){ctx.moveTo(x,yy);started=true;}else ctx.lineTo(x,yy);ctx.lineTo(x+COL,yy);});ctx.stroke();}
    // Trades: area grows with volume; green when a buyer lifted the offer, red when a seller hit the bid.
    visible.forEach((f,i)=>{for(const [p,s,side] of f.trades||[]){if(p<bottom||p>top)continue;ctx.beginPath();ctx.arc(x0+i*COL+COL/2,y(p),Math.min(18,2+Math.sqrt(s)*1.6),0,Math.PI*2);
      ctx.fillStyle=side==='buy'?'rgba(63,210,164,.75)':side==='sell'?'rgba(242,112,122,.75)':'rgba(201,191,255,.6)';ctx.fill();}});
    // Price axis.
    ctx.fillStyle='#11151f';ctx.fillRect(plotW,0,axis,h);ctx.fillStyle='#8d93a8';ctx.font='11px JetBrains Mono, monospace';
    const step=Math.max(TICK,Math.ceil((top-bottom)/12/TICK)*TICK);
    for(let p=Math.ceil(bottom/step)*step;p<=top;p+=step){const yy=y(p);ctx.fillText(p.toFixed(1),plotW+6,yy+4);ctx.fillRect(plotW,yy,4,1);}
    if(last.last!=null&&last.last>=bottom&&last.last<=top){const yy=y(last.last);ctx.fillStyle='#9d8cff';ctx.fillRect(plotW,yy-9,axis,18);ctx.fillStyle='#0a0d16';ctx.fillText(last.last.toFixed(1),plotW+6,yy+4);}
  }
  function schedule(){if(!state.raf)state.raf=root.requestAnimationFrame(draw);}
  function open(){
    if(state.source)return;
    const source=new root.EventSource('/api?route=bookmap/stream&since='+state.lastT);state.source=source;setStatus('Connexion au flux CME…','');
    source.onmessage=e=>{try{addFrame(JSON.parse(e.data));state.error='';schedule();}catch{}};
    source.addEventListener('status',e=>{try{state.status=JSON.parse(e.data);}catch{}const s=state.status;
      if(!s)return;const age=s.last_record_age_s;
      setStatus(s.connected&&age!=null&&age<30?'Direct CME · '+(s.contract||s.symbol)+' · carnet 10 niveaux':s.connected?'Connecté · marché calme ou fermé':s.error?'Databento refuse la connexion ('+String(s.error).slice(0,80)+') · vérifiez le plan live CME':'Reconnexion au flux Databento…',s.connected&&age<30?'live':'wait');});
    source.onerror=()=>{setStatus('Flux interrompu · nouvelle tentative…','wait');
      // A 503 (not configured) closes the stream for good in most browsers; probe once to explain why.
      if(source.readyState===2){close();root.fetch('/api?route=bookmap/history',{credentials:'same-origin'}).then(r=>r.json().then(d=>{state.error=d.error==='bookmap_not_configured'?'Bookmap non configuré : ajoutez BOOKMAP_URL et BOOKMAP_SECRET dans Vercel.':d.error?'Flux Bookmap indisponible.':'';setStatus(state.error||'Reconnexion…','wait');schedule();})).catch(()=>{});}};
  }
  function close(){if(state.source){state.source.close();state.source=null;}}
  function tick(){
    const canvas=root.document?.getElementById('pv-bookmap-canvas');
    if(canvas!==state.canvas){state.canvas=canvas;if(canvas){canvas.addEventListener('wheel',e=>{e.preventDefault();state.zoom=Math.max(0.5,Math.min(8,state.zoom*(e.deltaY<0?1.15:1/1.15)));schedule();},{passive:false});schedule();}}
    if(canvas&&!root.document.hidden)open();else close();
  }
  root.PipvoriaBookmap={tick,addFrame,heat,state,_draw:draw};
  if(root.document&&root.setInterval){root.setInterval(tick,1000);root.addEventListener?.('resize',schedule);}
})(globalThis);
