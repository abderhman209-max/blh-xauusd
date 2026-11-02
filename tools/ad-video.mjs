#!/usr/bin/env node
// Publicité TikTok premium de 20 s pour pipvoria.com (1080×1920, 9:16).
// Scènes : graphique or cinématique → marque + vrai site → analyse (price action, liquidité,
// structure, multi-unités de temps) → site desktop + mobile → logo et appel à l'action.
//
//   node tools/ad-video.mjs --out pipvoria-ad.mp4 [--music musique.wav] [--voice voix.wav]
//
// Les bougies sont générées (graine fixe) : aucun prix ni résultat n'est affiché ou affirmé.
import {spawn} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {parseArgs} from 'node:util';
import {fileURLToPath} from 'node:url';
import {renderVideo} from './signal-video.mjs';
import {captureLanding} from './promo-video.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'public');
export const DURATION = 20;
export const SCENES = [
  {from: 0, to: 4, text: 'THE GOLD MARKET NEVER STOPS.', voice: 'The gold market moves fast. Are you ready?'},
  {from: 4, to: 8, text: 'DISCOVER PIPVORIA.', voice: 'Discover Pipvoria.'},
  {from: 8, to: 14, text: 'SMARTER MARKET ANALYSIS.', voice: 'Price action, liquidity and market structure, across every timeframe.'},
  {from: 14, to: 17, text: 'ANALYZE, PLAN, TRADE.', voice: 'Analyze. Plan. Trade.'},
  {from: 17, to: 20, text: 'START EXPLORING TODAY', voice: 'Start exploring today at pipvoria.com.'}
];

// Bougies déterministes : tendance haussière, balayage de liquidité, cassure de structure.
export function makeCandles(n = 260, seed = 7) {
  let s = seed >>> 0;
  const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  const out = [];
  let p = 100;
  for (let i = 0; i < n; i++) {
    const phase = i % 60;
    const drift = phase < 30 ? 0.16 : phase < 42 ? -0.22 : phase < 46 ? -0.5 : 0.34;
    const o = p, c = o + drift + (rnd() - 0.5) * 1.6;
    const h = Math.max(o, c) + rnd() * 0.9, l = Math.min(o, c) - rnd() * 0.9;
    out.push({o, h, l, c});
    p = c;
  }
  return out;
}

export function adHtml({desktop = '', mobile = '', url = 'PIPVORIA.COM'} = {}) {
  const icon = fs.readFileSync(path.join(ROOT, 'pipvoria-icon.svg'), 'utf8');
  const logo = 'data:image/svg+xml;base64,' + Buffer.from(icon).toString('base64');
  const esc = v => String(v).replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
  // Le dégradé or est porté par chaque mot : background-clip:text ne suit pas les enfants transformés.
  const words = (t, cls = '', i0 = 0) => esc(t).split(' ').map((w, i) => `<span class="w ${cls}" style="--i:${i0 + i}">${w}</span>`).join(' ');
  return `<!doctype html><html><head><meta charset="utf-8"><style>
*{box-sizing:border-box;margin:0;padding:0}
html,body{width:1080px;height:1920px;overflow:hidden;background:#05060c;color:#fff;font-family:Inter,'DejaVu Sans',system-ui,sans-serif}
canvas{position:absolute;left:0;top:0}
.layer{position:absolute;inset:0;opacity:0;overflow:hidden}
.fx{position:absolute;inset:0;pointer-events:none}
.vignette{background:radial-gradient(ellipse at 50% 45%,transparent 45%,#000c 100%)}
.flash{background:radial-gradient(circle at 50% 50%,#fff,#c9b8ff 40%,#7b5cff00 75%);opacity:0;mix-blend-mode:screen}
.grain{opacity:.07;background-image:repeating-radial-gradient(circle at 17% 32%,#fff 0 1px,transparent 1px 3px);mix-blend-mode:overlay}
.bars{position:absolute;left:0;right:0;height:0;background:#000;z-index:20}
.headline{position:absolute;left:70px;right:150px;font-weight:900;letter-spacing:-.02em;line-height:.98;text-transform:uppercase;z-index:10}
.headline .w{display:inline-block;opacity:0;will-change:transform}
.gold{background:linear-gradient(100deg,#fff6d8 0%,#f4d27a 30%,#c99a2e 55%,#fff1c2 75%,#d9ab45 100%);-webkit-background-clip:text;background-clip:text;color:transparent;filter:drop-shadow(0 0 30px #e6b94a66)}
.neon{color:#fff;text-shadow:0 0 18px #b9a6ff,0 0 50px #8c6cff,0 0 110px #6a45ff}
.kicker{position:absolute;left:70px;font:700 30px/1 'JetBrains Mono','DejaVu Sans Mono',monospace;letter-spacing:.3em;color:#cbbcff;z-index:10}
.panel{position:absolute;border-radius:28px;overflow:hidden;background:#0b0e19;border:2px solid #ffffff1c;box-shadow:0 50px 140px #000d,0 0 80px #7b5cff44}
.browser .top{height:46px;background:#141828;display:flex;align-items:center;gap:10px;padding:0 20px}
.browser .top i{width:14px;height:14px;border-radius:50%;background:#ffffff30}
.browser .top b{margin-left:20px;flex:1;height:26px;border-radius:13px;background:#0b0e19;font:500 15px/26px Inter,sans-serif;color:#9aa1b8;padding-left:16px}
.browser img{display:block;width:100%}
.phone{border-radius:70px;border:14px solid #1a1f31}
.phone img{display:block;width:100%}
.chip{position:absolute;padding:14px 26px;border-radius:999px;background:#0b0e19d9;border:2px solid #9d8cff88;font:800 30px/1 Inter,sans-serif;letter-spacing:.08em;color:#e7e0ff;box-shadow:0 0 40px #7b5cff55;z-index:6}
.chip.g{border-color:#e6b94a99;color:#ffe7a8;box-shadow:0 0 40px #e6b94a44}
.logo-big{position:absolute;left:50%;top:640px;width:300px;height:300px;margin-left:-150px;filter:drop-shadow(0 0 60px #9d8cffaa) drop-shadow(0 0 140px #e6b94a55)}
.brand{position:absolute;left:0;right:0;text-align:center;font-weight:900;letter-spacing:.32em;z-index:10}
.cta{position:absolute;left:50%;transform:translateX(-50%);padding:30px 64px;border-radius:999px;background:linear-gradient(100deg,#8c6cff,#b49bff 50%,#e6b94a);color:#0a0812;font:900 50px/1 Inter,sans-serif;letter-spacing:.06em;white-space:nowrap;box-shadow:0 0 90px #9d8cff99,0 0 160px #e6b94a55;z-index:10}
.tf{position:absolute;font:800 26px/1 'JetBrains Mono',monospace;color:#cbbcff;letter-spacing:.1em}
.progress{position:absolute;left:0;top:0;height:6px;background:linear-gradient(90deg,#9d8cff,#e6b94a);z-index:30}
</style></head><body>
<canvas id="cv" width="1080" height="1920"></canvas>

<!-- Scène 1 · graphique or -->
<div class="layer" id="s1">
  <div class="kicker" style="top:250px" data-k>XAU/USD · GOLD</div>
  <div class="headline" style="top:1000px;font-size:124px" data-words>${words(SCENES[0].text, 'gold')}</div>
</div>

<!-- Scène 2 · marque + site -->
<div class="layer" id="s2">
  <img class="logo-big" id="s2logo" src="${logo}" alt="" style="top:250px;width:200px;height:200px;margin-left:-100px">
  <div class="brand neon" id="s2brand" style="top:480px;font-size:84px">PIPVORIA</div>
  <div class="panel browser" id="s2site" style="left:60px;width:960px;top:640px">
    <div class="top"><i></i><i></i><i></i><b>pipvoria.com</b></div>${desktop ? `<img src="${desktop}" alt="">` : ''}
  </div>
  <div class="headline neon" style="top:1400px;font-size:120px;text-align:center;left:60px;right:60px" data-words>${words(SCENES[1].text)}</div>
</div>

<!-- Scène 3 · analyse (dessinée sur le canvas) -->
<div class="layer" id="s3">
  <div class="kicker" id="s3k" style="top:220px">PRICE ACTION</div>
  <div class="headline" style="top:1330px;font-size:112px" data-words>${words('SMARTER', 'neon')}<br>${words('MARKET ANALYSIS.', 'gold', 1)}</div>
</div>

<!-- Scène 4 · desktop + mobile -->
<div class="layer" id="s4" style="perspective:1800px">
  <div class="panel browser" id="s4desk" style="left:40px;width:900px;top:420px">
    <div class="top"><i></i><i></i><i></i><b>pipvoria.com</b></div>${desktop ? `<img src="${desktop}" alt="">` : ''}
  </div>
  <div class="panel phone" id="s4phone" style="left:610px;width:360px;top:700px;height:740px">${mobile ? `<img src="${mobile}" alt="">` : ''}</div>
  <div class="headline" id="s4words" style="top:1290px;font-size:122px;line-height:1.02">
    <span class="w neon" style="--i:0">ANALYZE,</span><br><span class="w neon" style="--i:1">PLAN,</span><br><span class="w gold" style="--i:2">TRADE.</span>
  </div>
</div>

<!-- Scène 5 · logo + appel à l'action -->
<div class="layer" id="s5">
  <img class="logo-big" id="s5logo" src="${logo}" alt="">
  <div class="brand gold" id="s5brand" style="top:990px;font-size:96px">PIPVORIA</div>
  <div class="headline neon" id="s5start" style="top:1140px;left:60px;right:60px;text-align:center;font-size:70px" data-words>${words(SCENES[4].text)}</div>
  <div class="cta" id="s5cta" style="top:1300px">VISIT ${esc(url)}</div>
</div>

<div class="fx vignette"></div>
<div class="fx grain" id="grain"></div>
<div class="fx flash" id="flash"></div>
<div class="bars" id="bt" style="top:0"></div><div class="bars" id="bb" style="bottom:0"></div>
<div class="progress" id="prog"></div>

<script>
const D=${DURATION};
const C=${JSON.stringify(makeCandles())};
const cv=document.getElementById('cv'),x=cv.getContext('2d');
const cl=v=>Math.min(Math.max(v,0),1);
const ease=v=>1-Math.pow(1-cl(v),3);
const inout=v=>{v=cl(v);return v<.5?4*v*v*v:1-Math.pow(-2*v+2,3)/2};
const back=v=>{v=cl(v);const c=1.9;return 1+(c+1)*Math.pow(v-1,3)+c*Math.pow(v-1,2)};
const $=id=>document.getElementById(id);

// Pivots locaux pour annoter la structure.
function pivots(a,b,k){const hi=[],lo=[];for(let i=a+k;i<b-k;i++){let H=1,L=1;for(let j=i-k;j<=i+k;j++){if(C[j].h>C[i].h)H=0;if(C[j].l<C[i].l)L=0;}if(H)hi.push(i);if(L)lo.push(i);}return{hi,lo};}

// Dessine une fenêtre de bougies dans le rectangle (X,Y,W,H). reveal = part visible (0..1).
function chart(X,Y,W,H,a,n,o={}){
  const reveal=o.reveal??1,shown=Math.max(1,Math.floor(n*reveal));
  let lo=1e9,hi=-1e9;for(let i=a;i<a+n;i++){lo=Math.min(lo,C[i].l);hi=Math.max(hi,C[i].h);}
  const pad=(hi-lo)*.12;lo-=pad;hi+=pad;
  const py=p=>Y+(hi-p)/(hi-lo)*H,cw=W/n,px=i=>X+(i-a+.5)*cw;
  x.save();x.beginPath();x.rect(X,Y,W,H);x.clip();
  // Grille
  x.strokeStyle='rgba(157,140,255,.08)';x.lineWidth=1;
  for(let g=1;g<6;g++){x.beginPath();x.moveTo(X,Y+H*g/6);x.lineTo(X+W,Y+H*g/6);x.stroke();}
  for(let g=1;g<5;g++){x.beginPath();x.moveTo(X+W*g/5,Y);x.lineTo(X+W*g/5,Y+H);x.stroke();}
  // Profil de volume
  if(o.profile){const bins=new Array(28).fill(0);for(let i=a;i<a+shown;i++){const b=Math.floor((C[i].c-lo)/(hi-lo)*28);if(b>=0&&b<28)bins[b]+=Math.abs(C[i].c-C[i].o)+.3;}
    const m=Math.max(...bins);bins.forEach((v,b)=>{x.fillStyle='rgba(157,140,255,.16)';const bh=H/28;x.fillRect(X+W-v/m*W*.22,Y+H-(b+1)*bh+1,v/m*W*.22,bh-2);});}
  for(let i=a;i<a+shown;i++){const k=C[i],up=k.c>=k.o;
    const col=up?(o.upCol||'#f2c55c'):(o.dnCol||'#8c6cff');
    x.shadowColor=col;x.shadowBlur=o.glow??14;x.strokeStyle=col;x.fillStyle=col;x.lineWidth=Math.max(1.5,cw*.12);
    x.beginPath();x.moveTo(px(i),py(k.h));x.lineTo(px(i),py(k.l));x.stroke();
    const top=py(Math.max(k.o,k.c)),bh=Math.max(2,Math.abs(py(k.o)-py(k.c)));
    if(up)x.fillRect(px(i)-cw*.34,top,cw*.68,bh);else{x.globalAlpha=.9;x.fillRect(px(i)-cw*.34,top,cw*.68,bh);x.globalAlpha=1;}}
  x.shadowBlur=0;
  // Dernier prix
  const last=C[a+shown-1];x.setLineDash([10,10]);x.strokeStyle='rgba(242,197,92,.7)';x.lineWidth=2;x.beginPath();x.moveTo(X,py(last.c));x.lineTo(X+W,py(last.c));x.stroke();x.setLineDash([]);
  x.restore();
  return {py,px,cw,lo,hi};
}

function label(t,X,Y,col,size=28){x.font='800 '+size+'px Inter,sans-serif';const w=x.measureText(t).width+28;
  x.fillStyle='rgba(8,9,18,.85)';x.strokeStyle=col;x.lineWidth=2;x.shadowColor=col;x.shadowBlur=18;
  x.beginPath();x.roundRect(X-w/2,Y-size*.9,w,size*1.6,12);x.fill();x.stroke();x.shadowBlur=0;x.fillStyle=col;x.textAlign='center';x.fillText(t,X,Y+size*.28);x.textAlign='left';}

function bg(t,hue){
  const g=x.createRadialGradient(540,700+Math.sin(t*.7)*80,50,540,900,1300);
  g.addColorStop(0,hue==='gold'?'#2a1d05':'#1c1240');g.addColorStop(.45,'#0b0818');g.addColorStop(1,'#030308');
  x.fillStyle=g;x.fillRect(0,0,1080,1920);
  // Faisceaux néon
  for(let i=0;i<3;i++){const gx=x.createLinearGradient(0,0,1080,1920);const a=.05+.04*Math.sin(t*1.3+i*2);
    gx.addColorStop(0,'rgba(140,108,255,0)');gx.addColorStop(.5,'rgba(157,140,255,'+a+')');gx.addColorStop(1,'rgba(230,185,74,0)');
    x.save();x.translate(540,960);x.rotate(-.5+i*.35+Math.sin(t*.4+i)*.08);x.fillStyle=gx;x.fillRect(-1400,-60-i*30,2800,120+i*40);x.restore();}
  // Particules
  for(let i=0;i<70;i++){const sx=(i*137.5%1080),sy=((i*263+t*(40+i%7*25))%2100)-90,r=1+(i%4);
    x.fillStyle=i%3?'rgba(185,166,255,'+(.15+.25*((i*7)%10)/10)+')':'rgba(242,197,92,.35)';x.beginPath();x.arc(sx,1920-sy,r,0,7);x.fill();}
}

function scene1(t){
  bg(t,'gold');
  // Caméra : travelling rapide + rotation, puis léger push-in.
  const k=t/4;
  x.save();
  x.translate(540,860);x.rotate(-.12+.1*inout(k));x.scale(1.9-.65*ease(k*1.3),1.9-.65*ease(k*1.3));x.translate(-540,-860);
  const start=Math.floor(20+k*70);
  chart(-120,300,1320,1100,start,70,{glow:26,reveal:1,profile:true});
  x.restore();
  // Balayage lumineux
  const sx=-400+k*2200;const sg=x.createLinearGradient(sx-200,0,sx+200,0);
  sg.addColorStop(0,'rgba(255,230,160,0)');sg.addColorStop(.5,'rgba(255,230,160,.16)');sg.addColorStop(1,'rgba(255,230,160,0)');
  x.fillStyle=sg;x.fillRect(0,0,1080,1920);
}

const CUTS=[
  {at:8,k:'PRICE ACTION',a:60,n:60},
  {at:9.5,k:'LIQUIDITY',a:110,n:56},
  {at:11,k:'MARKET STRUCTURE',a:150,n:64},
  {at:12.4,k:'MULTI-TIMEFRAME',a:0,n:0}
];
function scene3(t){
  bg(t,'purple');
  let ci=0;for(let i=0;i<CUTS.length;i++)if(t>=CUTS[i].at)ci=i;
  const cut=CUTS[ci],lt=t-cut.at,z=1.08-.08*ease(lt/1.2);
  $('s3k').textContent=cut.k;
  x.save();x.translate(540,780);x.scale(z,z);x.translate(-540,-780);
  if(cut.k==='MULTI-TIMEFRAME'){
    const tfs=[['M5',180,60],['M15',120,60],['H1',40,70]];
    tfs.forEach(([tf,a,n],i)=>{const y=330+i*330,r=ease((lt-i*.15)/.6);
      x.globalAlpha=r;x.fillStyle='rgba(11,14,25,.8)';x.strokeStyle='rgba(157,140,255,.35)';x.lineWidth=2;x.beginPath();x.roundRect(60,y,960,300,22);x.fill();x.stroke();
      chart(80,y+20,920,260,a,n,{reveal:cl(.3+lt/1.2),glow:12});
      label(tf,140,y+50,i===2?'#f2c55c':'#cbbcff',26);x.globalAlpha=1;});
  }else{
    const reveal=cl(.55+lt/1.4);
    const g=chart(40,330,1000,900,cut.a,cut.n,{reveal,glow:16,profile:cut.k==='LIQUIDITY'});
    const shown=Math.floor(cut.n*reveal),{hi,lo}=pivots(cut.a,cut.a+shown,3);
    const ap=ease((lt-.25)/.6);x.globalAlpha=ap;
    if(cut.k==='PRICE ACTION'){
      hi.slice(-3).forEach((i,j)=>label(j?'HH':'H',g.px(i),g.py(C[i].h)-40,'#f2c55c',24));
      lo.slice(-3).forEach((i,j)=>label(j?'HL':'L',g.px(i),g.py(C[i].l)+46,'#cbbcff',24));
      x.strokeStyle='rgba(203,188,255,.8)';x.lineWidth=3;x.beginPath();
      [...hi.slice(-3).map(i=>[i,C[i].h]),...lo.slice(-3).map(i=>[i,C[i].l])].sort((p,q)=>p[0]-q[0]).forEach(([i,p],j)=>j?x.lineTo(g.px(i),g.py(p)):x.moveTo(g.px(i),g.py(p)));x.stroke();
    }else if(cut.k==='LIQUIDITY'){
      const L=lo.length?lo[0]:cut.a+10,lv=C[L].l;x.setLineDash([14,10]);x.strokeStyle='#8c6cff';x.lineWidth=3;
      x.beginPath();x.moveTo(g.px(L),g.py(lv));x.lineTo(1040,g.py(lv));x.stroke();x.setLineDash([]);
      label('SELL-SIDE LIQUIDITY $$$',560,g.py(lv)+60,'#cbbcff',26);
      const H=hi.length?hi[hi.length-1]:cut.a+30,hv=C[H].h;x.setLineDash([14,10]);x.strokeStyle='#f2c55c';
      x.beginPath();x.moveTo(g.px(H),g.py(hv));x.lineTo(1040,g.py(hv));x.stroke();x.setLineDash([]);
      label('BUY-SIDE LIQUIDITY $$$',560,g.py(hv)-46,'#f2c55c',26);
      x.fillStyle='rgba(140,108,255,.12)';x.fillRect(40,g.py(lv)-30,1000,60);
    }else{
      const H=hi.length?hi[Math.max(0,hi.length-2)]:cut.a+20,hv=C[H].h;
      x.strokeStyle='#f2c55c';x.lineWidth=3;x.beginPath();x.moveTo(g.px(H),g.py(hv));x.lineTo(1040,g.py(hv));x.stroke();
      label('BOS',Math.min(980,g.px(H)+240),g.py(hv)-40,'#f2c55c',28);
      const L=lo.length?lo[lo.length-1]:cut.a+40,lv=C[L].l;
      x.strokeStyle='#cbbcff';x.beginPath();x.moveTo(g.px(L),g.py(lv));x.lineTo(1040,g.py(lv));x.stroke();
      label('CHoCH',Math.min(980,g.px(L)+200),g.py(lv)+50,'#cbbcff',28);
      x.fillStyle='rgba(242,197,92,.10)';x.fillRect(g.px(L)-20,g.py(lv)-10,1060-g.px(L),40);
    }
    x.globalAlpha=1;
  }
  x.restore();
}

function words(el,t0,t){el.querySelectorAll('.w').forEach(w=>{const i=Number(w.style.getPropertyValue('--i'))||0,p=(t-t0-i*.12)/.45;
  w.style.opacity=ease(p);w.style.transform='translateY('+(1-ease(p))*80+'px) scale('+(.85+.15*back(p))+')';w.style.filter='blur('+(1-ease(p))*12+'px)';});}

const S=${JSON.stringify(SCENES.map(s => [s.from, s.to]))};
window.render=t=>{
  x.clearRect(0,0,1080,1920);
  const ids=['s1','s2','s3','s4','s5'];
  ids.forEach((id,i)=>{const [a,b]=S[i];const o=i===4?ease((t-a)/.25):Math.min(ease((t-a)/.25),ease((b-t)/.2));$(id).style.opacity=t>=a-.01&&t<=b+.2?o:0;});
  if(t<4.2)scene1(t);
  else if(t<8)bg(t,'purple');
  else if(t<14.2)scene3(t);
  else bg(t,t>=17?'gold':'purple');
  // Scène 1
  words($('s1'),.6,t);const k1=$('s1').querySelector('[data-k]');k1.style.opacity=ease((t-.2)/.4);
  // Scène 2 : logo, nom, site en zoom lent
  const l2=ease((t-4)/.5);$('s2logo').style.transform='scale('+(.3+.7*back((t-4)/.6))+') rotate('+(1-l2)*-90+'deg)';$('s2logo').style.opacity=l2;
  $('s2brand').style.opacity=ease((t-4.3)/.4);$('s2brand').style.letterSpacing=(.6-.28*ease((t-4.3)/.8))+'em';
  const z2=cl((t-4.4)/3.6);$('s2site').style.opacity=ease((t-4.4)/.4);
  $('s2site').style.transform='perspective(1600px) rotateX('+(18-18*ease((t-4.4)/.8))+'deg) scale('+(.9+.12*inout(z2))+') translateY('+(60-60*ease((t-4.4)/.8))+'px)';
  words($('s2'),5.2,t);
  words($('s3'),8.4,t);
  // Scène 4 : desktop et mobile flottants
  const p4=ease((t-14)/.6);
  $('s4desk').style.transform='rotateY('+(22-10*p4)+'deg) rotateX(6deg) translateX('+(-300+300*p4)+'px) translateY('+Math.sin(t*2)*8+'px)';
  $('s4phone').style.transform='rotateY('+(-20+8*p4)+'deg) translateX('+(300-300*ease((t-14.2)/.6))+'px) translateY('+Math.cos(t*2)*10+'px)';
  $('s4phone').style.opacity=ease((t-14.2)/.4);
  $('s4words').querySelectorAll('.w').forEach((w,i)=>{const p=(t-14.6-i*.55)/.3;w.style.opacity=ease(p);w.style.transform='scale('+(1.6-.6*back(p))+')';w.style.filter='blur('+(1-ease(p))*14+'px)';});
  // Scène 5
  const p5=(t-17)/.7;$('s5logo').style.transform='scale('+(.2+.8*back(p5))+') rotate('+(1-ease(p5))*180+'deg)';$('s5logo').style.opacity=ease(p5);
  $('s5brand').style.opacity=ease((t-17.4)/.4);$('s5brand').style.letterSpacing=(.7-.36*ease((t-17.4)/.9))+'em';
  words($('s5'),17.8,t);
  const pc=(t-18.5)/.4;$('s5cta').style.opacity=ease(pc);$('s5cta').style.transform='translateX(-50%) scale('+(.6+.4*back(pc)+.03*Math.sin(t*8)*cl(pc))+')';
  // Transitions : flash + barres cinéma
  let f=0;for(const c of [4,8,14,17])f=Math.max(f,1-Math.abs(t-c)/.18);
  for(const c of [9.5,11,12.4])f=Math.max(f,.5*(1-Math.abs(t-c)/.1));
  $('flash').style.opacity=cl(f);
  const bars=(t<4?90:t>17?60:0)*(1-cl((t-3.6)/.4))+(t>17?60*ease((t-17)/.5):0);
  $('bt').style.height=$('bb').style.height=bars+'px';
  $('grain').style.backgroundPosition=(t*977%300)+'px '+(t*613%300)+'px';
  $('prog').style.width=(t/D*100)+'%';
};
window.render(0);
</script></body></html>`;
}

function run(cmd, args) {
  return new Promise((ok, ko) => spawn(cmd, args, {stdio: 'inherit'}).on('close', c => c ? ko(Error(cmd + ' a échoué (' + c + ')')) : ok()));
}

async function main() {
  const {values} = parseArgs({options: {
    out: {type: 'string', default: 'pipvoria-ad.mp4'}, music: {type: 'string'}, voice: {type: 'string'},
    url: {type: 'string', default: 'PIPVORIA.COM'}, fps: {type: 'string', default: '30'}, html: {type: 'boolean', default: false}
  }});
  const desk = await captureLanding('en', {width: 1280, height: 860, scale: 1.5, fullPage: false});
  const mob = await captureLanding('en', {width: 390, height: 800, scale: 2, fullPage: false});
  const html = adHtml({desktop: desk.shot, mobile: mob.shot, url: values.url});
  if (values.html) return process.stdout.write(html);
  const fps = Math.min(Math.max(Number(values.fps) || 30, 24), 60);
  const out = path.resolve(values.out);
  const silent = values.music || values.voice ? path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'pipvoria-ad-')), 'video.mp4') : out;
  await renderVideo(html, {fps, frames: DURATION * fps, out: silent});
  if (silent !== out) {
    // Musique baissée sous la voix (sidechain), fondu de sortie, sonie TikTok (−14 LUFS).
    const inputs = ['-i', silent], filters = [];
    if (values.music) inputs.push('-i', path.resolve(values.music));
    if (values.voice) inputs.push('-i', path.resolve(values.voice));
    const m = values.music ? 1 : null, v = values.voice ? (values.music ? 2 : 1) : null;
    if (m && v) filters.push(`[${v}:a]aformat=channel_layouts=stereo,asplit=2[vo][sc]`, `[${m}:a]aformat=channel_layouts=stereo,volume=0.55[mu]`, `[mu][sc]sidechaincompress=threshold=0.04:ratio=6:attack=20:release=300[duck]`, `[duck][vo]amix=inputs=2:duration=first:normalize=0[mix]`);
    else filters.push(`[${m || v}:a]aformat=channel_layouts=stereo[mix]`);
    filters.push(`[mix]apad,atrim=0:${DURATION},afade=t=out:st=${DURATION - 0.8}:d=0.8,loudnorm=I=-14:TP=-1.5:LRA=9[a]`);
    await run('ffmpeg', ['-y', '-loglevel', 'error', ...inputs, '-filter_complex', filters.join(';'), '-map', '0:v', '-map', '[a]', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-shortest', '-movflags', '+faststart', out]);
  }
  console.log('Vidéo créée : ' + out);
}

if (import.meta.url === `file://${process.argv[1]}`) main().catch(e => { console.error(e.message); process.exit(1); });
