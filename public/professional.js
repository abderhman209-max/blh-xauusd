(function () {
  'use strict';
  const $ = s => document.querySelector(s);
  const copy = {
    account:['Account','Konto','Compte','Cuenta','الحساب','الحساب'],
    chart:['Chart','Chart','Graphique','Gráfico','الرسم البياني','الرسم البياني'],
    chartSettings:['Chart settings','Chart-Einstellungen','Réglages du graphique','Ajustes del gráfico','إعدادات الرسم البياني','إعدادات الرسم البياني'],
    alerts:['Alerts','Alarme','Alertes','Alertas','التنبيهات','التنبيهات'],
    strategies:['Strategies','Strategien','Stratégies','Estrategias','الاستراتيجيات','الاستراتيجيات'],
    advanced:['Advanced settings & saved profiles','Erweiterte Einstellungen & Profile','Réglages avancés et profils enregistrés','Ajustes avanzados y perfiles','إعدادات متقدمة وقوالب محفوظة','إعدادات متقدمة وقوالب محفوظة'],
    journal:['Journal','Journal','Journal','Diario','سجل التداول','سجل التداول'],
    performance:['Performance','Auswertung','Performances','Rendimiento','الأداء','الأداء'],
    calendar:['Calendar','Kalender','Calendrier','Calendario','التقويم','التقويم'],
    navigation:['Main navigation','Hauptnavigation','Navigation principale','Navegación principal','التنقل الرئيسي','التنقل الرئيسي'],
    help:['Frequently asked questions','Häufige Fragen','Questions fréquentes','Preguntas frecuentes','الأسئلة الشائعة','أسئلة متداولة'],
    details:['View performance','Auswertung öffnen','Voir les performances','Ver rendimiento','عرض الأداء','عرض الأداء'],
    results:['Result details','Ergebnisdetails','Détails des résultats','Detalles de resultados','تفاصيل النتائج','تفاصيل النتائج'],
    supportIntro:['Your requests and answers to common questions.','Ihre Anfragen und Antworten auf häufige Fragen.','Vos demandes et les réponses aux questions fréquentes.','Tus solicitudes y las respuestas a preguntas frecuentes.','طلباتك وإجابات الأسئلة الشائعة.','الطلبات ديالك والأجوبة على الأسئلة المتداولة.']
  };
  const language = () => ({en:0,de:1,fr:2,es:3,ar:4,ary:5})[document.documentElement.lang] ?? 0;
  const text = key => copy[key]?.[language()] || key;
  const settings = $('#view-settings');
  if (!settings) return;
  const tabs = document.createElement('div'); tabs.className = 'settings-tabs'; tabs.setAttribute('role','tablist');
  const groups = {};
  for (const key of ['account','chart','alerts','strategies']) {
    const button = document.createElement('button'); button.type = 'button'; button.id = 'settings-tab-'+key;
    button.setAttribute('role','tab'); button.setAttribute('aria-controls','settings-group-'+key); button.dataset.proCopy = key;
    const pane = document.createElement('section'); pane.id = 'settings-group-'+key; pane.className = 'settings-group';
    pane.setAttribute('role','tabpanel'); pane.setAttribute('aria-labelledby',button.id);
    groups[key] = {button,pane}; tabs.append(button); settings.append(pane);
    button.onclick = () => select(key);
  }
  settings.querySelector('.page-title').after(tabs);
  function select(key, focus = false) {
    for (const [name,group] of Object.entries(groups)) {
      const active = name === key;
      group.pane.hidden = !active; group.button.setAttribute('aria-selected',String(active)); group.button.tabIndex = active ? 0 : -1;
    }
    if (focus) groups[key].button.focus();
  }
  tabs.addEventListener('keydown',event => {
    const keys = Object.keys(groups), index = keys.findIndex(key=>groups[key].button === document.activeElement);
    if (index < 0 || !['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) return;
    event.preventDefault(); const rtl = document.documentElement.dir === 'rtl';
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? keys.length-1 : (index + (event.key === 'ArrowRight' ? (rtl ? -1 : 1) : (rtl ? 1 : -1)) + keys.length) % keys.length;
    select(keys[next], true);
  });
  const move = (selector,key) => { const node = $(selector); if (node) groups[key].pane.append(node); };
  move('.settings-photo','account'); move('.settings-row','account');
  // The reference chart uses one fixed palette; its previous palette picker had no visible effect.
  settings.querySelector('.appearance-options')?.closest('article')?.remove();
  move('#desk-chart-settings','chart');
  const indicators = $('#open-chart-settings')?.closest('article'); if (indicators) groups.strategies.pane.append(indicators);
  move('#notification-preferences','alerts'); move('#desk-watch','alerts');
  move('#desk-settings','strategies'); move('.dashboard-goal-preferences','strategies');
  // Future asynchronous preference renders retain their original event handlers.
  new MutationObserver(() => {
    const preferences = $('#notification-preferences');
    if (preferences && preferences.parentElement === settings) groups.alerts.pane.append(preferences);
  }).observe(settings,{childList:true});
  select('account');
  $('#portal-sidebar a[data-route="weekly"]')?.remove();
  $('#portal-sidebar a[data-route="access"]')?.remove();
  const supportIntro = $('#view-support .page-title p');
  if (supportIntro) { supportIntro.removeAttribute('data-copy'); supportIntro.dataset.proCopy = 'supportIntro'; }
  // One compact help section, below the support workspace.
  const helpItems = [...document.querySelectorAll('#view-support > .help-item')];
  if (helpItems.length) {
    const help = document.createElement('details'); help.className = 'support-help surface';
    const summary = document.createElement('summary'); summary.dataset.proCopy = 'help'; help.append(summary,...helpItems);
    $('#view-support').append(help);
  }
  $('#desk-backtest')?.setAttribute('hidden','');
  $('#planner-dashboard')?.closest('label')?.setAttribute('hidden','');
  const controls = $('.dashboard-chart-controls'), demo = $('#desk-demo'); if (controls && demo) controls.append(demo);
  const more = document.createElement('a'); more.href='#performance'; more.className='dash-performance-link'; more.dataset.proCopy='details';
  $('.dashboard-account')?.append(more);
  function translate() {
    document.querySelectorAll('[data-pro-copy]').forEach(node=>node.textContent=text(node.dataset.proCopy));
    for (const [route,key] of [['signals','chart'],['news','calendar'],['history','journal'],['performance','performance']]) {
      document.querySelectorAll('[data-route="'+route+'"] span,[data-dash-route="'+route+'"] span').forEach(node=>node.textContent=text(key));
    }
    $('.dashboard-bottom')?.setAttribute('aria-label',text('navigation'));
    const summaryToggle = $('#desk-account-toggle'); if (summaryToggle) summaryToggle.textContent = text('results');
    tabs.setAttribute('aria-label',settings.querySelector('.page-title h1')?.textContent || 'Settings');
  }
  document.addEventListener('blh-language-change',translate);
  // desk-settings is rebuilt after changing a preference; localize its disclosure too.
  new MutationObserver(translate).observe($('#desk-settings'),{childList:true});
  new MutationObserver(translate).observe($('#desk-chart-settings'),{childList:true});
  translate();
})();
