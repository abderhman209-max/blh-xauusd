#!/usr/bin/env node
// Génère une vidéo verticale 1080×1920 (format TikTok / Reels / Shorts) pour publier un signal.
//
//   node tools/signal-video.mjs --side buy --entry 2650.50 --sl 2644 --tp1 2656 --tp2 2662 --tp3 2670
//
// Options : --symbol XAU/USD  --timeframe M5  --handle @pipvoria  --note "Texte libre"
//           --duration 12  --fps 30  --out signal.mp4  --lang fr|en|ar
// Nécessite Playwright (Chromium) et ffmpeg.
import {spawn} from 'node:child_process';
import {parseArgs} from 'node:util';
import path from 'node:path';

export const LABELS = {
  fr: {buy: 'ACHAT', sell: 'VENTE', entry: 'Entrée', sl: 'Stop Loss', signal: 'SIGNAL', risk: 'Risque', disclaimer: 'Pas un conseil financier · Gérez votre risque'},
  en: {buy: 'BUY', sell: 'SELL', entry: 'Entry', sl: 'Stop Loss', signal: 'SIGNAL', risk: 'Risk', disclaimer: 'Not financial advice · Manage your risk'},
  ar: {buy: 'شراء', sell: 'بيع', entry: 'الدخول', sl: 'وقف الخسارة', signal: 'إشارة', risk: 'المخاطرة', disclaimer: 'ليست نصيحة مالية · تحكم في المخاطرة'}
};

export function buildSignal(input) {
  const side = String(input.side || '').toLowerCase();
  if (side !== 'buy' && side !== 'sell') throw Error('--side doit être buy ou sell');
  const num = key => {
    const v = Number(input[key]);
    if (!Number.isFinite(v) || v <= 0) throw Error(`--${key} doit être un prix positif`);
    return v;
  };
  const entry = num('entry'), sl = num('sl');
  const tps = ['tp1', 'tp2', 'tp3'].filter(k => input[k] !== undefined && input[k] !== '').map(num);
  if (!tps.length) throw Error('Indiquez au moins --tp1');
  const dir = side === 'buy' ? 1 : -1;
  if ((entry - sl) * dir <= 0) throw Error(side === 'buy' ? 'Pour un achat, le Stop Loss doit être sous l’entrée' : 'Pour une vente, le Stop Loss doit être au-dessus de l’entrée');
  let prev = entry;
  tps.forEach((tp, i) => {
    if ((tp - prev) * dir <= 0) throw Error(`TP${i + 1} doit être ${side === 'buy' ? 'au-dessus' : 'en dessous'} de ${i ? 'TP' + i : 'l’entrée'}`);
    prev = tp;
  });
  const risk = Math.abs(entry - sl);
  const decimals = Math.max(...[input.entry, input.sl, input.tp1, input.tp2, input.tp3].map(v => (String(v ?? '').split('.')[1] || '').length));
  const lang = LABELS[input.lang] ? input.lang : 'fr';
  return {
    side, entry, sl, lang, decimals: Math.min(decimals, 5),
    symbol: input.symbol || 'XAU/USD',
    timeframe: input.timeframe || '',
    handle: input.handle || '',
    note: input.note || '',
    tps: tps.map(price => ({price, rr: Math.abs(price - entry) / risk})),
    risk
  };
}

export function signalHtml(s) {
  const L = LABELS[s.lang];
  const color = s.side === 'buy' ? '#22c58b' : '#ff5a6e';
  const fmt = v => v.toFixed(s.decimals);
  const esc = v => String(v).replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
  const rows = [
    {label: L.entry, value: fmt(s.entry), tag: '', cls: 'entry'},
    {label: L.sl, value: fmt(s.sl), tag: `−${fmt(s.risk)}`, cls: 'sl'},
    ...s.tps.map((tp, i) => ({label: `TP${i + 1}`, value: fmt(tp.price), tag: `R:R 1:${tp.rr.toFixed(1)}`, cls: 'tp'}))
  ];
  // Échelle de prix : du TP le plus lointain au Stop Loss.
  const levels = [{p: s.sl, cls: 'sl', l: 'SL'}, {p: s.entry, cls: 'entry', l: L.entry}, ...s.tps.map((t, i) => ({p: t.price, cls: 'tp', l: 'TP' + (i + 1)}))];
  const lo = Math.min(...levels.map(l => l.p)), hi = Math.max(...levels.map(l => l.p));
  const y = p => 30 + (hi - p) / (hi - lo) * 620;
  return `<!doctype html><html dir="${s.lang === 'ar' ? 'rtl' : 'ltr'}"><head><meta charset="utf-8"><style>
*{box-sizing:border-box;margin:0;padding:0}
html,body{width:1080px;height:1920px;overflow:hidden;background:#0a0d16;color:#eef0f8;font-family:Inter,'DejaVu Sans',system-ui,sans-serif}
.bg{position:absolute;inset:0;background:radial-gradient(900px 700px at 80% 10%,#9d8cff33,transparent 70%),radial-gradient(800px 800px at 10% 90%,${color}22,transparent 70%)}
.grid{position:absolute;inset:0;background-image:linear-gradient(#ffffff08 1px,transparent 1px),linear-gradient(90deg,#ffffff08 1px,transparent 1px);background-size:90px 90px}
.wrap{position:absolute;left:70px;right:150px;top:140px}
.brand{display:flex;align-items:center;gap:22px;font-size:40px;font-weight:700;letter-spacing:.04em}
.logo{width:72px;height:72px;border-radius:18px;background:#141a2b;display:grid;place-items:center}
.logo i{width:30px;height:30px;background:#9d8cff;transform:rotate(45deg);border-radius:5px}
.sym{margin-top:40px;font-size:108px;font-weight:800;letter-spacing:-.02em;line-height:1}
.meta{margin-top:12px;font-size:36px;color:#9aa1b8;font-weight:500}
.side{margin-top:30px;display:inline-block;padding:14px 50px;border-radius:999px;background:${color};color:#06110c;font-size:76px;font-weight:900;letter-spacing:.06em;box-shadow:0 0 80px ${color}88}
.rows{margin-top:36px;display:flex;flex-direction:column;gap:14px;width:560px}
.row{display:flex;flex-direction:column;padding:14px 28px;border-radius:24px;background:#121726e6;border:2px solid #232a40}
.row .l{font-size:28px;color:#9aa1b8;font-weight:600;display:flex;justify-content:space-between}
.row .v{font-family:'JetBrains Mono','DejaVu Sans Mono',monospace;font-size:52px;font-weight:800;margin-top:0;direction:ltr;text-align:start}
.row.entry{border-color:#9d8cff}.row.entry .v{color:#c9bfff}
.row.sl{border-color:#ff5a6e66}.row.sl .v{color:#ff8a98}
.row.tp{border-color:#22c58b55}.row.tp .v{color:#5fe0ad}
.row .t{font-size:28px;color:#eef0f8;opacity:.75;direction:ltr}
.ladder{position:absolute;right:150px;top:640px;width:240px;height:680px}
.ladder .axis{position:absolute;left:30px;top:40px;bottom:40px;width:4px;background:#232a40;border-radius:2px}
.zone{position:absolute;left:24px;width:16px;border-radius:8px}
.lvl{position:absolute;left:0;right:0;height:0;border-top:4px dashed}
.lvl span{position:absolute;right:0;top:-24px;font-size:28px;font-weight:700;padding:4px 14px;border-radius:10px;background:#0a0d16;direction:ltr}
.lvl.sl{border-color:#ff5a6e}.lvl.sl span{color:#ff8a98}
.lvl.entry{border-color:#9d8cff}.lvl.entry span{color:#c9bfff}
.lvl.tp{border-color:#22c58b}.lvl.tp span{color:#5fe0ad}
.dot{position:absolute;left:14px;width:36px;height:36px;margin-top:-18px;border-radius:50%;background:${color};box-shadow:0 0 40px ${color}}
.note{margin-top:30px;font-size:36px;font-weight:600;line-height:1.3}
.foot{margin-top:18px;font-size:26px;color:#7d849c}
.handle{color:#c9bfff;font-weight:700;margin-inline-end:16px}
.a{opacity:0}
</style></head><body><div class="bg"></div><div class="grid"></div>
<div class="wrap">
  <div class="brand a" data-in="0"><div class="logo"><i></i></div><span>PIPVORIA · ${esc(L.signal)}</span></div>
  <div class="sym a" data-in="0.3">${esc(s.symbol)}</div>
  ${s.timeframe ? `<div class="meta a" data-in="0.5">${esc(s.timeframe)}</div>` : ''}
  <div class="side a" data-in="0.9" data-pop>${esc(s.side === 'buy' ? L.buy : L.sell)}</div>
  <div class="rows">${rows.map((r, i) => `<div class="row ${r.cls} a" data-in="${(1.6 + i * 0.45).toFixed(2)}"><div class="l"><span>${esc(r.label)}</span><span class="t">${esc(r.tag)}</span></div><div class="v">${esc(r.value)}</div></div>`).join('')}</div>
${s.note ? `<div class="note a" data-in="${(2 + rows.length * 0.45).toFixed(2)}">${esc(s.note)}</div>` : ''}
<div class="foot a" data-in="${(2.2 + rows.length * 0.45).toFixed(2)}">${s.handle ? `<span class="handle">${esc(s.handle)}</span>` : ''}${esc(L.disclaimer)}</div>
</div>
<div class="ladder">
  <div class="axis"></div>
  <div class="zone" id="risk" style="top:${Math.min(y(s.sl), y(s.entry))}px;height:${Math.abs(y(s.sl) - y(s.entry))}px;background:#ff5a6e55"></div>
  <div class="zone" id="reward" style="top:${Math.min(y(s.entry), y(s.tps.at(-1).price))}px;height:${Math.abs(y(s.tps.at(-1).price) - y(s.entry))}px;background:#22c58b55"></div>
  ${levels.map((l, i) => `<div class="lvl ${l.cls} a" data-in="${(1.6 + i * 0.3).toFixed(2)}" style="top:${y(l.p)}px"><span>${esc(l.l)}</span></div>`).join('')}
  <div class="dot" id="dot" style="top:${y(s.entry)}px"></div>
</div>
<script>
const Y=${JSON.stringify({entry: y(s.entry), tps: s.tps.map(t => y(t.price))})};
const ease=x=>1-Math.pow(1-Math.min(Math.max(x,0),1),3);
const back=x=>{x=Math.min(Math.max(x,0),1);const c=1.7;return 1+(c+1)*Math.pow(x-1,3)+c*Math.pow(x-1,2)};
window.render=t=>{
  for(const el of document.querySelectorAll('[data-in]')){
    const p=(t-Number(el.dataset.in))/0.5;
    el.style.opacity=ease(p);
    el.style.transform=el.hasAttribute('data-pop')?'scale('+(0.4+0.6*back(p))+')':'translateY('+(1-ease(p))*40+'px)';
  }
  for(const id of ['risk','reward']){const z=document.getElementById(id);z.style.opacity=ease((t-2.6)/0.8);}
  // Le point part de l'entrée et monte (ou descend) vers chaque TP, puis recommence.
  const dot=document.getElementById('dot');const path=[Y.entry,...Y.tps];
  const cyc=Math.max(t-3.5,0)%4.5;const seg=cyc/4.5*(path.length-1);const k=Math.min(Math.floor(seg),path.length-2);
  dot.style.top=(path[k]+(path[k+1]-path[k])*ease(seg-k))+'px';
  dot.style.opacity=ease((t-3)/0.5);
};
window.render(0);
</script></body></html>`;
}

async function loadPlaywright() {
  try { return await import('playwright'); } catch {
    // Playwright installé globalement : l'import ESM ne consulte pas NODE_PATH, require le fait.
    const {createRequire} = await import('node:module');
    return createRequire(import.meta.url)('playwright');
  }
}

async function main() {
  const {values} = parseArgs({options: {
    side: {type: 'string'}, entry: {type: 'string'}, sl: {type: 'string'},
    tp1: {type: 'string'}, tp2: {type: 'string'}, tp3: {type: 'string'},
    symbol: {type: 'string'}, timeframe: {type: 'string'}, handle: {type: 'string'}, note: {type: 'string'},
    lang: {type: 'string', default: 'fr'}, duration: {type: 'string', default: '12'}, fps: {type: 'string', default: '30'},
    out: {type: 'string', default: 'signal.mp4'}, html: {type: 'boolean', default: false}
  }});
  const signal = buildSignal(values);
  const html = signalHtml(signal);
  if (values.html) return process.stdout.write(html);
  const fps = Math.min(Math.max(Number(values.fps) || 30, 10), 60);
  const frames = Math.round(Math.min(Math.max(Number(values.duration) || 12, 4), 60) * fps);
  const out = path.resolve(values.out);
  const {chromium} = await loadPlaywright();
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({viewport: {width: 1080, height: 1920}});
    await page.setContent(html, {waitUntil: 'load'});
    const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'mjpeg', '-i', '-',
      '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-preset', 'medium', '-crf', '20', '-movflags', '+faststart', out], {stdio: ['pipe', 'inherit', 'inherit']});
    const done = new Promise((ok, ko) => ff.on('close', c => c ? ko(Error('ffmpeg a échoué (' + c + ')')) : ok()));
    for (let i = 0; i < frames; i++) {
      await page.evaluate(t => window.render(t), i / fps);
      const jpg = await page.screenshot({type: 'jpeg', quality: 92});
      if (!ff.stdin.write(jpg)) await new Promise(r => ff.stdin.once('drain', r));
    }
    ff.stdin.end();
    await done;
  } finally {
    await browser.close();
  }
  console.log('Vidéo créée : ' + out);
}

if (import.meta.url === `file://${process.argv[1]}`) main().catch(e => { console.error(e.message); process.exit(1); });
