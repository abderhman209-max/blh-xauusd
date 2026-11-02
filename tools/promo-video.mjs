#!/usr/bin/env node
// Vidéo de présentation du site Pipvoria pour TikTok / Reels / Shorts (1080×1920, ~24 s).
// Capture la vraie page d'accueil (public/) en vue mobile, puis l'anime avec les arguments du site.
//
//   node tools/promo-video.mjs --lang fr --out pipvoria-promo.mp4
//
// Options : --lang fr|en|ar  --url pipvoria.com  --handle @pipvoria  --fps 30  --out fichier.mp4  --html
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {parseArgs} from 'node:util';
import {fileURLToPath} from 'node:url';
import {loadPlaywright, renderVideo} from './signal-video.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'public');
export const DURATION = 24;

// Textes repris de la page d'accueil (public/index.html) : aucun chiffre de performance inventé.
export const TEXT = {
  fr: {
    siteLang: 'Français', hook1: 'Tu trades l’or ?', hook2: 'Arrête de deviner.',
    tag: 'Agent IA · XAU/USD, BTC/USD, EUR/USD', title: 'Le bot lit la structure.\nVous gardez la main.',
    features: [['Structure de marché', 'Balayages de liquidité, BOS / CHoCH, offre et demande'], ['Plan de trade complet', 'Entrée, stop loss ATR, TP1 · TP2 · TP3 à 1R, 2R, 3R'], ['Résultats vérifiables', 'Test historique en R sur bougies clôturées. Pas de chiffres inventés.']],
    plan: 'Chaque signal arrive avec', entry: 'Entrée', sl: 'Stop loss', tps: 'Objectifs',
    price: 'USD / 30 jours', pay: 'Règlement en crypto · tout inclus', cta: 'Lien en bio', start: 'Crée ton compte',
    risk: 'Le trading comporte un risque de perte en capital. Pas un conseil financier.'
  },
  en: {
    siteLang: 'English', hook1: 'Trading gold?', hook2: 'Stop guessing.',
    tag: 'AI agent · XAU/USD, BTC/USD, EUR/USD', title: 'The bot reads the structure.\nYou stay in control.',
    features: [['Market structure', 'Liquidity sweeps, BOS / CHoCH, supply and demand'], ['Full trade plan', 'Entry, ATR stop loss, TP1 · TP2 · TP3 at 1R, 2R, 3R'], ['Verifiable results', 'R-based backtest on closed candles. No made-up numbers.']],
    plan: 'Every signal comes with', entry: 'Entry', sl: 'Stop loss', tps: 'Targets',
    price: 'USD / 30 days', pay: 'Paid in crypto · all included', cta: 'Link in bio', start: 'Create your account',
    risk: 'Trading involves a risk of capital loss. Not financial advice.'
  },
  ar: {
    siteLang: 'العربية', hook1: 'كتداول الذهب؟', hook2: 'بلا تخمين.',
    tag: 'وكيل ذكاء اصطناعي · XAU/USD · BTC/USD · EUR/USD', title: 'البوت يقرأ هيكل السوق.\nوأنت تبقى المتحكم.',
    features: [['هيكل السوق', 'سحب السيولة، BOS / CHoCH، مناطق العرض والطلب'], ['خطة تداول كاملة', 'الدخول، وقف الخسارة حسب ATR، TP1 · TP2 · TP3 عند 1R و2R و3R'], ['نتائج قابلة للتحقق', 'اختبار تاريخي على الشموع المغلقة. بلا أرقام مخترعة.']],
    plan: 'كل إشارة فيها', entry: 'الدخول', sl: 'وقف الخسارة', tps: 'الأهداف',
    price: 'دولار / 30 يوم', pay: 'الدفع بالكريبتو · كلشي مشمول', cta: 'الرابط في البايو', start: 'سجّل حسابك',
    risk: 'التداول فيه خطر خسارة رأس المال. ليست نصيحة مالية.'
  }
};

const esc = v => String(v).replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
const br = v => esc(v).replace(/\n/g, '<br>');

export function promoHtml({lang = 'fr', url = 'pipvoria.com', handle = '', shot = '', shotHeight = 0} = {}) {
  const T = TEXT[lang] || TEXT.fr;
  const rtl = lang === 'ar';
  const icon = fs.readFileSync(path.join(ROOT, 'pipvoria-icon.svg'), 'utf8');
  const logo = 'data:image/svg+xml;base64,' + Buffer.from(icon).toString('base64');
  // Défilement dans le téléphone : de l'en-tête jusqu'aux fonctionnalités (~40 % de la page).
  const scroll = shotHeight ? Math.round(shotHeight * 0.4) : 0;
  return `<!doctype html><html dir="${rtl ? 'rtl' : 'ltr'}"><head><meta charset="utf-8"><style>
*{box-sizing:border-box;margin:0;padding:0}
html,body{width:1080px;height:1920px;overflow:hidden;background:#0a0d16;color:#eef0f8;font-family:Inter,'DejaVu Sans',system-ui,sans-serif}
.bg{position:absolute;inset:0;background:radial-gradient(900px 800px at 85% 5%,#9d8cff40,transparent 70%),radial-gradient(900px 900px at 0% 100%,#22c58b22,transparent 70%)}
.grid{position:absolute;inset:0;background-image:linear-gradient(#ffffff07 1px,transparent 1px),linear-gradient(90deg,#ffffff07 1px,transparent 1px);background-size:90px 90px}
.scene{position:absolute;left:70px;right:140px;top:150px;bottom:380px;opacity:0;display:flex;flex-direction:column}
.a{opacity:0}
.brand{display:flex;align-items:center;gap:20px;font-size:44px;font-weight:800}
.brand img{width:78px;height:78px}
.mono{font-family:'JetBrains Mono','DejaVu Sans Mono',monospace;direction:ltr;unicode-bidi:isolate}
.accent{color:#9d8cff}
/* 1 · accroche */
.hook{justify-content:center;gap:30px}
.hook .h1{font-size:120px;font-weight:900;line-height:1.02;letter-spacing:-.03em}
.hook .h2{font-size:120px;font-weight:900;line-height:1.02;letter-spacing:-.03em;color:#9d8cff}
.gold{width:300px;height:300px;align-self:center;margin-top:30px;border-radius:50%;background:radial-gradient(circle at 35% 30%,#ffe9a6,#e2b440 45%,#8a6412);box-shadow:0 0 140px #e2b44077;display:grid;place-items:center;font-size:64px;font-weight:900;color:#3b2a05}
/* 2 · site */
.site .tag{margin-top:26px;font-size:28px;color:#9d8cff;letter-spacing:.06em;font-weight:700}
.site .title{margin-top:14px;font-size:56px;font-weight:850;line-height:1.08;letter-spacing:-.02em}
.phone{margin-top:40px;align-self:center;width:560px;height:900px;border-radius:64px;border:14px solid #1d2335;background:#0a0d16;overflow:hidden;position:relative;box-shadow:0 40px 120px #000a,0 0 0 2px #2c3450}
.phone img{position:absolute;left:0;top:0;width:100%}
.phone .notch{position:absolute;top:14px;left:50%;width:150px;height:36px;margin-left:-75px;border-radius:20px;background:#000;z-index:2}
/* 3 · fonctionnalités */
.feat{gap:26px;justify-content:center}
.feat .card{padding:34px 36px;border-radius:30px;background:#121726ee;border:2px solid #262d45}
.feat .n{font-size:30px;color:#9d8cff;font-weight:700}
.feat .t{font-size:52px;font-weight:850;margin-top:8px;letter-spacing:-.01em}
.feat .d{font-size:32px;color:#a3a9be;margin-top:10px;line-height:1.35}
/* 4 · plan de trade */
.plan{justify-content:center}
.plan .lead{font-size:60px;font-weight:850;margin:40px 0 36px}
.plan .sides{display:flex;gap:20px;margin-bottom:30px}
.pill{padding:16px 44px;border-radius:999px;font-size:60px;font-weight:900}
.buy{background:#22c58b;color:#06110c;box-shadow:0 0 60px #22c58b77}.sell{background:#ff5a6e;color:#1a0408;box-shadow:0 0 60px #ff5a6e66}
.lv{display:flex;align-items:center;justify-content:space-between;padding:28px 36px;border-radius:26px;background:#121726ee;border:2px solid #262d45;margin-top:18px;font-size:44px;font-weight:800}
.lv .r{font-size:38px}
.lv.e{border-color:#9d8cff}.lv.e .r{color:#c9bfff}
.lv.s{border-color:#ff5a6e88}.lv.s .r{color:#ff8a98}
.lv.t{border-color:#22c58b88}.lv.t .r{color:#5fe0ad}
/* 5 · prix et appel à l'action */
.price{justify-content:center;align-items:center;text-align:center}
.price .pro{font-size:44px;font-weight:800;margin-top:60px}
.price .big{display:flex;align-items:baseline;gap:20px;margin-top:10px}
.price .big b{font-size:240px;font-weight:900;letter-spacing:-.04em;line-height:1}
.price .big span{font-size:44px;color:#a3a9be;font-weight:700}
.price .pay{font-size:34px;color:#a3a9be;margin-top:10px}
.price .btn{margin-top:60px;padding:30px 70px;border-radius:999px;background:#9d8cff;color:#0a0d16;font-size:52px;font-weight:900;box-shadow:0 0 80px #9d8cff77}
.price .url{margin-top:36px;font-size:58px;font-weight:850}
.price .bio{margin-top:10px;font-size:36px;color:#9d8cff;font-weight:700}
.risk{position:absolute;left:70px;right:140px;bottom:390px;font-size:24px;color:#6f768d;text-align:center}
.bar{position:absolute;left:0;top:0;height:8px;background:#9d8cff}
</style></head><body><div class="bg"></div><div class="grid"></div>

<div class="scene hook" data-s="0" data-e="3.2">
  <div class="brand a" data-in="0"><img src="${logo}" alt=""><span>Pipvoria</span></div>
  <div class="h1 a" data-in="0.25">${esc(T.hook1)}</div>
  <div class="h2 a" data-in="0.9">${esc(T.hook2)}</div>
  <div class="gold a" data-in="1.4" data-pop><span class="mono">XAU</span></div>
</div>

<div class="scene site" data-s="3.2" data-e="10">
  <div class="brand a" data-in="3.3"><img src="${logo}" alt=""><span>Pipvoria</span></div>
  <div class="tag a" data-in="3.45">${esc(T.tag)}</div>
  <div class="title a" data-in="3.6">${br(T.title)}</div>
  <div class="phone a" data-in="3.9"><div class="notch"></div>${shot ? `<img id="shot" src="${shot}" alt="">` : ''}</div>
</div>

<div class="scene feat" data-s="10" data-e="15.5">
  ${T.features.map(([t, d], i) => `<div class="card a" data-in="${(10.2 + i * 0.6).toFixed(1)}"><div class="n mono">0${i + 1}</div><div class="t">${esc(t)}</div><div class="d">${esc(d)}</div></div>`).join('')}
</div>

<div class="scene plan" data-s="15.5" data-e="19.6">
  <div class="brand a" data-in="15.6"><img src="${logo}" alt=""><span>Pipvoria</span></div>
  <div class="lead a" data-in="15.75">${esc(T.plan)}</div>
  <div class="sides a" data-in="16" data-pop><div class="pill buy mono">BUY</div><div class="pill sell mono">SELL</div></div>
  <div class="lv e a" data-in="16.4"><span>${esc(T.entry)}</span><span class="r mono">ENTRY</span></div>
  <div class="lv s a" data-in="16.75"><span>${esc(T.sl)}</span><span class="r mono">SL · ATR</span></div>
  <div class="lv t a" data-in="17.1"><span>${esc(T.tps)}</span><span class="r mono">TP1 · TP2 · TP3</span></div>
  <div class="lv t a" data-in="17.45"><span class="mono">R:R</span><span class="r mono">1R · 2R · 3R</span></div>
</div>

<div class="scene price" data-s="19.6" data-e="999">
  <img class="a" data-in="19.7" data-pop src="${logo}" alt="" style="width:150px;height:150px">
  <div class="pro a" data-in="19.85">Pipvoria Pro</div>
  <div class="big a" data-in="20.1" data-pop><b class="mono">49</b><span>${esc(T.price)}</span></div>
  <div class="pay a" data-in="20.4">${esc(T.pay)}</div>
  <div class="btn a" data-in="20.8" data-pop>${esc(T.start)}</div>
  <div class="url mono a" data-in="21.2">${esc(url)}</div>
  <div class="bio a" data-in="21.4">${handle ? `<span class="mono">${esc(handle)}</span> · ` : ''}${esc(T.cta)} ↓</div>
</div>
<div class="risk a" data-in="19.8">${esc(T.risk)}</div>
<div class="bar" id="bar"></div>

<script>
const D=${DURATION},SCROLL=${scroll};
const clamp=x=>Math.min(Math.max(x,0),1);
const ease=x=>1-Math.pow(1-clamp(x),3);
const inout=x=>{x=clamp(x);return x<.5?4*x*x*x:1-Math.pow(-2*x+2,3)/2};
const back=x=>{x=clamp(x);const c=1.7;return 1+(c+1)*Math.pow(x-1,3)+c*Math.pow(x-1,2)};
window.render=t=>{
  for(const s of document.querySelectorAll('.scene')){
    const a=Number(s.dataset.s),b=Number(s.dataset.e);
    const o=Math.min(ease((t-a)/0.35),ease((b-t)/0.35));
    s.style.opacity=o;s.style.transform='translateY('+(1-ease((t-a)/0.5))*30+'px) scale('+(0.97+0.03*ease((b-t)/0.35))+')';
  }
  for(const el of document.querySelectorAll('[data-in]')){
    const p=(t-Number(el.dataset.in))/0.5;
    el.style.opacity=ease(p);
    el.style.transform=el.hasAttribute('data-pop')?'scale('+(0.4+0.6*back(p))+')':'translateY('+(1-ease(p))*50+'px)';
  }
  const shot=document.getElementById('shot');
  if(shot)shot.style.transform='translateY('+(-SCROLL*inout((t-4.8)/4.6))+'px)';
  document.getElementById('bar').style.width=(t/D*100)+'%';
};
window.render(0);
</script></body></html>`;
}

// Sert public/ localement et capture la page d'accueil en vue mobile.
export async function captureLanding(lang) {
  const types = {'.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.json': 'application/json', '.webmanifest': 'application/manifest+json'};
  const server = http.createServer((req, res) => {
    const rel = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    let file = path.join(ROOT, rel === '/' ? 'index.html' : rel);
    if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(ROOT, 'index.html');
    res.writeHead(200, {'content-type': types[path.extname(file)] || 'application/octet-stream'});
    fs.createReadStream(file).pipe(res);
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const {chromium} = await loadPlaywright();
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({viewport: {width: 430, height: 932}, deviceScaleFactor: 2});
    // Pas d'appel réseau vers l'API pendant la capture : la page d'accueil est statique.
    await page.route(/\/api\//, r => r.fulfill({status: 503, body: '{}', contentType: 'application/json'}));
    await page.goto(`http://127.0.0.1:${server.address().port}/`, {waitUntil: 'networkidle'});
    const select = page.locator('select[aria-label]').first();
    if (await select.count()) await select.selectOption({label: TEXT[lang].siteLang}).catch(() => {});
    await page.waitForTimeout(800);
    // Masque le bandeau d'erreur de session : il n'a pas de sens hors ligne.
    await page.addStyleTag({content: '.terminal-notice{display:none!important}'});
    const buffer = await page.screenshot({type: 'jpeg', quality: 88, fullPage: true});
    const height = await page.evaluate(() => document.documentElement.scrollHeight);
    return {shot: 'data:image/jpeg;base64,' + buffer.toString('base64'), height};
  } finally {
    await browser.close();
    server.close();
  }
}

async function main() {
  const {values} = parseArgs({options: {
    lang: {type: 'string', default: 'fr'}, url: {type: 'string', default: 'pipvoria.com'}, handle: {type: 'string', default: ''},
    fps: {type: 'string', default: '30'}, out: {type: 'string', default: 'pipvoria-promo.mp4'}, html: {type: 'boolean', default: false}
  }});
  if (!TEXT[values.lang]) throw Error('--lang doit être fr, en ou ar');
  const {shot, height} = await captureLanding(values.lang);
  // Le téléphone affiche la capture sur 532 px de large (560 − bordures) ; la page fait 430 px CSS.
  const html = promoHtml({...values, shot, shotHeight: Math.round(height * 532 / 430)});
  if (values.html) return process.stdout.write(html);
  const fps = Math.min(Math.max(Number(values.fps) || 30, 10), 60);
  const out = path.resolve(values.out);
  await renderVideo(html, {fps, frames: DURATION * fps, out});
  console.log('Vidéo créée : ' + out);
}

if (import.meta.url === `file://${process.argv[1]}`) main().catch(e => { console.error(e.message); process.exit(1); });
