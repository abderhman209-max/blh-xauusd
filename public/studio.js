(function () {
  'use strict';
  const shell = document.querySelector('.dashboard-shell');
  if (!shell) return;
  // The redesigned result card is always expanded, including on mobile.
  document.querySelector('.dashboard-account')?.classList.add('desk-account-open');
  const copy = {
    markets: ['Markets','Märkte','Marchés','Mercados','الأسواق','الأسواق'],
    support: ['Support','Support','Support','Soporte','الدعم','الدعم'],
    connected: ['Connected','Verbunden','Connecté','Conectado','متصل','متصل'],
    feed: ['Feed','Daten','Flux','Datos','البيانات','البيانات'],
    unloaded: ['Open chart','Chart öffnen','Ouvrir le graphique','Abrir gráfico','افتح الرسم','حل الشارت'],
    stale: ['Older data','Ältere Daten','Données anciennes','Datos antiguos','بيانات قديمة','بيانات قديمة'],
    candle: ['Candle','Kerze','Bougie','Vela','شمعة','شمعة'],
    navigation: ['Trading views','Trading-Ansichten','Vues de trading','Vistas de trading','واجهات التداول','واجهات التداول']
  };
  const t = key => copy[key][({en:0,de:1,fr:2,es:3,ar:4,ary:5})[document.documentElement.lang] ?? 2];
  const make = (tag, className, text) => { const n=document.createElement(tag); n.className=className; if(text)n.textContent=text; return n; };
  const quotes = new Map();
  let current = window.PIPVORIA_CHART_STATE;
  const strip = make('section','studio-markets');
  const cards = new Map();
  for (const symbol of ['XAU/USD','BTC/USD']) {
    const button=make('button','studio-market');button.type='button';button.dataset.studioSymbol=symbol;
    const heading=make('span','studio-market-heading');heading.append(make('strong','',symbol),make('span','studio-market-change','—'));
    button.append(heading,make('span','studio-market-price','—'),make('small','studio-market-source'));
    button.onclick=()=>{if(location.hash!=='#signals')location.hash='signals';document.querySelector('.symbol-switcher [data-symbol="'+symbol+'"]')?.click()};
    cards.set(symbol,button);strip.append(button);
  }
  shell.prepend(strip);
  const tabs=document.querySelector('.dashboard-tabs');if(tabs){shell.insertBefore(tabs,document.querySelector('.dashboard-account'));tabs.classList.add('studio-tabs')}
  const bottom=document.querySelector('.dashboard-bottom');if(bottom)shell.before(bottom);
  const support=make('a','studio-support');support.href='#support';support.dataset.dashRoute='support';
  support.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 13v-1a8 8 0 0 1 16 0v1M4 12H3v6h3v-6Zm16 0h1v6h-3v-6ZM18 18v2h-6"/></svg>';
  support.append(make('span',''));bottom?.insertBefore(support,document.querySelector('#dash-more'));
  const session=make('span','studio-session');document.querySelector('.portal-brand')?.after(session);
  const feed=make('span','studio-feed-label');document.querySelector('#feed-toggle')?.append(feed);

  function renderQuotes() {
    for (const [symbol,card] of cards) {
      const state=quotes.get(symbol),hasPrice=Number.isFinite(state?.price)&&state.price>0;
      const stale=!state||state.stale||!state.receivedAt||Date.now()-state.receivedAt>120000;
      const rawChange=hasPrice&&Number.isFinite(state.bar?.open)&&state.bar.open>0?(state.price/state.bar.open-1)*100:null;
      const change=Number.isFinite(rawChange)?rawChange:null;
      const active=symbol===current?.symbol;card.classList.toggle('selected',active);card.classList.toggle('studio-market-stale',hasPrice&&stale);card.setAttribute('aria-pressed',String(active));
      card.querySelector('.studio-market-price').textContent=hasPrice?new Intl.NumberFormat(document.documentElement.lang==='ary'?'ar-MA':document.documentElement.lang,{minimumFractionDigits:2,maximumFractionDigits:2}).format(state.price):'—';
      const percent=card.querySelector('.studio-market-change');percent.textContent=change===null||stale?'—':(change>0?'+':'')+new Intl.NumberFormat(document.documentElement.lang==='ary'?'ar-MA':document.documentElement.lang,{maximumFractionDigits:2}).format(change)+'%';
      percent.classList.toggle('positive',!stale&&change>0);percent.classList.toggle('negative',!stale&&change<0);
      card.querySelector('.studio-market-source').textContent=!hasPrice?t('unloaded'):stale?t('stale'):state.source+' · '+t('candle')+' '+state.interval.replace('min','m');
    }
  }
  function syncRoute() {
    const route=location.hash.slice(1)||'signals';strip.hidden=!['signals','performance','positions'].includes(route);if(tabs)tabs.hidden=strip.hidden;
    support.classList.toggle('selected',route==='support');if(route==='support')support.setAttribute('aria-current','page');else support.removeAttribute('aria-current');
  }
  function translate() {
    strip.setAttribute('aria-label',t('markets'));tabs?.setAttribute('aria-label',t('navigation'));support.querySelector('span').textContent=t('support');feed.textContent=t('feed');
    session.textContent=t('connected');session.hidden=!window.BLH_AUTH?.authenticated;renderQuotes();
  }
  function accept(state) {current=state;if(state&&cards.has(state.symbol))quotes.set(state.symbol,state);renderQuotes()}
  document.addEventListener('pipvoria-chart-state',event=>accept(event.detail));
  document.addEventListener('blh-language-change',translate);
  document.addEventListener('blh-authenticated',()=>{quotes.clear();current=null;translate()});
  document.addEventListener('blh-session-expired',()=>{quotes.clear();current=null;session.hidden=true;renderQuotes()});
  window.addEventListener('hashchange',syncRoute);
  setInterval(()=>{if(!document.hidden)renderQuotes()},10000);
  accept(current);translate();syncRoute();
})();
