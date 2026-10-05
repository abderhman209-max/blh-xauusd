(function () {
  'use strict';
  const content = document.querySelector('.portal-content');
  const signals = document.querySelector('#view-signals');
  if (!content || !signals) return;
  const $ = selector => document.querySelector(selector);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const labels = {
    fr: ['Graphique','Résumé','Opérations','Trader','Positions','Calendrier','Historique','Plus','Compte personnel','État','Actif','Progression','Objectif','Règles','À définir','En cours','Atteint','Respectées','À vérifier','Limite dépassée','Régler l’objectif','Objectif de résultat (R)','Risque maximal par trade (%)','Enregistrer','Trades clôturés','Résultat net','Aucune position enregistrée','Les trades planifiés et actifs de votre journal apparaissent ici.','Ouvrir le journal','Suivi personnel calculé depuis votre journal.','Indicateurs','Outils du graphique','Compte déconnecté','Risque maximal','À renseigner'],
    en: ['Chart','Summary','Trades','Trade','Positions','Calendar','History','More','Personal account','Status','Active','Progress','Target','Rules','Not set','In progress','Reached','Within limit','To check','Limit exceeded','Set target','Result target (R)','Maximum risk per trade (%)','Save','Closed trades','Net result','No saved positions','Planned and active trades from your journal appear here.','Open journal','Personal tracking calculated from your journal.','Indicators','Chart tools','Signed out','Maximum risk','Not recorded'],
    es: ['Gráfico','Resumen','Operaciones','Operar','Posiciones','Calendario','Historial','Más','Cuenta personal','Estado','Activa','Progreso','Objetivo','Reglas','Por definir','En curso','Alcanzado','Cumpliendo','Por comprobar','Límite superado','Definir objetivo','Objetivo de resultado (R)','Riesgo máximo por operación (%)','Guardar','Operaciones cerradas','Resultado neto','Sin posiciones guardadas','Las operaciones planificadas y activas de tu diario aparecen aquí.','Abrir diario','Seguimiento personal calculado desde tu diario.','Indicadores','Herramientas del gráfico','Sesión cerrada','Riesgo máximo','Sin registrar'],
    de: ['Chart','Übersicht','Trades','Handeln','Positionen','Kalender','Verlauf','Mehr','Persönliches Konto','Status','Aktiv','Fortschritt','Ziel','Regeln','Nicht festgelegt','In Bearbeitung','Erreicht','Eingehalten','Zu prüfen','Limit überschritten','Ziel festlegen','Ergebnisziel (R)','Maximales Risiko je Trade (%)','Speichern','Geschlossene Trades','Nettoergebnis','Keine gespeicherten Positionen','Geplante und aktive Trades aus deinem Journal erscheinen hier.','Journal öffnen','Persönliche Auswertung anhand deines Journals.','Indikatoren','Chart-Werkzeuge','Abgemeldet','Maximales Risiko','Nicht erfasst'],
    ar: ['الرسم البياني','الملخص','الصفقات','تداول','المراكز','التقويم','السجل','المزيد','الحساب الشخصي','الحالة','نشط','التقدم','الهدف','القواعد','غير محدد','قيد التقدم','تحقق','ضمن الحد','للتحقق','تجاوز الحد','تحديد الهدف','هدف النتيجة (R)','أقصى مخاطرة لكل صفقة (%)','حفظ','الصفقات المغلقة','النتيجة الصافية','لا توجد مراكز محفوظة','تظهر هنا الصفقات المخططة والنشطة من سجلك.','فتح السجل','تتبع شخصي محسوب من سجل التداول.','المؤشرات','أدوات الرسم','غير متصل','أقصى مخاطرة','غير مسجل']
  };
  const t = index => (labels[document.documentElement.lang === 'ary' ? 'ar' : document.documentElement.lang] || labels.fr)[index];
  const format = value => new Intl.NumberFormat(document.documentElement.lang === 'ary' ? 'ar-MA' : document.documentElement.lang, {maximumFractionDigits: 2}).format(value);
  const lang = () => document.documentElement.lang === 'ary' ? 'ar' : document.documentElement.lang;
  const paths = {
    trade: '<path d="M5 7h14M15 3l4 4-4 4M19 17H5m4-4-4 4 4 4"/>',
    positions: '<rect x="5" y="5" width="14" height="16" rx="2"/><path d="M9 5V3h6v2M9 10h6m-6 4h6m-6 4h3"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4m10-4v4M3 10h18m-14 4h2m3 0h2m3 0h1m-11 4h2m3 0h2"/>',
    history: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/>',
    more: '<path d="M5 6h14M5 12h14M5 18h14"/>',
    shield: '<path d="m12 3 8 3v6c0 5-8 9-8 9S4 17 4 12V6z"/><path d="m8 12 3 3 5-6"/>',
    grid: '<rect x="3" y="3" width="6" height="6" rx="1"/><rect x="15" y="3" width="6" height="6" rx="1"/><rect x="3" y="15" width="6" height="6" rx="1"/><rect x="15" y="15" width="6" height="6" rx="1"/>',
    tools: '<path d="M4 17 17 4M4 4h5m-5 0v5m16 11h-5m5 0v-5"/><circle cx="7" cy="17" r="2"/><circle cx="17" cy="7" r="2"/>',
    settings: '<path d="M4 7h16M4 17h16"/><circle cx="9" cy="7" r="3"/><circle cx="15" cy="17" r="3"/>'
  };
  const icon = name => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.grid}</svg>`;
  const node = (tag, className, html) => { const el = document.createElement(tag); el.className = className; if (html) el.innerHTML = html; return el; };
  const stylesheet = document.createElement('link');
  stylesheet.rel = 'stylesheet'; stylesheet.href = 'dashboard.css?v=20261005a'; document.head.append(stylesheet);
  document.body.classList.add('reference-dashboard');
  document.body.dataset.dashboardLayout = 'reference';

  const shell = node('section', 'dashboard-shell');
  const account = node('aside', 'dashboard-account');
  account.innerHTML = `<h1 data-dash-label="8"></h1><div class="dash-account-section dash-status"><span data-dash-label="9"></span><strong id="dash-account-status"></strong></div><div class="dash-account-section dash-progress"><span data-dash-label="11"></span><strong id="dash-progress-value">—</strong><div class="dash-progress-track" role="progressbar" aria-valuemin="0" aria-valuemax="100"><i></i></div><small id="dash-progress-detail"></small></div><div class="dash-account-section dash-rule-row"><div><span data-dash-label="12"></span><strong id="dash-goal-status"></strong></div>${icon('shield')}</div><div class="dash-account-section dash-rule-row"><div><span data-dash-label="13"></span><strong id="dash-rule-status"></strong></div>${icon('shield')}</div><div class="dash-account-metrics"><div><span data-dash-label="24"></span><b id="dash-closed-count">0</b></div><div><span data-dash-label="25"></span><b id="dash-net-result">—</b></div></div><details class="dash-goal-settings"><summary>${icon('settings')}<span data-dash-label="20"></span></summary><form id="dash-goal-form"><label><span data-dash-label="21"></span><input id="dash-target-r" type="number" min="0.1" max="10000" step="0.1" inputmode="decimal" required></label><label><span data-dash-label="22"></span><input id="dash-risk-limit" type="number" min="0.01" max="100" step="0.1" inputmode="decimal" value="2" required></label><button type="submit" data-dash-label="23"></button></form></details><p class="dash-account-note" data-dash-label="29"></p>`;
  const main = node('main', 'dashboard-main');
  const tabs = node('nav', 'dashboard-tabs', `<a href="#signals" data-dash-route="signals" data-dash-label="0"></a><a href="#performance" data-dash-route="performance" data-dash-label="1"></a><a href="#positions" data-dash-route="positions" data-dash-label="2"></a>`);
  const views = node('div', 'dashboard-views');
  views.append(...content.children);
  const positions = node('section', 'portal-view dashboard-positions');
  positions.id = 'view-positions'; positions.hidden = true;
  const positionList = node('div', 'dashboard-position-list'); positions.append(positionList);
  const cockpit = views.querySelector('.signal-cockpit'), toolkit = views.querySelector('.portal-toolkit');
  if (cockpit) positions.append(cockpit);
  if (toolkit) positions.append(toolkit);
  views.append(positions);
  const bottom = node('nav', 'dashboard-bottom', [
    ['signals','trade',3],['positions','positions',4],['news','calendar',5],['history','history',6]
  ].map(([route, glyph, label]) => `<a href="#${route}" data-dash-route="${route}">${icon(glyph)}<span data-dash-label="${label}"></span></a>`).join('') + `<button type="button" id="dash-more" aria-expanded="false" aria-controls="portal-sidebar">${icon('more')}<span data-dash-label="7"></span></button>`);
  main.append(tabs, views, bottom); shell.append(account, main); content.append(shell);
  const goalPreferences = node('article', 'surface dashboard-goal-preferences');
  goalPreferences.append(account.querySelector('.dash-goal-settings'));
  $('#view-settings').append(goalPreferences);
  $('#dash-risk-limit').step = '0.01';
  for (const brand of document.querySelectorAll('.portal-brand')) {
    const wordmark = node('span', 'dash-wordmark', '<svg viewBox="0 0 32 32" fill="none" aria-hidden="true"><path d="m5 5 22 22M12 5l15 15M5 27 27 5M5 20 20 5" stroke="currentColor" stroke-width="1.6"/></svg><span>PIPVORIA</span>'); brand.append(wordmark);
  }

  const toolbar = $('.chart-top');
  const controls = node('div', 'dashboard-chart-controls');
  const interval = node('select', 'dash-interval');
  for (const button of document.querySelectorAll('.frames [data-interval]')) {
    const option = document.createElement('option'); option.value = button.dataset.interval; option.textContent = button.textContent; option.selected = button.classList.contains('active'); interval.append(option);
  }
  interval.addEventListener('change', () => { $(`.frames [data-interval="${interval.value}"]`)?.click(); });
  const toolsButton = node('button', 'dash-square', icon('tools')); toolsButton.type = 'button'; toolsButton.setAttribute('aria-pressed','false');
  toolsButton.onclick = () => { const active = document.body.classList.toggle('dashboard-tools-open'); toolsButton.setAttribute('aria-pressed', String(active)); };
  controls.append(interval, toolsButton); toolbar?.append(controls);
  document.querySelectorAll('.frames [data-interval]').forEach(button => button.addEventListener('click', () => { interval.value = button.dataset.interval; }));
  $('#dash-more').onclick = () => $('#portal-menu')?.click();
  const sidebar = $('#portal-sidebar');
  function syncMenu() { const open = document.body.classList.contains('menu-open'); $('#dash-more').setAttribute('aria-expanded',String(open)); if (sidebar) { sidebar.inert = !open; sidebar.setAttribute('aria-hidden',String(!open)); if (open) sidebar.querySelector('a[data-route]')?.focus(); } }
  new MutationObserver(syncMenu).observe(document.body, {attributes:true,attributeFilter:['class']});
  syncMenu();

  let snapshot = window.PIPVORIA_WORKSPACE?.getSnapshot() || {journal:[],loaded:false};
  let goal = null;document.addEventListener('pipvoria-settings-state',()=>{const saved=window.PIPVORIA_SETTINGS?.get().goal;goal=saved||null;$('#dash-target-r').value=goal?.targetR||'';$('#dash-risk-limit').value=goal?.maxRisk||2;refreshAccount()});
  const goalKey = () => 'pipvoria-dashboard-goal:' + (window.BLH_AUTH?.user?.id || 'local');
  function loadGoal() {
    goal = null;
    try { const saved = JSON.parse(localStorage.getItem(goalKey()) || 'null'); if (saved && Number.isFinite(saved.targetR) && saved.targetR > 0 && Number.isFinite(saved.maxRisk) && saved.maxRisk > 0 && saved.maxRisk <= 100) goal = saved; } catch {}
    $('#dash-target-r').value = goal?.targetR || ''; $('#dash-risk-limit').value = goal?.maxRisk || 2;
  }
  function refreshAccount() {
    const trades = (snapshot.journal || []).filter(row => row.kind === 'trade');
    const closed = trades.filter(row => ['win','loss','breakeven'].includes(row.status));
    const results = closed.filter(row => row.resultR !== null && row.resultR !== '' && Number.isFinite(Number(row.resultR)));
    const net = results.reduce((sum,row) => sum + Number(row.resultR),0);
    const progress = goal ? Math.max(0,Math.min(100,net / goal.targetR * 100)) : null;
    $('#dash-account-status').textContent = t(window.BLH_AUTH?.authenticated ? 10 : 32);
    $('#dash-progress-value').textContent = progress === null ? '—' : format(Math.round(progress)) + '%';
    const track = $('.dash-progress-track'); track.setAttribute('aria-label',t(11)); track.firstElementChild.style.width = (progress || 0) + '%';
    if (progress === null) track.removeAttribute('aria-valuenow'); else track.setAttribute('aria-valuenow',String(progress));
    $('#dash-progress-detail').textContent = goal ? `${format(net)} R / ${format(goal.targetR)} R` : t(14);
    const goalStatus = $('#dash-goal-status'); goalStatus.textContent = t(!goal ? 14 : progress >= 100 ? 16 : 15); goalStatus.classList.toggle('dash-positive',!!goal);
    const assessed = trades.filter(row => row.riskPercent !== null && row.riskPercent !== '' && Number.isFinite(Number(row.riskPercent)) && Number(row.riskPercent) > 0);
    const breached = !!goal && assessed.some(row => Number(row.riskPercent) > goal.maxRisk);
    const complete = !!goal && trades.length > 0 && assessed.length === trades.length;
    const ruleStatus = $('#dash-rule-status'); ruleStatus.textContent = t(breached ? 19 : complete ? 17 : 18); ruleStatus.classList.toggle('dash-positive',complete && !breached); ruleStatus.classList.toggle('dash-negative',breached);
    $('.dash-rule-row:last-of-type')?.classList.toggle('breached',breached);
    $('#dash-closed-count').textContent = String(closed.length);
    $('#dash-net-result').textContent = results.length ? (net > 0 ? '+' : '') + format(net) + ' R' : '—';
    $('#dash-net-result').classList.toggle('dash-negative',net < 0);
    renderPositions();
  }
  const positionFilter={market:'all',status:'all',strategy:'all'};
  positionList.addEventListener('change',event=>{if(event.target.dataset.positionFilter){positionFilter[event.target.dataset.positionFilter]=event.target.value;renderPositions()}});
  function renderPositions(){const all=(snapshot.journal||[]).filter(r=>r.kind==='trade'&&['active','planned'].includes(r.status)),rows=all.filter(r=>Object.entries(positionFilter).every(([k,v])=>v==='all'||r[k==='market'?'symbol':k]===v));const values={market:['XAU/USD','BTC/USD'],status:['active','planned'],strategy:[...new Set(all.map(r=>r.strategy).filter(Boolean))]};positionList.innerHTML=`<div class="page-title"><h1>${esc(t(4))}</h1><p>${esc(t(27))}</p></div><div class="journal-controls">${Object.entries(values).map(([key,options])=>`<select data-position-filter="${key}" aria-label="${key}"><option value="all">${esc(key)} · *</option>${options.map(v=>`<option value="${esc(v)}" ${v===positionFilter[key]?'selected':''}>${esc(v)}</option>`).join('')}</select>`).join('')}</div>${rows.length?`<div class="dash-position-grid">${rows.map(row=>`<article class="surface dash-position-card"><header><strong>${esc(row.symbol)}</strong><span class="dash-side ${row.direction==='sell'?'sell':'buy'}">${esc(String(row.direction||'').toUpperCase())}</span></header><small>${esc(row.interval)} · ${esc(row.strategy||'—')} · ${esc(row.status)} · ${esc(new Date(row.createdAt).toLocaleString(lang(),{timeZone:window.PIPVORIA_SETTINGS?.get().timezone||'UTC'}))}</small><div>${[['ENTRY',row.entry],['SL',row.stopLoss],...[0,1,2].map(i=>['TP'+(i+1),row.takeProfits?.[i]])].map(([label,value])=>`<span>${label} <b>${window.PIPVORIA_CORE.numeric(value)?esc(format(value)):'—'}</b></span>`).join('')}</div><small>${esc(t(33))}: ${row.riskPercent??'—'}% · ${esc(t(11))}: ${(row.targetHits||[]).filter(Boolean).length}/3</small><a href="#history">${esc(t(28))} ↗</a></article>`).join('')}</div>`:`<article class="surface dash-position-empty"><h2>${esc(t(26))}</h2><a href="#history">${esc(t(28))} ↗</a></article>`}`;
  }
  function translate() {
    document.querySelectorAll('[data-dash-label]').forEach(el => { el.textContent = t(Number(el.dataset.dashLabel)); });
    tabs.setAttribute('aria-label', t(0)); bottom.setAttribute('aria-label', t(7)); interval.setAttribute('aria-label', $('.frames')?.getAttribute('aria-label') || 'Timeframe');
    toolsButton.title = t(31); toolsButton.setAttribute('aria-label',t(31)); refreshAccount();
  }
  function route() {
    const key = location.hash.slice(1) || 'signals';
    const isPositions = key === 'positions';
    if (isPositions) { for (const view of views.querySelectorAll('.portal-view')) view.hidden = true; }
    positions.hidden = !isPositions;
    document.querySelectorAll('[data-dash-route]').forEach(link => { const active = link.dataset.dashRoute === key; link.classList.toggle('selected',active); if (active) link.setAttribute('aria-current','page'); else link.removeAttribute('aria-current'); });
    if (isPositions) renderPositions();
    if (key === 'signals') requestAnimationFrame(() => { if (typeof renderIndicator === 'function') renderIndicator(); });
  }
  $('#dash-goal-form').addEventListener('submit', event => {
    event.preventDefault(); const targetR = Number($('#dash-target-r').value), maxRisk = Number($('#dash-risk-limit').value);
    if (!Number.isFinite(targetR) || targetR <= 0 || !Number.isFinite(maxRisk) || maxRisk <= 0 || maxRisk > 100) return;
    goal = {targetR,maxRisk}; window.PIPVORIA_SETTINGS?.update({goal}); try { localStorage.setItem(goalKey(),JSON.stringify(goal)); } catch {}
    $('.dash-goal-settings').open = false; refreshAccount();
  });
  document.addEventListener('pipvoria-workspace-state', event => { snapshot = event.detail; refreshAccount(); });
  document.addEventListener('blh-authenticated', () => { window.PIPVORIA_THEME?.set('dark',false); snapshot = window.PIPVORIA_WORKSPACE?.getSnapshot() || {journal:[],loaded:false}; loadGoal(); refreshAccount(); });
  document.addEventListener('blh-session-expired', () => { snapshot = {journal:[],loaded:false}; goal = null; refreshAccount(); });
  document.addEventListener('blh-language-change', translate);
  window.addEventListener('hashchange',route);
  window.addEventListener('storage',event => { if (event.key === goalKey()) { loadGoal(); refreshAccount(); } });
  if (window.BLH_AUTH?.authenticated) window.PIPVORIA_THEME?.set('dark',false);
  loadGoal(); translate(); route();
})();
