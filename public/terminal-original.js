
class OriginalTerminal extends DCLogic {


  PROFILES = { Standard: { contract: '100', lotStep: '0.01', risk: '1' }, Prudent: { contract: '100', lotStep: '0.01', risk: '0.5' }, Agressif: { contract: '100', lotStep: '0.01', risk: '2' } };
  setEx(p) { Object.assign(this.ex, p); this.forceUpdate(); }


  download(name, text, type) { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000); }
  extraVals(s, sym, lastClose, dirOf, colOf) {
    const E = this.ex, perf = this.perf, f2 = v => v == null || !isFinite(v) ? '—' : (+v).toFixed(this.dp());
    const now = Date.now(), from = E.jRange === 'day' ? new Date().setHours(0, 0, 0, 0) : E.jRange === '7d' ? now - 7 * 864e5 : 0;
    const ops = perf ? perf.ops.filter(o => o.time >= from).slice().reverse() : [];
    const key = o => o.time + ':' + o.direction;
    const jd = o => E.jData[key(o)] || (E.jData[key(o)] = { note: '', tps: [false, false, false], r: '' });
    const rOf = o => { const d = jd(o); if (d.r !== '' && isFinite(parseFloat(d.r))) return parseFloat(d.r); return o.resultR; };
    const closed = ops.filter(o => rOf(o) != null), rs = closed.map(rOf).reverse();
    let net = 0, peak = 0, dd = 0; rs.forEach(r => { net += r; peak = Math.max(peak, net); dd = Math.max(dd, peak - net); });
    const wins = rs.filter(r => r > 0).length, losses = rs.filter(r => r < 0).length, be = rs.filter(r => r === 0).length;
    const journalRows = ops.map(o => ({ o, d: jd(o) }));
    const csv = () => {
      const head = 'date;symbole;sens;entree;stop;tp1;tp2;tp3;tp_atteints;statut;resultat_R;note';
      const rows = journalRows.map(({ o, d }) => [new Date(o.time).toISOString(), sym.label, dirOf(o.direction), f2(o.entry), f2(o.stop), ...o.tps.map(f2), d.tps.map((v, i) => v ? 'TP' + (i + 1) : '').filter(Boolean).join('+'), o.status, rOf(o) ?? '', '"' + d.note.replace(/"/g, '""') + '"'].join(';'));
      this.download('pipvoria-journal.csv', [head, ...rows].join('\n'), 'text/csv');
    };
    const C = E.calc, set = E.set, entry = parseFloat(C.entry), stop = parseFloat(C.stop), cap = parseFloat(C.capital), rk = parseFloat(C.risk);
    const contract = parseFloat(set.contract) || 100, step = parseFloat(set.lotStep) || 0.01;
    const riskAmt = cap * rk / 100, dist = Math.abs(entry - stop), rawLots = riskAmt / (dist * contract), lots = Math.floor(rawLots / step) * step;
    const okCalc = isFinite(riskAmt) && dist > 0 && isFinite(lots);
    const dirC = entry > stop ? 1 : -1;
    const posAll = perf ? perf.ops.slice().reverse() : [];
    const positionsF = posAll.filter(o => (E.fStatus === 'all' || (E.fStatus === 'open' ? o.status === 'En cours' : o.status !== 'En cours')) && (E.fDir === 'all' || String(o.direction) === E.fDir)).map(o => {
      const open = o.status === 'En cours', r = open ? (lastClose ? o.direction * (lastClose - o.entry) / Math.abs(o.entry - o.stop) : 0) : (o.resultR ?? 0);
      return { dir: dirOf(o.direction), color: colOf(o.direction), symbol: sym.label, time: this.fmtT(o.time), entry: f2(o.entry), price: open ? f2(lastClose) : o.status, stop: f2(o.stop), tps: o.tps.map(f2).join(' · '), r: (r > 0 ? '+' : '') + r.toFixed(1) + ' R', rColor: r >= 0 ? '#3fd2a4' : '#f2707a', rLabel: open ? 'P&L latent' : 'Résultat' };
    });
    const tfs = ['1m', '5m', '15m', '30m', '1h'];
    const mtfOk = E.mtfSym === s.symbol;
    if (!mtfOk && !E.mtfLoading && s.appTab === 'trader' && s.tab === 'summary') setTimeout(() => this.loadMtf(), 0);
    const mtf = tfs.map(tf => {
      const d = mtfOk ? E.mtf[tf] : null;
      if (!d) return { tf, trend: E.mtfLoading ? '…' : '—', trendColor: '#8d93a8', struct: '—', structColor: '#8d93a8', sig: '—', sigColor: '#8d93a8', price: '—', net: '—', netColor: '#8d93a8' };
      const up = d.close > d.m.ema[d.m.ema.length - 1], st = d.m.structure, sg = d.m.signals[d.m.signals.length - 1], n = d.perf.netR;
      return { tf, trend: up ? 'Haussière' : 'Baissière', trendColor: up ? '#3fd2a4' : '#f2707a', struct: st ? st.name + (st.direction === 1 ? ' ↑' : ' ↓') : '—', structColor: st ? colOf(st.direction) : '#8d93a8', sig: sg ? dirOf(sg.direction) + ' · ' + this.fmtT(sg.time) : 'Aucun', sigColor: sg ? colOf(sg.direction) : '#8d93a8', price: f2(d.close), net: (n > 0 ? '+' : '') + n.toFixed(1) + ' R', netColor: n >= 0 ? '#3fd2a4' : '#f2707a' };
    });

    return {
      isJournal: s.appTab === 'journal', isAdmin: s.appTab === 'admin',
      jRanges: [['day', "Aujourd'hui"], ['7d', '7 jours'], ['all', 'Tout']].map(([k, label]) => ({ label, select: () => this.setEx({ jRange: k }), bg: E.jRange === k ? '#221f3d' : 'transparent', color: E.jRange === k ? '#c9bfff' : '#8d93a8' })),
      jStats: [
        { label: 'Trades', value: String(ops.length), color: '#e9ebf2' },
        { label: 'Gagnants', value: String(wins), color: '#3fd2a4' }, { label: 'Perdants', value: String(losses), color: '#f2707a' }, { label: 'Break-even', value: String(be), color: '#c4c8d6' },
        { label: 'Résultat net', value: (net > 0 ? '+' : '') + net.toFixed(2) + ' R', color: net >= 0 ? '#3fd2a4' : '#f2707a' }, { label: 'Drawdown max', value: dd.toFixed(2) + ' R', color: '#e9ebf2' }],
      journal: journalRows.map(({ o, d }) => ({
        dir: dirOf(o.direction), color: colOf(o.direction), symbol: sym.label + ' ' + s.tf, time: this.fmtT(o.time), entry: f2(o.entry), stop: f2(o.stop), status: o.status,
        autoR: o.resultR != null ? o.resultR.toFixed(1) : 'ex. 1.5', r: d.r, note: d.note,
        onR: e => { d.r = e.target.value; this.forceUpdate(); }, onNote: e => { d.note = e.target.value; this.forceUpdate(); },
        tps: d.tps.map((v, i) => ({ label: 'TP' + (i + 1), bg: v ? '#0f2620' : 'transparent', color: v ? '#3fd2a4' : '#8d93a8', border: v ? '#1f4a3f' : '#2a3145', toggle: () => { d.tps[i] = !d.tps[i]; this.forceUpdate(); } }))
      })),
      noJournal: !journalRows.length, exportCsv: csv, printJournal: () => window.print(),
      calcFields: [['capital', 'Capital (USD)'], ['risk', 'Risque (%)'], ['entry', 'Prix d\'entrée'], ['stop', 'Stop loss']].map(([k, label]) => ({ label, value: C[k], onChange: e => this.setEx({ calc: { ...E.calc, [k]: e.target.value } }) })),
      calcOut: [
        { label: 'Montant risqué', value: isFinite(riskAmt) ? riskAmt.toFixed(2) + ' $' : '—', color: '#f2707a' },
        { label: 'Distance SL', value: dist > 0 ? dist.toFixed(2) : '—', color: '#e9ebf2' },
        { label: 'Taille (lots)', value: okCalc ? lots.toFixed(2) : '—', color: '#c9bfff' },
        { label: 'TP 1:2', value: okCalc ? f2(entry + dirC * dist * 2) + ' · +' + (riskAmt * 2).toFixed(0) + ' $' : '—', color: '#3fd2a4' }],
      fillFromPlan: () => { const p = this.model?.plan; if (p) this.setEx({ calc: { ...E.calc, entry: p.entry.toFixed(2), stop: p.stop.toFixed(2), risk: set.risk } }); },
      fStatus: E.fStatus, fDir: E.fDir, onFStatus: e => this.setEx({ fStatus: e.target.value }), onFDir: e => this.setEx({ fDir: e.target.value }),
      positionsF, noPositionsF: perf && !positionsF.length,
      mtf, refreshMtf: () => this.loadMtf(), mtfBtn: E.mtfLoading ? 'Chargement…' : 'Actualiser',
      goAdmin: () => this.setState({ appTab: 'admin' }), backProfile: () => this.setState({ appTab: 'profile' }),
      setProfiles: Object.keys(this.PROFILES).map(k => ({ label: k, bg: set.profile === k ? '#221f3d' : 'transparent', color: set.profile === k ? '#c9bfff' : '#8d93a8', border: set.profile === k ? '#4a3f8f' : '#2a3145', select: () => this.setSet({ ...this.PROFILES[k], profile: k }, 'Profil « ' + k + ' » appliqué.') })),
      setTz: set.tz, setContract: set.contract, setLotStep: set.lotStep, setRisk: set.risk,
      onSetTz: e => this.setSet({ tz: e.target.value }), onSetContract: e => this.setSet({ contract: e.target.value, profile: 'Perso' }), onSetLotStep: e => this.setSet({ lotStep: e.target.value, profile: 'Perso' }), onSetRisk: e => this.setSet({ risk: e.target.value, profile: 'Perso' }),
      toggleConfirmed: () => this.setSet({ confirmed: !set.confirmed }), confTrack: set.confirmed ? '#9d8cff' : '#2a3145', confJustify: set.confirmed ? 'flex-end' : 'flex-start',
      noUndo: !E.undo.length, undoSettings: () => { const p = E.undo.pop(); if (p) { E.set = p; this.setEx({ setMsg: 'Modification annulée.' }); } },
      exportSettings: () => this.download('pipvoria-reglages.json', JSON.stringify({ version: 1, settings: set, indicators: s.ind, ms: s.ms }, null, 2), 'application/json'),
      importSettings: () => { const i = document.createElement('input'); i.type = 'file'; i.accept = '.json,application/json'; i.onchange = async () => { try { const j = JSON.parse(await i.files[0].text()); if (j.settings) this.setSet(j.settings, 'Réglages importés.'); if (j.indicators) this.setState({ ind: { ...this.state.ind, ...j.indicators } }); } catch (e) { this.setEx({ setMsg: 'Fichier JSON invalide.' }); } }; i.click(); },
      setMsg: E.setMsg
    };
  }

  wl = {}; rp = null;
  setBiz(p) { Object.assign(this.biz, p); this.forceUpdate(); }

  inSession(t) {
    if (t == null) return false; const set = this.ex.set, h = new Date(t).getUTCHours(), S = set.sessions || {};
    const inS = (S.asia && h >= 0 && h < 8) || (S.london && h >= 7 && h < 16) || (S.ny && h >= 12 && h < 21);
    const avoid = String(set.avoid || '').split(',').map(x => x.trim()).filter(Boolean).some(r => { const [a, b] = r.split('-').map(Number); return isFinite(a) && (isFinite(b) ? h >= a && h <= b : h === a); });
    return inS && !avoid;
  }
  confidence(i, d) {
    const why = []; let sc = 30; const m = this.model, b = this.state.bars[i];
    if (m?.ema?.[i] != null && b && (b.close - m.ema[i]) * d > 0) { sc += 20; why.push('EMA 50'); }
    const pl = this.plannerM; if (pl?.fast?.[i] != null && (pl.fast[i] - pl.slow[i]) * d > 0) { sc += 20; why.push('EMA 21/50'); }
    const pa = this.paM; if (pa) { const ev = pa.events.filter(e => (e.type === 'BOS' || e.type === 'CHoCH') && e.index <= i).pop(); if (ev && ev.direction === d) { sc += 15; why.push('structure PA'); } }
    if (b && this.inSession(b.time)) { sc += 15; why.push('session active'); }
    return { score: Math.min(100, sc), why };
  }
  confOut(i, d) { if (i == null) return { conf: '—', confColor: '#8d93a8', confPct: '0%', confWhy: '' }; const c = this.confidence(i, d), col = c.score >= 70 ? '#3fd2a4' : c.score >= 50 ? '#f0b45b' : '#f2707a'; return { conf: c.score + ' %', confColor: col, confPct: c.score + '%', confWhy: c.why.length ? 'Confluence : ' + c.why.join(' · ') : 'Aucune confluence' }; }
  beep() { try { const A = new (window.AudioContext || window.webkitAudioContext)(); [880, 1320].forEach((f, k) => { const o = A.createOscillator(), g = A.createGain(); o.frequency.value = f; o.connect(g); g.connect(A.destination); g.gain.setValueAtTime(0.0001, A.currentTime + k * 0.16); g.gain.exponentialRampToValueAtTime(0.2, A.currentTime + k * 0.16 + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, A.currentTime + k * 0.16 + 0.15); o.start(A.currentTime + k * 0.16); o.stop(A.currentTime + k * 0.16 + 0.16); }); } catch (e) {} }
  pushToast(t) { const id = Math.random(); this.biz.toasts = [{ ...t, id }, ...this.biz.toasts].slice(0, 3); if (this.state.prefSound) this.beep(); this.forceUpdate(); setTimeout(() => { this.biz.toasts = this.biz.toasts.filter(x => x.id !== id); this.forceUpdate(); }, 9000); }
  signalToast(name, sg, plan) { const S = this.SYM[this.state.symbol], f = v => v.toFixed(this.dp()), up = sg.direction === 1, c = this.confidence(sg.index, sg.direction);
    this.pushToast({ title: (up ? 'BUY' : 'SELL') + ' · ' + S.label + ' ' + this.state.tf, body: name + ' · confiance ' + c.score + ' %', levels: plan ? 'E ' + f(plan.entry) + ' · SL ' + f(plan.stop) + ' · TP ' + (plan.tps || [plan.target]).map(f).join(' / ') : '', color: up ? '#3fd2a4' : '#f2707a' }); }
  checkNewSignals() {
    if (this.rp || !this.state.prefSignals) return; const key = this.state.symbol + '|' + this.state.tf, seen = this.biz.sigSeen;
    [['BLH M5 CLEAN', this.model?.signals, this.model?.plan], ['Signal Trade Planner', this.state.ind.planner ? this.plannerM?.signals : null, this.plannerM?.sides?.[0]]].forEach(([name, list, plan]) => {
      if (!list) return; const last = list[list.length - 1], k = key + '|' + name;
      if (!(k in seen)) { seen[k] = last?.time ?? 0; return; }
      if (last && last.time > seen[k]) { seen[k] = last.time; this.signalToast(name, last, plan); }
    });
  }
  startReplay() { if (this.rp) return this.endReplay(); const all = this.state.bars.slice(); if (all.length < 100) return; this.rp = { all, idx: Math.max(60, all.length - 150), playing: false, speed: 2 }; this.setBars(all.slice(0, this.rp.idx + 1)); }
  rpStep(d) { const r = this.rp; if (!r) return; r.idx = Math.max(60, Math.min(r.all.length - 1, r.idx + d)); if (r.idx >= r.all.length - 1) this.rpPause(); this.setBars(r.all.slice(0, r.idx + 1)); }
  rpPlayToggle() { const r = this.rp; if (!r) return; if (r.playing) return this.rpPause(); r.playing = true; clearInterval(this.rpT); this.rpT = setInterval(() => this.rpStep(1), 1000 / r.speed); this.forceUpdate(); }
  rpPause() { clearInterval(this.rpT); if (this.rp) this.rp.playing = false; this.forceUpdate(); }
  endReplay(silent) { clearInterval(this.rpT); const r = this.rp; this.rp = null; if (r && !silent) this.setBars(r.all); else this.forceUpdate(); }
  textRef = el => { if (el) setTimeout(() => el.focus(), 0); };
  commitText = () => { const a = this.state.textAt, v = (this.state.textVal || '').trim(); if (a && v) this.addLine({ type: 'x', t: a.t, p: a.p, text: v }); this.setState({ textAt: null, textVal: '' }); };
  openPrint(title, body) {
    const html = '<!doctype html><html><head><meta charset="utf-8"><title>' + title + '</title><style>body{font-family:system-ui,sans-serif;color:#111;margin:40px;max-width:760px}h1{font-size:24px;margin:0 0 4px}h2{font-size:15px;margin:28px 0 8px}table{width:100%;border-collapse:collapse;font-size:13px}td,th{border-bottom:1px solid #ddd;padding:7px 6px;text-align:left}.muted{color:#666;font-size:12px}.kpi{display:inline-block;margin:0 24px 12px 0}.kpi b{display:block;font-size:20px}</style></head><body>' + body + '</body></html>';
    const w = window.open("", "_blank"); if (!w) { this.download(title.replace(/\s+/g, '-') + '.html', html, 'text/html'); return; }
    w.document.write(html); w.document.close(); w.focus(); setTimeout(() => w.print(), 400);
  }

  I18N_SRC = `Trader|Trade|Operar|التداول
Positions|Positions|Posiciones|الصفقات
Journal|Journal|Diario|السجل
Calendrier|Calendar|Calendario|التقويم
Historique|History|Historial|السجل التاريخي
Support|Support|Soporte|الدعم
Plus|More|Más|المزيد
Graphique|Chart|Gráfico|الرسم البياني
Résumé|Summary|Resumen|الملخص
Opérations|Trades|Operaciones|العمليات
Indicateurs|Indicators|Indicadores|المؤشرات
Alertes|Alerts|Alertas|التنبيهات
Plein écran|Full screen|Pantalla completa|ملء الشاشة
Quitter le plein écran|Exit full screen|Salir de pantalla completa|الخروج من ملء الشاشة
Résultats de l'indicateur|Indicator results|Resultados del indicador|نتائج المؤشر
Résultats de|Results of|Resultados de|نتائج
État|Status|Estado|الحالة
Progression|Progress|Progreso|التقدم
Objectif|Goal|Objetivo|الهدف
Règles|Rules|Reglas|القواعد
Trades clôturés|Closed trades|Operaciones cerradas|الصفقات المغلقة
Résultat net|Net result|Resultado neto|النتيجة الصافية
Signaux|Signals|Señales|الإشارات
Non clôturés|Open|Abiertas|غير مغلقة
Réussite|Win rate|Tasa de acierto|نسبة النجاح
Dernier plan du bot|Latest bot plan|Último plan del bot|آخر خطة للبوت
Score de confiance|Confidence score|Puntuación de confianza|درجة الثقة
Drawdown max|Max drawdown|Drawdown máx.|أقصى تراجع
Gagnants / perdants|Winners / losers|Ganadoras / perdedoras|الرابحة / الخاسرة
Exclus|Excluded|Excluidas|المستبعدة
Surveillance multi-périodes ·|Multi-timeframe watch ·|Vigilancia multiperiodo ·|مراقبة متعددة الأطر ·
Résultats par heure (UTC)|Results by hour (UTC)|Resultados por hora (UTC)|النتائج حسب الساعة (UTC)
Par jour de la semaine|By weekday|Por día de la semana|حسب يوم الأسبوع
Comparateur de stratégies ·|Strategy comparison ·|Comparador de estrategias ·|مقارنة الاستراتيجيات ·
Stratégie|Strategy|Estrategia|الاستراتيجية
Afficher|Show|Mostrar|عرض
Calculateur de risque & taille de position|Risk & position size calculator|Calculadora de riesgo y tamaño|حاسبة المخاطر وحجم الصفقة
Remplir avec le dernier plan|Fill from latest plan|Rellenar con el último plan|ملء من آخر خطة
Montant risqué|Amount at risk|Importe en riesgo|المبلغ المعرض للخطر
Taille (lots)|Size (lots)|Tamaño (lotes)|الحجم (لوت)
Capital (USD)|Capital (USD)|Capital (USD)|رأس المال (USD)
Risque (%)|Risk (%)|Riesgo (%)|المخاطرة (%)
Prix d'entrée|Entry price|Precio de entrada|سعر الدخول
Stop loss|Stop loss|Stop loss|وقف الخسارة
Entrée|Entry|Entrada|الدخول
Prix actuel|Current price|Precio actual|السعر الحالي
Objectifs|Targets|Objetivos|الأهداف
P&L latent|Unrealised P&L|P&L latente|الربح/الخسارة غير المحققة
Résultat|Result|Resultado|النتيجة
Calendrier économique|Economic calendar|Calendario económico|التقويم الاقتصادي
Journal de trading|Trading journal|Diario de trading|سجل التداول
Exporter CSV|Export CSV|Exportar CSV|تصدير CSV
Rapport mensuel|Monthly report|Informe mensual|التقرير الشهري
Aujourd'hui|Today|Hoy|اليوم
7 jours|7 days|7 días|7 أيام
Tout|All|Todo|الكل
Gagnants|Winners|Ganadoras|الرابحة
Perdants|Losers|Perdedoras|الخاسرة
Objectifs atteints|Targets hit|Objetivos alcanzados|الأهداف المحققة
Résultat (R)|Result (R)|Resultado (R)|النتيجة (R)
Règles de risque du jour|Today's risk rules|Reglas de riesgo de hoy|قواعد المخاطرة اليوم
Trading autorisé|Trading allowed|Trading permitido|التداول مسموح
Perte du jour|Today's loss|Pérdida del día|خسارة اليوم
Trades du jour|Today's trades|Operaciones del día|صفقات اليوم
Préférences|Preferences|Preferencias|التفضيلات
Langue|Language|Idioma|اللغة
Se déconnecter|Log out|Cerrar sesión|تسجيل الخروج
Panneau admin|Admin panel|Panel de administración|لوحة الإدارة
Abonnement|Subscription|Suscripción|الاشتراك
Échéance|Renewal date|Vencimiento|تاريخ الانتهاء
Payé avec|Paid with|Pagado con|الدفع عبر
Renouveler en crypto|Renew with crypto|Renovar con cripto|التجديد بالعملات الرقمية
Renouveler|Renew|Renovar|تجديد
Plus tard|Later|Más tarde|لاحقاً
Paramètres de trading|Trading settings|Ajustes de trading|إعدادات التداول
Fuseau horaire|Time zone|Zona horaria|المنطقة الزمنية
Pas de lot|Lot step|Paso de lote|خطوة اللوت
Annuler|Undo|Deshacer|تراجع
Exporter JSON|Export JSON|Exportar JSON|تصدير JSON
Importer JSON|Import JSON|Importar JSON|استيراد JSON
Profil|Profile|Perfil|الملف
Sessions de trading (UTC)|Trading sessions (UTC)|Sesiones de trading (UTC)|جلسات التداول (UTC)
Règles de risque|Risk rules|Reglas de riesgo|قواعد المخاطرة
Parrainage|Referral|Referidos|الإحالة
Factures|Invoices|Facturas|الفواتير
Télécharger|Download|Descargar|تحميل
Sécurité|Security|Seguridad|الأمان
Retirer les commissions|Withdraw commissions|Retirar comisiones|سحب العمولات
Derniers signaux du bot|Latest bot signals|Últimas señales del bot|آخر إشارات البوت
Tester une alerte|Test an alert|Probar una alerta|اختبار تنبيه
Nouveau ticket|New ticket|Nuevo ticket|تذكرة جديدة
Envoyer|Send|Enviar|إرسال
Ouvrir un ticket|Open a ticket|Abrir un ticket|فتح تذكرة
Catégorie|Category|Categoría|الفئة
Sujet|Subject|Asunto|الموضوع
Message|Message|Mensaje|الرسالة
Marquer résolu|Mark resolved|Marcar resuelto|تحديد كمحلول
Rouvrir|Reopen|Reabrir|إعادة فتح
Questions fréquentes|FAQ|Preguntas frecuentes|الأسئلة الشائعة
Le bot|The bot|El bot|البوت
Tarif|Pricing|Precio|السعر
Connexion|Log in|Iniciar sesión|تسجيل الدخول
Commencer|Get started|Empezar|ابدأ
Créer un compte|Create account|Crear cuenta|إنشاء حساب
Voir le tarif|See pricing|Ver precio|عرض السعر
Le bot lit la structure.|The bot reads the structure.|El bot lee la estructura.|البوت يقرأ هيكل السوق.
Vous gardez la main.|You stay in control.|Tú mantienes el control.|وأنت تبقى المتحكم.
Structure de marché|Market structure|Estructura de mercado|هيكل السوق
Plan de trade complet|Complete trade plan|Plan de operación completo|خطة تداول كاملة
Résultats vérifiables|Verifiable results|Resultados verificables|نتائج قابلة للتحقق
S'abonner|Subscribe|Suscribirse|اشترك
Une formule. Tout inclus.|One plan. Everything included.|Un plan. Todo incluido.|خطة واحدة. كل شيء مشمول.
Payée en crypto.|Paid in crypto.|Pagado en cripto.|تُدفع بالعملات الرقمية.
Inscription|Sign up|Registro|التسجيل
Nom complet|Full name|Nombre completo|الاسم الكامل
Mot de passe|Password|Contraseña|كلمة المرور
Créer votre compte|Create your account|Crea tu cuenta|أنشئ حسابك
Bon retour|Welcome back|Bienvenido de nuevo|مرحباً بعودتك
Créer le compte|Create account|Crear la cuenta|إنشاء الحساب
Se connecter|Log in|Entrar|دخول
Code de double authentification|Two-factor code|Código de doble autenticación|رمز المصادقة الثنائية
Paiement crypto|Crypto payment|Pago en cripto|الدفع بالعملات الرقمية
Choisir la cryptomonnaie|Choose a cryptocurrency|Elige la criptomoneda|اختر العملة الرقمية
Montant exact|Exact amount|Importe exacto|المبلغ الدقيق
Adresse de dépôt|Deposit address|Dirección de depósito|عنوان الإيداع
Copier|Copy|Copiar|نسخ
J'ai envoyé le paiement|I've sent the payment|He enviado el pago|لقد أرسلت الدفعة
Payer en cryptomonnaie|Pay with crypto|Pagar con cripto|ادفع بالعملات الرقمية
Essai gratuit 7 jours|7-day free trial|Prueba gratis de 7 días|تجربة مجانية 7 أيام
Code promo|Promo code|Código promocional|رمز ترويجي
Appliquer|Apply|Aplicar|تطبيق
Quitter|Exit|Salir|خروج
Administration|Administration|Administración|الإدارة
Retour|Back|Volver|رجوع
Paiements à valider|Payments to approve|Pagos por validar|مدفوعات للتحقق
Utilisateurs|Users|Usuarios|المستخدمون
Valider|Approve|Validar|تأكيد
Refuser|Reject|Rechazar|رفض`;
  i18n() {
    const li = { English: 0, 'Español': 1, 'العربية': 2 }[this.state.lang], de = document.documentElement, dir = li === 2 ? 'rtl' : 'ltr';
    if (de.dir !== dir) de.dir = dir; de.lang = ['en', 'es', 'ar'][li] || 'fr';
    if (li === undefined && !this.i18nOn) return; this.i18nOn = li !== undefined;
    if (!this.DICT) { this.DICT = {}; this.I18N_SRC.split('\n').forEach(l => { const p = l.split('|'); if (p.length === 4) this.DICT[p[0]] = p.slice(1); }); }
    const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT); let n;
    while ((n = w.nextNode())) { const v = n.nodeValue; if (!v || !v.trim() || n.parentElement?.closest('[data-no-i18n]') || n.parentNode?.nodeName === 'OPTION' && n.parentNode.parentNode?.getAttribute('aria-label') === 'Langue') continue;
      if (n.__tr !== v) n.__fr = v; const key = n.__fr.trim(), e = this.DICT[key], out = li === undefined || !e ? n.__fr : n.__fr.replace(key, e[li]);
      if (v !== out) n.nodeValue = out; n.__tr = out; }
  }
  moreVals(s, sym, dirOf, colOf) {
    const B = this.biz, E = this.ex, set = E.set, fP = (v, d) => v == null || !isFinite(v) ? '—' : (+v).toFixed(d);
    const lc = s.bars.length ? s.bars[s.bars.length - 1].close : null;
    const watch = Object.keys(this.SYM).map(k => { const S = this.SYM[k], w = this.wl[k], on = s.symbol === k, price = on && lc != null && !this.rp ? lc : w?.price;
      return { label: S.label, price: price != null ? fP(price, S.dp) : '…', chg: w && w.chg != null ? (w.chg >= 0 ? '+' : '') + w.chg.toFixed(2) + '%' : '', chgColor: (w?.chg ?? 0) >= 0 ? '#3fd2a4' : '#f2707a', src: S.sim ? 'Simulé' : 'Binance · 24 h', bg: on ? '#18152e' : '#11151f', border: on ? '#9d8cff' : '#1f2536', select: () => k !== s.symbol && this.setSymbol(k) }; });
    const R = this.rp;
    const trades = this.perf?.trades || [];
    const hours = Array.from({ length: 24 }, () => ({ n: 0, r: 0 })), days = Array.from({ length: 7 }, () => ({ n: 0, r: 0 }));
    trades.forEach(t => { const d = new Date(t.time), hh = d.getUTCHours(), wd = (d.getUTCDay() + 6) % 7; hours[hh].n++; hours[hh].r += t.resultR; days[wd].n++; days[wd].r += t.resultR; });
    const hMax = Math.max(1, ...hours.map(x => Math.abs(x.r))), dMax = Math.max(1, ...days.map(x => Math.abs(x.r)));
    const bestH = hours.map((x, i) => ({ ...x, i })).filter(x => x.n).sort((a, b) => b.r - a.r)[0];
    const strats = [['blh', 'BLH XAUUSD M5 CLEAN', this.perf], ['ms', 'Market Structure & Fib + RR', this.msPerf], ['planner', 'Signal Trade Planner', this.plannerPerf], ['pa', 'PA & Liquidity Map', this.paPerf]];
    const bestK = strats.filter(x => x[2] && x[2].closed).sort((a, b) => b[2].netR - a[2].netR)[0]?.[0];
    const t0 = new Date().setHours(0, 0, 0, 0), tt = trades.filter(t => t.closedAt >= t0), todayR = tt.reduce((a, t) => a + t.resultR, 0);
    const maxL = parseFloat(set.maxLossDay) || 3, maxT = parseInt(set.maxTradesDay) || 5, blocked = todayR <= -maxL || tt.length >= maxT;
    const m0 = new Date(); m0.setDate(1); m0.setHours(0, 0, 0, 0); const mt = trades.filter(t => t.closedAt >= m0.getTime()), mR = mt.reduce((a, t) => a + t.resultR, 0), goal = parseFloat(set.goalR) || 10;
    const daysLeft = Math.ceil((B.until - Date.now()) / 864e5);
    const chip = (on) => ({ bg: on ? '#221f3d' : 'transparent', color: on ? '#c9bfff' : '#8d93a8', border: on ? '#4a3f8f' : '#2a3145' });
    const tog = on => ({ track: on ? '#9d8cff' : '#2a3145', justify: on ? 'flex-end' : 'flex-start' });
    const sf = tog(set.sessionFilter), mm = tog(set.monthlyMail);

    return {
      watch,
      replayOn: !!R, rpPlayLabel: R?.playing ? '⏸ Pause' : '▶ Lecture', rpSpeed: String(R?.speed ?? 2), rpMax: R ? R.all.length - 1 : 100, rpIdx: R ? R.idx : 60,
      rpLabel: R ? this.fmtT(R.all[R.idx].time) + ' · ' + (R.idx + 1) + ' / ' + R.all.length : '',
      rpBack: () => this.rpStep(-1), rpFwd: () => this.rpStep(1), rpPlay: () => this.rpPlayToggle(), rpExit: () => this.endReplay(),
      onRpSpeed: e => { if (!R) return; R.speed = +e.target.value; if (R.playing) { R.playing = false; this.rpPlayToggle(); } else this.forceUpdate(); },
      onRpSeek: e => { if (!R) return; R.idx = +e.target.value; this.rpStep(0); },
      textAt: !!s.textAt, textX: s.textAt ? s.textAt.x + 'px' : '0px', textY: s.textAt ? (s.textAt.y - 14) + 'px' : '0px', textVal: s.textVal || '', textRef: this.textRef,
      onTextVal: e => this.setState({ textVal: e.target.value }), onTextKey: e => { if (e.key === 'Enter') this.commitText(); if (e.key === 'Escape') this.setState({ textAt: null }); }, commitText: this.commitText,
      toasts: B.toasts.map(t => ({ ...t, close: () => { B.toasts = B.toasts.filter(x => x.id !== t.id); this.forceUpdate(); } })),
      testAlert: () => { const g = this.model?.signals?.[this.model.signals.length - 1]; if (g) this.signalToast('BLH M5 CLEAN', g, this.model.plan); else this.pushToast({ title: 'Alerte de test', body: sym.label + ' · aucun signal récent', levels: '', color: '#9d8cff' }); },
      byHour: hours.map((x, i) => ({ h: String(i).padStart(2, '0'), r: x.n ? (x.r > 0 ? '+' : '') + x.r.toFixed(1) : '·', tip: String(i).padStart(2, '0') + 'h UTC · ' + x.n + ' trades · ' + x.r.toFixed(2) + ' R',
        bg: x.n ? (x.r >= 0 ? 'rgba(63,210,164,' : 'rgba(242,112,122,') + (0.15 + 0.55 * Math.abs(x.r) / hMax).toFixed(2) + ')' : '#0d111b', color: x.n ? '#e9ebf2' : '#3a4157' })),
      bestHour: bestH ? 'Meilleure heure : ' + String(bestH.i).padStart(2, '0') + 'h (' + (bestH.r > 0 ? '+' : '') + bestH.r.toFixed(1) + ' R)' : 'BLH · ' + trades.length + ' trades',
      byDay: days.map((x, i) => ({ label: ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'][i], value: x.n ? (x.r > 0 ? '+' : '') + x.r.toFixed(1) + ' R · ' + x.n : '—', width: (x.n ? Math.max(3, Math.abs(x.r) / dMax * 100) : 0) + '%', color: x.r >= 0 ? '#3fd2a4' : '#f2707a' })),
      compare: strats.map(([k, name, p]) => ({ name, signals: p ? String(p.signals) : '—', closed: p ? String(p.closed) : '—', win: p?.winRate != null ? p.winRate.toFixed(0) + ' %' : '—', net: p ? (p.netR > 0 ? '+' : '') + p.netR.toFixed(2) + ' R' : '—', netColor: !p ? '#8d93a8' : p.netR >= 0 ? '#3fd2a4' : '#f2707a', dd: p && p.drawdown != null ? p.drawdown.toFixed(2) + ' R' : '—', badge: k === bestK ? 'Meilleure' : '', select: () => this.setState({ resultsOf: k, tab: 'chart', ind: k === 'planner' || k === 'pa' ? { ...s.ind, [k]: true } : s.ind }) })),
      rules: [
        { label: 'Perte du jour', value: (todayR > 0 ? '+' : '') + todayR.toFixed(2) + ' R / −' + maxL + ' R', pct: Math.min(100, Math.max(0, -todayR) / maxL * 100) + '%', color: todayR <= -maxL ? '#f2707a' : '#f0b45b' },
        { label: 'Trades du jour', value: tt.length + ' / ' + maxT, pct: Math.min(100, tt.length / maxT * 100) + '%', color: tt.length >= maxT ? '#f2707a' : '#9d8cff' },
        { label: 'Objectif du mois', value: (mR > 0 ? '+' : '') + mR.toFixed(2) + ' / +' + goal + ' R', pct: Math.min(100, Math.max(0, mR) / goal * 100) + '%', color: '#3fd2a4' }],
      ruleStatus: blocked ? 'Limite atteinte — arrêtez pour aujourd\'hui' : 'Trading autorisé', ruleColor: blocked ? '#f2707a' : '#3fd2a4', ruleBorder: blocked ? '#4a2530' : '#1a2030',
      monthlyReport: () => {
        const mon = m0.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }), w = mt.filter(t => t.resultR > 0).length, f = v => v.toFixed(this.dp());
        let pk = 0, cu = 0, dd = 0; mt.slice().sort((a, b) => a.closedAt - b.closedAt).forEach(t => { cu += t.resultR; pk = Math.max(pk, cu); dd = Math.max(dd, pk - cu); });
        const rows = mt.map(t => '<tr><td>' + this.fmtT(t.time) + '</td><td>' + dirOf(t.direction) + '</td><td>' + f(t.entry) + '</td><td>' + f(t.exit) + '</td><td>' + (t.resultR > 0 ? '+' : '') + t.resultR.toFixed(2) + ' R</td></tr>').join('');
        const cmp = strats.map(([k, n, p]) => '<tr><td>' + n + '</td><td>' + (p ? p.closed : '—') + '</td><td>' + (p?.winRate != null ? p.winRate.toFixed(0) + ' %' : '—') + '</td><td>' + (p ? p.netR.toFixed(2) + ' R' : '—') + '</td></tr>').join('');
        this.openPrint('Pipvoria - Rapport ' + mon, '<h1>Rapport mensuel · ' + mon + '</h1><div class="muted">' + (s.name || 'Trader') + ' · ' + sym.label + ' ' + s.tf + ' · BLH XAUUSD M5 CLEAN · généré le ' + new Date().toLocaleString('fr-FR') + '</div><h2>Synthèse</h2><div class="kpi">Trades<b>' + mt.length + '</b></div><div class="kpi">Réussite<b>' + (mt.length ? Math.round(w / mt.length * 100) : 0) + ' %</b></div><div class="kpi">Résultat net<b>' + (mR > 0 ? '+' : '') + mR.toFixed(2) + ' R</b></div><div class="kpi">Drawdown max<b>' + dd.toFixed(2) + ' R</b></div><div class="kpi">Objectif<b>' + Math.round(Math.max(0, mR) / goal * 100) + ' %</b></div><h2>Comparaison des stratégies (période chargée)</h2><table><tr><th>Stratégie</th><th>Clos</th><th>Réussite</th><th>Net</th></tr>' + cmp + '</table><h2>Trades du mois</h2><table><tr><th>Date</th><th>Sens</th><th>Entrée</th><th>Sortie</th><th>R</th></tr>' + (rows || '<tr><td colspan="5">Aucun trade clôturé ce mois-ci.</td></tr>') + '</table><p class="muted">Simulation sur données historiques — ne constitue pas un conseil en investissement.</p>');
      },
      sessionChips: [['asia', 'Asie 00–08'], ['london', 'Londres 07–16'], ['ny', 'New York 12–21']].map(([k, label]) => ({ label, ...chip(set.sessions?.[k]), toggle: () => this.setSet({ sessions: { ...set.sessions, [k]: !set.sessions?.[k] } }) })),
      toggleSessionFilter: () => this.setSet({ sessionFilter: !set.sessionFilter }, !set.sessionFilter ? 'Filtre de sessions activé.' : ''), sfTrack: sf.track, sfJustify: sf.justify,
      setAvoid: set.avoid, onSetAvoid: e => this.setSet({ avoid: e.target.value }),
      setMaxLoss: set.maxLossDay, onSetMaxLoss: e => this.setSet({ maxLossDay: e.target.value }), setMaxTrades: set.maxTradesDay, onSetMaxTrades: e => this.setSet({ maxTradesDay: e.target.value }), setGoal: set.goalR, onSetGoal: e => this.setSet({ goalR: e.target.value }),
      toggleMonthly: () => this.setSet({ monthlyMail: !set.monthlyMail }), mmTrack: mm.track, mmJustify: mm.justify,
      faq: [
        { q: 'Combien de temps pour activer mon abonnement ?', a: 'Dès que la transaction atteint le nombre de confirmations du réseau (environ 1 min sur TRON, 2 à 5 min sur Ethereum, 10 à 30 min sur Bitcoin). L\'activation est automatique.' },
        { q: 'J\'ai envoyé un montant incorrect ou sur le mauvais réseau.', a: 'Ouvrez un ticket « Paiement » avec le TxID. Un montant partiel peut être complété ; un envoi sur un réseau non pris en charge peut être irrécupérable.' },
        { q: 'Le bot passe-t-il des ordres à ma place ?', a: 'Non. Pipvoria affiche des signaux et des plans (entrée, SL, TP). Vous restez seul décideur de vos ordres chez votre courtier.' },
        { q: 'Que signifie le score de confiance ?', a: 'C\'est la confluence au moment du signal : tendance EMA 50, alignement EMA 21/50, structure Price Action et session de marché. Plus il est élevé, plus les indicateurs sont d\'accord.' },
        { q: 'Comment fonctionne le parrainage ?', a: 'Partagez votre lien : vous touchez 20 % de chaque paiement de vos filleuls, retirable en USDT TRC20 dès 10 USDT.' },
        { q: 'Puis-je annuler à tout moment ?', a: 'Oui. Aucun prélèvement automatique : l\'abonnement s\'arrête simplement à l\'échéance si vous ne renouvelez pas.' }]
    };
  }
  setSup(p) { Object.assign(this.sup, p); this.forceUpdate(() => requestAnimationFrame(() => { if (this.msgEl) this.msgEl.scrollTop = this.msgEl.scrollHeight; })); }
  msgBoxRef = el => { this.msgEl = el; if (el) requestAnimationFrame(() => { el.scrollTop = el.scrollHeight; }); };




  lkey() { return this.state.symbol + '|' + this.state.tf; }

  addLine(l) { (this.lines[this.lkey()] ||= []).push(l); this.saveLines(); }
  setMs(patch) { this.setState(s => ({ ms: { ...s.ms, ...patch } }), () => { this.computeStruct(); this.forceUpdate(); }); }
  SYM = { XAU: { pair: 'PAXGUSDT', label: 'XAU/USD', name: 'Or / Dollar américain', base: 4100, dp: 2 }, BTC: { pair: 'BTCUSDT', label: 'BTC/USD', name: 'Bitcoin / Dollar', base: 98000, dp: 2 }, ETH: { pair: 'ETHUSDT', label: 'ETH/USD', name: 'Ethereum / Dollar', base: 3500, dp: 2 }, SOL: { pair: 'SOLUSDT', label: 'SOL/USD', name: 'Solana / Dollar', base: 180, dp: 3 }, EUR: { pair: 'EURUSDT', label: 'EUR/USD', name: 'Euro / Dollar', base: 1.08, dp: 5 }, NAS: { pair: 'NAS100', label: 'NAS100', name: 'Nasdaq 100 · simulé', base: 21000, dp: 1, sim: true } };
  dp() { return this.SYM[this.state.symbol]?.dp ?? 2; }
  TFMS = { '1m': 6e4, '5m': 3e5, '15m': 9e5, '30m': 18e5, '1h': 36e5 };
  CRYPTOS = [{id:"none",coin:"USD",network:"Non configuré",addr:""}];
  view = { count: 140, offset: 0, yZoom: 1 };
  model = null; perf = null; mouse = null;



  componentDidUpdate() { this.draw(); if (!this.i18nQ) { this.i18nQ = true; requestAnimationFrame(() => { this.i18nQ = false; this.i18n(); }); } }







  summarize(signals, trades, active, excluded) {
    let netR = 0, peak = 0, dd = 0; trades.forEach(t => { netR += t.resultR; peak = Math.max(peak, netR); dd = Math.max(dd, peak - netR); });
    const wins = trades.filter(t => t.resultR > 1e-9).length, losses = trades.filter(t => t.resultR < -1e-9).length;
    return { signals, closed: trades.length, active, excluded, wins, losses, netR, drawdown: dd, winRate: trades.length ? wins / trades.length * 100 : null, ops: [], trades };
  }



  drawHeat(ctx, x, y, pW, step) {
    const m = this.heat; if (!this.state.ind.heat || !m || m.error) return;
    const last = m.length + m.extension - 1, pred = i => m.start + m.slope * i, x1 = x(m.offset), x2 = x(m.offset + last);
    const stops = [[0, 0, 0, 0], [91, 156, 246, .06], [63, 210, 164, .12], [240, 180, 91, .22], [242, 112, 122, .42]];
    const col = r => { const v = Math.min(4, Math.pow(r, .7) * 4), k = Math.min(3, Math.floor(v)), f = v - k, a = stops[k], b = stops[k + 1]; return 'rgba(' + a.slice(0, 3).map((n, i) => Math.round(n + (b[i] - n) * f)).join(',') + ',' + (a[3] + (b[3] - a[3]) * f) + ')'; };
    ctx.save();
    if (m.hasVolume && m.maxVolume > 0) {
      const lw = Math.max(2, Math.abs(y(m.start) - y(m.start + m.dev)) + 0.5);
      m.volumes.forEach((v, i) => { const sh = (i - m.bins) * m.dev + m.dev / 2, c = col(v / m.maxVolume); ctx.strokeStyle = c; ctx.lineWidth = lw; ctx.beginPath(); ctx.moveTo(x1, y(m.start + sh)); ctx.lineTo(x2, y(pred(last) + sh)); ctx.stroke();
        if (this.state.ind.heatProfile && v > 0) { const w = v / m.maxVolume * 60; ctx.fillStyle = c.replace(/,[\d.]+\)$/, ',0.75)'); ctx.fillRect(Math.min(pW - w, x2 + 4), y(pred(last) + sh + m.dev / 2), w, Math.max(1, lw - 1)); } });
    }
    [-3, -2, -1, 0, 1, 2, 3].forEach(bd => { ctx.strokeStyle = bd === 0 ? '#aacbff' : '#4b5a75'; ctx.lineWidth = bd === 0 ? 1.5 : 1; ctx.setLineDash(bd === 0 ? [] : [5, 5]); ctx.beginPath(); ctx.moveTo(x1, y(m.start + bd * m.sd)); ctx.lineTo(x2, y(pred(last) + bd * m.sd)); ctx.stroke(); });
    ctx.setLineDash([]); ctx.restore();
  }
  drawExtra(ctx, x, y, pW, start, n) {
    const ind = this.state.ind, f2 = v => v.toFixed(this.dp());
    const badge = (p, txt, fill, bx) => { ctx.font = '700 10px JetBrains Mono, monospace'; const tw = ctx.measureText(txt).width + 12; const lx = Math.max(2, Math.min(pW - tw - 2, bx)); ctx.fillStyle = fill; ctx.beginPath(); ctx.roundRect(lx, y(p) - 9, tw, 18, 4); ctx.fill(); ctx.fillStyle = '#fff'; ctx.textAlign = 'left'; ctx.fillText(txt, lx + 6, y(p) + 3.5); };
    const pl = this.plannerM;
    if (ind.planner && pl && pl.fast.length) {
      [[pl.fast, '#22d3ee'], [pl.slow, '#8b5cf6']].forEach(([arr, c]) => { ctx.strokeStyle = c; ctx.lineWidth = 1.6; ctx.globalAlpha = .9; ctx.beginPath(); let f = true; arr.forEach((v, i) => { if (i < start - 1 || !isFinite(v)) return; f ? ctx.moveTo(x(i), y(v)) : ctx.lineTo(x(i), y(v)); f = false; }); ctx.stroke(); ctx.globalAlpha = 1; });
      const z = pl.active || pl.sides.at(-1);
      if (z) { const x1 = Math.max(0, x(z.index)), x2 = Math.max(x1 + 34, Math.min(pW - 4, x(z.index + 25)));
        if (x2 > 0 && x1 < pW) {
          const rt = y(Math.max(z.entry, z.tps[2])), rb = y(Math.min(z.entry, z.tps[2])), kt = y(Math.max(z.entry, z.stop)), kb = y(Math.min(z.entry, z.stop));
          ctx.fillStyle = 'rgba(124,58,237,.18)'; ctx.fillRect(x1, rt, x2 - x1, rb - rt); ctx.strokeStyle = '#9b6cff'; ctx.strokeRect(x1, rt, x2 - x1, rb - rt);
          ctx.fillStyle = 'rgba(127,29,29,.3)'; ctx.fillRect(x1, kt, x2 - x1, kb - kt); ctx.strokeStyle = '#f2707a'; ctx.strokeRect(x1, kt, x2 - x1, kb - kt);
          z.tps.forEach((tp, k) => { ctx.setLineDash([7, 6]); ctx.strokeStyle = '#a78bfa'; ctx.beginPath(); ctx.moveTo(x1, y(tp)); ctx.lineTo(x2, y(tp)); ctx.stroke(); ctx.setLineDash([]); badge(tp, 'TP' + (k + 1) + ' ' + f2(tp), '#7551c7', x2 + 4); });
          badge(z.entry, 'ENTRY ' + f2(z.entry), '#3b82c4', x2 + 4); badge(z.stop, (z.trailing ? 'TRAIL ' : 'SL ') + f2(z.stop), '#d9424f', x2 + 4);
        } }
      pl.signals.forEach(sg => { const xx = x(sg.index); if (xx < 0 || xx > pW) return; const up = sg.direction === 1, yy = y(sg.price) + (up ? 6 : -6), c = up ? '#089981' : '#f23645';
        ctx.fillStyle = c; ctx.beginPath(); ctx.moveTo(xx - 6, yy + (up ? 10 : -10)); ctx.lineTo(xx, yy); ctx.lineTo(xx + 6, yy + (up ? 10 : -10)); ctx.fill();
        ctx.beginPath(); ctx.roundRect(xx - 18, yy + (up ? 10 : -30), 36, 20, 4); ctx.fill(); ctx.fillStyle = '#fff'; ctx.font = '700 10px Instrument Sans, sans-serif'; ctx.textAlign = 'center'; ctx.fillText(up ? 'BUY' : 'SELL', xx, yy + (up ? 24 : -16)); });
      const q = this.plannerPerf; if (q) { const bx = Math.max(8, pW - 236); ctx.fillStyle = 'rgba(10,22,20,.94)'; ctx.strokeStyle = '#089981'; ctx.beginPath(); ctx.roundRect(bx, 10, 226, 92, 8); ctx.fill(); ctx.stroke();
        ctx.textAlign = 'left'; ctx.fillStyle = '#fff'; ctx.font = '700 11px JetBrains Mono, monospace'; ctx.fillText('SIGNAL TRADE PLANNER', bx + 12, 29);
        ctx.font = '10px JetBrains Mono, monospace'; ctx.fillStyle = '#aeb2ba'; ctx.fillText((pl.active ? (pl.active.direction === 1 ? 'LONG ACTIF' : 'SHORT ACTIF') : 'EN ATTENTE') + ' · WIN ' + (q.winRate != null ? Math.round(q.winRate) : 0) + '%', bx + 12, 46);
        ctx.fillStyle = '#69d4bb'; ctx.fillText('SIGNAUX ' + q.signals + '  CLOS ' + q.closed + '  TP1 ' + pl.stats.tp1, bx + 12, 62);
        ctx.fillStyle = '#c4a7ff'; ctx.fillText('TP2 ' + pl.stats.tp2 + '  TP3 ' + pl.stats.tp3 + '  SL ' + pl.stats.stops, bx + 12, 77);
        ctx.fillStyle = q.netR >= 0 ? '#69d4bb' : '#ff6b78'; ctx.font = '700 11px JetBrains Mono, monospace'; ctx.fillText('NET ' + q.netR.toFixed(2) + ' R', bx + 12, 94); }
    }
    const pa = this.paM;
    if (ind.pa && pa) {
      const EQ = '#5b9cf6';
      [pa.equalHigh, pa.equalLow].forEach(l => { if (!l || x(l.index) < 0) return; ctx.setLineDash([3, 4]); ctx.strokeStyle = EQ; ctx.globalAlpha = .8; ctx.beginPath(); ctx.moveTo(x(l.from), y(l.fromPrice)); ctx.lineTo(pW, y(l.price)); ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha = 1; });
      pa.events.forEach(e => { const xx = x(e.index); if (xx < 0 || xx > pW) return;
        const c = e.type === 'EQH' || e.type === 'EQL' ? EQ : e.direction === 1 ? '#3fd2a4' : '#f2707a';
        if (e.type === 'BOS' || e.type === 'CHoCH') { ctx.strokeStyle = c; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(Math.max(0, x(e.from)), y(e.price)); ctx.lineTo(xx, y(e.price)); ctx.stroke(); ctx.lineWidth = 1; }
        ctx.fillStyle = c; ctx.font = '700 10px Instrument Sans, sans-serif'; ctx.textAlign = 'center'; ctx.fillText(e.type, xx, y(e.price) + (e.direction === -1 || e.type === 'EQH' ? -8 : 15)); });
      const p = pa.plan; if (p && x(p.index) <= pW) { [[p.entry, 'ENTRY', EQ, []], [p.stop, 'SL', '#f2707a', [5, 4]], [p.target, 'TP', '#3fd2a4', [5, 4]]].forEach(([pr, nm, c, d]) => { ctx.setLineDash(d); ctx.strokeStyle = c; ctx.lineWidth = d.length ? 1.4 : 2; ctx.beginPath(); ctx.moveTo(Math.max(0, x(p.index)), y(pr)); ctx.lineTo(pW, y(pr)); ctx.stroke(); ctx.setLineDash([]); ctx.lineWidth = 1; badge(pr, 'PA ' + nm + ' ' + f2(pr), c === EQ ? '#3b6fc4' : c === '#f2707a' ? '#b83a45' : '#0f7a62', pW - 140); }); }
    }
  }

  simBars() {
    const { symbol, tf } = this.state, ms = this.TFMS[tf]; let p = this.SYM[symbol].base, seed = 7;
    const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647 - 0.5; };
    const vol = p * 0.0012, now = Math.floor(Date.now() / ms) * ms, out = [];
    for (let i = 0; i < 500; i++) {
      const o = p, drift = Math.sin(i / 37) * vol * 0.25, c = o + rnd() * vol * 2 + drift;
      out.push({ time: now - (499 - i) * ms, open: o, close: c, high: Math.max(o, c) + Math.abs(rnd()) * vol, low: Math.min(o, c) - Math.abs(rnd()) * vol, volume: 50 + Math.abs(rnd()) * 400 }); p = c;
    }
    return out;
  }
  demoTick() {
    const bars = this.state.bars.slice(); if (!bars.length) return;
    const last = { ...bars[bars.length - 1] }, vol = last.close * 0.0006, ms = this.TFMS[this.state.tf];
    this.dt = (this.dt || 0) + 1;
    if (this.dt % 8 === 0) { bars.push({ time: last.time + ms, open: last.close, high: last.close, low: last.close, close: last.close, volume: 0 }); }
    else { last.volume = (last.volume || 0) + Math.random() * 30; last.close += (Math.random() - 0.5) * vol * 2; last.high = Math.max(last.high, last.close); last.low = Math.min(last.low, last.close); bars[bars.length - 1] = last; }
    this.setBars(bars.slice(-600));
  }


  perfCalc(plans, bars) {
    const ops = []; let active = 0, excluded = 0;
    for (const pl of plans) {
      const target = pl.tps[2], risk = pl.direction * (pl.entry - pl.stop), reward = pl.direction * (target - pl.entry);
      let op = { ...pl, status: 'En cours', resultR: null, closedAt: null, exit: null };
      for (let i = pl.index + 1; i < bars.length; i++) {
        const b = bars[i], st = pl.direction === 1 ? b.low <= pl.stop : b.high >= pl.stop, hit = pl.direction === 1 ? b.high >= target : b.low <= target;
        if (!st && !hit) continue;
        if (st && hit) { excluded++; op.status = 'Exclu (SL+TP)'; }
        else { op.resultR = st ? -1 : reward / risk; op.status = st ? 'SL touché' : 'TP3 touché'; op.exit = st ? pl.stop : target; }
        op.closedAt = b.time; break;
      }
      if (op.status === 'En cours') active++;
      ops.push(op);
    }
    const trades = ops.filter(o => o.resultR !== null).sort((a, b) => a.closedAt - b.closedAt);
    let netR = 0, peak = 0, dd = 0;
    trades.forEach(t => { netR += t.resultR; peak = Math.max(peak, netR); dd = Math.max(dd, peak - netR); });
    const wins = trades.filter(t => t.resultR > 0).length;
    return { ops, trades, signals: plans.length, active, excluded, closed: trades.length, wins, losses: trades.length - wins, netR, drawdown: dd, winRate: trades.length ? wins / trades.length * 100 : null };
  }

  canvasRef = el => {
    if (!el || el === this.cv) return;
    this.cv = el;
    this.ro?.disconnect(); this.ro = new ResizeObserver(() => this.draw()); this.ro.observe(el.parentNode);
    el.addEventListener('wheel', e => { e.preventDefault(); this.view.count = Math.max(20, Math.min(500, this.view.count * (e.deltaY > 0 ? 1.12 : 0.89))); this.draw(); }, { passive: false });
    el.addEventListener('pointerdown', e => { const r = el.getBoundingClientRect(); this.drag = { x: e.clientX, y: e.clientY, off: this.view.offset, yz: this.view.yZoom, axis: e.clientX - r.left > this.pW, moved: false }; });
    window.removeEventListener('pointerup', this.onUp);
    this.onUp = () => { const d = this.drag; this.drag = null; if (d && !d.moved && !d.axis) this.handleClick(); };
    window.addEventListener('pointerup', this.onUp);
    el.addEventListener('pointermove', e => {
      const r = el.getBoundingClientRect(); this.mouse = { x: e.clientX - r.left, y: e.clientY - r.top };
      const d = this.drag;
      if (d && Math.abs(e.clientX - d.x) + Math.abs(e.clientY - d.y) > 3) d.moved = true;
      if (d && d.moved && d.axis) this.view.yZoom = Math.max(0.2, Math.min(6, d.yz * Math.exp((e.clientY - d.y) * 0.006)));
      else if (d && d.moved && this.step && this.state.tool === 'cursor') { this.view.offset = Math.max(-40, Math.min(this.state.bars.length - 20, d.off + (e.clientX - d.x) / this.step)); }
      this.draw();
      const idx = this.hoverIdx; if (idx !== this.state.hover) this.setState({ hover: idx });
    });
    el.addEventListener('pointerleave', () => { this.mouse = null; this.draw(); this.setState({ hover: null }); });
    el.addEventListener('dblclick', () => { if (this.mouse && this.mouse.x > this.pW) { this.view.yZoom = 1; this.draw(); } else this.resetView(); });
    this.draw();
  };
  chartBoxRef = el => { this.box = el; };
  handleClick() {
    const ms = this.mouse, tool = this.state.tool; if (!ms || !this.inv || tool === 'cursor' || ms.x > this.pW) return;
    const p = this.inv.price(ms.y), t = this.inv.time(ms.x);
    if (tool === 'hline') this.addLine({ type: 'h', price: p });
    else if (tool === 'text') { this.setState({ textAt: { t, p, x: ms.x, y: ms.y }, textVal: '' }); }
    else if (tool === 'trend' || tool === 'rect' || tool === 'fib') {
      if (!this.pending) { this.pending = { t, p }; this.setState({ trendPending: true }); }
      else { this.addLine({ type: tool === 'trend' ? 't' : tool, a: this.pending, b: { t, p } }); this.pending = null; this.setState({ trendPending: false }); }
    }
  }
  resetView = () => { this.view = { count: 140, offset: 0, yZoom: 1 }; this.draw(); };

  dec() { return 2; }
  draw() {
    const c = this.cv; if (!c || !c.isConnected) return;
    const W = c.parentNode.clientWidth, H = c.parentNode.clientHeight, dpr = window.devicePixelRatio || 1;
    if (c.width !== W * dpr || c.height !== H * dpr) { c.width = W * dpr; c.height = H * dpr; }
    const ctx = c.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#0f1320'; ctx.fillRect(0, 0, W, H);
    const bars = this.state.bars, n = bars.length; if (!n) return;
    const UP = '#3fd2a4', DN = '#f2707a', AC = '#9d8cff', GRID = '#161c2b', TXT = '#6f7690';
    const aW = 74, aH = 24, pW = W - aW, pH = H - aH, pad = 6;
    const count = Math.min(Math.round(this.view.count), n + 40);
    const end = n - this.view.offset, start = Math.max(0, Math.floor(end - count));
    const step = pW / (count + pad); this.step = step;
    const x = i => (i - (end - count) + 0.5) * step;
    let lo = Infinity, hi = -Infinity;
    for (let i = start; i < Math.min(n, Math.ceil(end)); i++) { lo = Math.min(lo, bars[i].low); hi = Math.max(hi, bars[i].high); }
    const m = this.model, ind = this.state.ind, plan = m?.plan, showPlan = ind.plan && plan && x(plan.end) >= 0 && x(plan.index) <= pW;
    if (showPlan) [plan.stop, ...plan.tps].forEach(p => { lo = Math.min(lo, p); hi = Math.max(hi, p); });
    if (!isFinite(lo)) return;
    const pr = (hi - lo) * 0.08 || 1; lo -= pr; hi += pr;
    { const mid = (lo + hi) / 2, half = (hi - lo) / 2 * this.view.yZoom; lo = mid - half; hi = mid + half; }
    const tfMs = this.TFMS[this.state.tf], t0 = bars[0].time, tIdx = t => (t - t0) / tfMs;
    this.pW = pW;
    this.inv = { price: yy => lo + (1 - yy / pH) * (hi - lo), time: xx => t0 + Math.round(xx / step - 0.5 + (end - count)) * tfMs };
    const y = p => pH * (1 - (p - lo) / (hi - lo));
    const fmt = p => p.toFixed(this.dp());
    ctx.font = '11px JetBrains Mono, monospace'; ctx.lineWidth = 1;
    for (let g = 0; g <= 6; g++) {
      const p = lo + (hi - lo) * g / 6, yy = Math.round(y(p)) + 0.5;
      ctx.strokeStyle = GRID; ctx.beginPath(); ctx.moveTo(0, yy); ctx.lineTo(pW, yy); ctx.stroke();
      ctx.fillStyle = TXT; ctx.textAlign = 'left'; ctx.fillText(fmt(p), pW + 8, yy + 4);
    }
    const every = Math.max(1, Math.round(90 / step));
    ctx.textAlign = 'center';
    for (let i = start; i < n; i++) {
      if (i % every) continue; const xx = Math.round(x(i)) + 0.5; if (xx > pW) break;
      ctx.strokeStyle = GRID; ctx.beginPath(); ctx.moveTo(xx, 0); ctx.lineTo(xx, pH); ctx.stroke();
      const d = new Date(bars[i].time); ctx.fillStyle = TXT;
      ctx.fillText(d.toLocaleTimeString('fr-FR', { timeZone: this.ex.set.tz, hour: '2-digit', minute: '2-digit' }), xx, pH + 16);
    }
    ctx.save(); ctx.beginPath(); ctx.rect(0, 0, pW, pH); ctx.clip();
    if (m && ind.zone && m.zone) {
      const z = m.zone, col = z.direction === 1 ? UP : DN;
      ctx.fillStyle = col + '1f'; ctx.strokeStyle = col + 'aa';
      ctx.fillRect(x(z.index), y(z.top), x(z.end) - x(z.index), y(z.bottom) - y(z.top));
      ctx.strokeRect(x(z.index), y(z.top), x(z.end) - x(z.index), y(z.bottom) - y(z.top));
      ctx.fillStyle = col; ctx.font = '700 10px JetBrains Mono, monospace'; ctx.textAlign = 'left';
      ctx.fillText(z.direction === 1 ? 'DEMAND' : 'SUPPLY', x(z.index) + 4, z.direction === 1 ? y(z.bottom) + 12 : y(z.top) - 5);
    }
    const st = this.struct, mso = this.state.ms;
    if (mso.on && st) st.setups.filter(sx => sx.index >= start - 200).slice(-4).forEach(sx => {
      const col = sx.direction === 1 ? UP : DN;
      ctx.setLineDash([4, 3]); ctx.strokeStyle = col; ctx.beginPath(); ctx.moveTo(x(sx.broken.index), y(sx.broken.price)); ctx.lineTo(x(sx.index), y(sx.broken.price)); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = col; ctx.font = '700 10px Instrument Sans, sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('BOS', (x(sx.broken.index) + x(sx.index)) / 2, y(sx.broken.price) + (sx.direction === 1 ? -5 : 13));
      if (mso.fib) { const ze = sx.trade ? sx.trade.index : sx.end, zx = x(sx.index), zw = Math.max(step, x(ze) - zx), zy = y(sx.top), zh = Math.max(1, y(sx.bottom) - zy);
        ctx.fillStyle = 'rgba(157,140,255,0.15)'; ctx.strokeStyle = 'rgba(157,140,255,0.65)'; ctx.fillRect(zx, zy, zw, zh); ctx.strokeRect(zx, zy, zw, zh);
        ctx.fillStyle = '#b9adff'; ctx.font = '600 9px JetBrains Mono, monospace'; ctx.textAlign = 'left'; ctx.fillText('FIB 50–61,8', zx + 3, zy - 4); }
      if (sx.trade) { const t = sx.trade, x1 = x(t.index), x2 = Math.max(x(t.end), x1 + step * 8);
        ctx.fillStyle = UP + '24'; ctx.fillRect(x1, Math.min(y(t.entry), y(t.tp)), x2 - x1, Math.abs(y(t.tp) - y(t.entry)));
        ctx.fillStyle = DN + '24'; ctx.fillRect(x1, Math.min(y(t.entry), y(t.sl)), x2 - x1, Math.abs(y(t.sl) - y(t.entry)));
        [[t.entry, '#9d8cff'], [t.tp, UP], [t.sl, DN]].forEach(([p, c2]) => { ctx.strokeStyle = c2; ctx.beginPath(); ctx.moveTo(x1, y(p)); ctx.lineTo(x2, y(p)); ctx.stroke(); });
        ctx.fillStyle = '#e9ebf2'; ctx.font = '600 9px JetBrains Mono, monospace'; ctx.textAlign = 'left';
        ctx.fillText('RR 1:' + mso.rr + ' · ' + (t.status === 'active' ? 'actif' : t.status), x1 + 3, y(t.tp) + (sx.direction === 1 ? -4 : 11)); }
    });
    if (m && ind.ema) {
      ctx.strokeStyle = '#7aa7ff'; ctx.globalAlpha = 0.8; ctx.lineWidth = 1.5; ctx.beginPath(); let f = true;
      m.ema.forEach((v, i) => { if (i < start - 1) return; const xx = x(i); f ? ctx.moveTo(xx, y(v)) : ctx.lineTo(xx, y(v)); f = false; });
      ctx.stroke(); ctx.globalAlpha = 1; ctx.lineWidth = 1;
    }
    this.drawHeat(ctx, x, y, pW, step);
    const bw = Math.max(1, step * 0.62);
    for (let i = start; i < n; i++) {
      const b = bars[i], xx = x(i); if (xx > pW + step) break;
      const up = b.close >= b.open, col = up ? UP : DN;
      ctx.strokeStyle = col; ctx.beginPath(); ctx.moveTo(Math.round(xx) + 0.5, y(b.high)); ctx.lineTo(Math.round(xx) + 0.5, y(b.low)); ctx.stroke();
      const top = y(Math.max(b.open, b.close)), h = Math.max(1, Math.abs(y(b.open) - y(b.close)));
      if (up) { ctx.fillStyle = '#0f1320'; ctx.fillRect(xx - bw / 2, top, bw, h); ctx.strokeRect(xx - bw / 2 + 0.5, top + 0.5, bw - 1, h - 1); }
      else { ctx.fillStyle = col; ctx.fillRect(xx - bw / 2, top, bw, h); }
    }
    if (showPlan) {
      const lv = [[plan.entry, 'ENTRÉE', AC, []], [plan.stop, 'SL', DN, [5, 3]], ...plan.tps.map((p, i) => [p, 'TP' + (i + 1), UP, [5, 3]])];
      const x1 = x(plan.index), x2 = Math.min(pW, x(plan.end));
      lv.forEach(([p, name, col, dash]) => {
        ctx.setLineDash(dash); ctx.strokeStyle = col; ctx.lineWidth = name === 'ENTRÉE' ? 1.8 : 1.2;
        ctx.beginPath(); ctx.moveTo(x1, y(p)); ctx.lineTo(x2, y(p)); ctx.stroke(); ctx.setLineDash([]); ctx.lineWidth = 1;
        const label = name + '  ' + fmt(p); ctx.font = '600 10px JetBrains Mono, monospace'; const tw = ctx.measureText(label).width + 14;
        const lx = Math.max(2, Math.min(pW - tw - 2, x2 - tw));
        ctx.fillStyle = '#0f1320'; ctx.strokeStyle = col; ctx.beginPath(); ctx.roundRect(lx, y(p) - 9, tw, 18, 9); ctx.fill(); ctx.stroke();
        ctx.fillStyle = col; ctx.textAlign = 'left'; ctx.fillText(label, lx + 7, y(p) + 3.5);
      });
    }
    if (m && ind.structure && m.structure) {
      const s = m.structure, col = s.direction === 1 ? UP : DN; ctx.fillStyle = col; ctx.font = '700 11px Instrument Sans, sans-serif'; ctx.textAlign = 'center';
      const near = ind.plan && m.signals.some(g => Math.abs(g.index - s.index) < 3);
      ctx.fillText(s.name + (s.direction === 1 ? ' ↑' : ' ↓'), x(s.index), y(s.price) + (s.direction === 1 ? (near ? 46 : 18) : (near ? -38 : -10)));
    }
    if (m && ind.plan) m.signals.forEach(sg => {
      const xx = x(sg.index); if (xx < 0 || xx > pW) return; const col = sg.direction === 1 ? UP : DN, yy = y(sg.price);
      ctx.fillStyle = col; ctx.beginPath(); const s = 6;
      if (sg.direction === 1) { ctx.moveTo(xx, yy - s); ctx.lineTo(xx + s, yy + s); ctx.lineTo(xx - s, yy + s); } else { ctx.moveTo(xx, yy + s); ctx.lineTo(xx + s, yy - s); ctx.lineTo(xx - s, yy - s); }
      ctx.fill();
      if (sg === m.signals[m.signals.length - 1]) { ctx.font = '700 12px Instrument Sans, sans-serif'; ctx.textAlign = 'center'; ctx.fillText((sg.direction === 1 ? 'BUY ' : 'SELL ') + this.confidence(sg.index, sg.direction).score + '%', xx, sg.direction === 1 ? yy + 22 : yy - 12); }
    });
    const ML = '#f0b45b', manual = this.lines[this.lkey()] || [];
    ctx.strokeStyle = ML; ctx.lineWidth = 1.4;
    manual.forEach(l => {
      ctx.strokeStyle = ML; ctx.fillStyle = ML; ctx.setLineDash([]);
      if (l.type === 'h') { ctx.beginPath(); ctx.moveTo(0, y(l.price)); ctx.lineTo(pW, y(l.price)); ctx.stroke(); }
      else if (l.type === 't') { ctx.beginPath(); ctx.moveTo(x(tIdx(l.a.t)), y(l.a.p)); ctx.lineTo(x(tIdx(l.b.t)), y(l.b.p)); ctx.stroke(); }
      else if (l.type === 'rect') { const x1 = x(tIdx(l.a.t)), x2 = x(tIdx(l.b.t)), y1 = y(l.a.p), y2 = y(l.b.p); ctx.fillStyle = 'rgba(240,180,91,0.12)'; ctx.fillRect(Math.min(x1, x2), Math.min(y1, y2), Math.abs(x2 - x1), Math.abs(y2 - y1)); ctx.strokeRect(Math.min(x1, x2), Math.min(y1, y2), Math.abs(x2 - x1), Math.abs(y2 - y1)); }
      else if (l.type === 'fib') { const xa = x(tIdx(l.a.t)), xb = x(tIdx(l.b.t)), x1 = Math.min(xa, xb), x2 = Math.max(xa, xb, x1 + 60), lv = p => l.b.p + (l.a.p - l.b.p) * p;
        ctx.fillStyle = 'rgba(157,140,255,0.12)'; ctx.fillRect(x1, Math.min(y(lv(.5)), y(lv(.618))), x2 - x1, Math.abs(y(lv(.618)) - y(lv(.5))));
        [0, .236, .382, .5, .618, .786, 1].forEach(r => { const yy = y(lv(r)); ctx.strokeStyle = r === .5 || r === .618 ? '#9d8cff' : ML; ctx.setLineDash(r === 0 || r === 1 ? [] : [4, 3]); ctx.beginPath(); ctx.moveTo(x1, yy); ctx.lineTo(x2, yy); ctx.stroke(); ctx.setLineDash([]); ctx.fillStyle = ctx.strokeStyle; ctx.font = '10px JetBrains Mono, monospace'; ctx.textAlign = 'left'; ctx.fillText((r * 100).toFixed(1) + '%  ' + fmt(lv(r)), x2 + 4, yy + 3); });
        ctx.strokeStyle = ML; ctx.setLineDash([2, 3]); ctx.beginPath(); ctx.moveTo(xa, y(l.a.p)); ctx.lineTo(xb, y(l.b.p)); ctx.stroke(); ctx.setLineDash([]); }
      else if (l.type === 'x') { ctx.font = '600 12px Instrument Sans, sans-serif'; ctx.textAlign = 'left'; const xx = x(tIdx(l.t)), yy = y(l.p), tw = ctx.measureText(l.text).width + 10; ctx.fillStyle = 'rgba(10,13,22,0.85)'; ctx.fillRect(xx - 2, yy - 13, tw, 18); ctx.fillStyle = ML; ctx.fillText(l.text, xx + 3, yy); }
    });
    ctx.lineWidth = 1;
    if (this.pending) { ctx.fillStyle = ML; ctx.beginPath(); ctx.arc(x(tIdx(this.pending.t)), y(this.pending.p), 4, 0, Math.PI * 2); ctx.fill();
      if (this.mouse) { ctx.setLineDash([4, 3]); ctx.strokeStyle = ML; ctx.beginPath(); ctx.moveTo(x(tIdx(this.pending.t)), y(this.pending.p)); ctx.lineTo(this.mouse.x, this.mouse.y); ctx.stroke(); ctx.setLineDash([]); } }
    this.drawExtra(ctx, x, y, pW, start, n);
    const last = bars[n - 1], ly = y(last.close), lcol = last.close >= last.open ? UP : DN;
    ctx.setLineDash([2, 3]); ctx.strokeStyle = lcol; ctx.beginPath(); ctx.moveTo(0, ly); ctx.lineTo(pW, ly); ctx.stroke(); ctx.setLineDash([]);
    ctx.restore();
    manual.filter(l => l.type === 'h').forEach(l => { const yy = y(l.price); if (yy < 0 || yy > pH) return; ctx.fillStyle = ML; ctx.fillRect(pW, yy - 9, aW, 18); ctx.fillStyle = '#0a0d16'; ctx.font = '700 10px JetBrains Mono, monospace'; ctx.textAlign = 'left'; ctx.fillText(fmt(l.price), pW + 7, yy + 4); });
    ctx.fillStyle = lcol; ctx.fillRect(pW, ly - 10, aW, 20); ctx.fillStyle = '#0a0d16'; ctx.font = '700 11px JetBrains Mono, monospace'; ctx.textAlign = 'left'; ctx.fillText(fmt(last.close), pW + 7, ly + 4);
    this.hoverIdx = null;
    const ms = this.mouse;
    if (ms && ms.x < pW && ms.y < pH) {
      const idx = Math.round(ms.x / step - 0.5 + (end - count)); this.hoverIdx = idx >= 0 && idx < n ? idx : null;
      ctx.strokeStyle = '#5b6380'; ctx.setLineDash([3, 3]);
      ctx.beginPath(); ctx.moveTo(0, ms.y + 0.5); ctx.lineTo(pW, ms.y + 0.5); ctx.moveTo(ms.x + 0.5, 0); ctx.lineTo(ms.x + 0.5, pH); ctx.stroke(); ctx.setLineDash([]);
      const p = lo + (1 - ms.y / pH) * (hi - lo);
      ctx.fillStyle = '#2a3145'; ctx.fillRect(pW, ms.y - 10, aW, 20); ctx.fillStyle = '#e9ebf2'; ctx.fillText(fmt(p), pW + 7, ms.y + 4);
      if (this.hoverIdx !== null) {
        const t = new Date(bars[this.hoverIdx].time).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
        const tw = ctx.measureText(t).width + 14; ctx.fillStyle = '#2a3145'; ctx.fillRect(ms.x - tw / 2, pH + 2, tw, 20); ctx.fillStyle = '#e9ebf2'; ctx.textAlign = 'center'; ctx.fillText(t, ms.x, pH + 16);
      }
    }
  }

  setSymbol(s) { this.view = { count: 140, offset: 0, yZoom: 1 }; this.model = null; this.setState({ symbol: s, bars: [] }, () => this.load()); }



  renderVals() {
    const s = this.state, layout = this.props.layout ?? 'A';
    const sym = this.SYM[s.symbol], perf = this.perf, bars = s.bars, closed = Math.max(0, bars.length - 1);
    const sp = s.resultsOf === 'ms' ? this.msPerf : s.resultsOf === 'planner' ? this.plannerPerf : s.resultsOf === 'pa' ? this.paPerf : this.perf;
    const stats = sp ? { signals: sp.signals, closed: sp.closed, active: sp.active + sp.excluded, wins: sp.wins, losses: sp.losses, excluded: sp.excluded } : { signals: '—', closed: '—', active: '—', wins: '—', losses: '—', excluded: '—' };
    const net = sp ? sp.netR : 0, netR = sp ? (net > 0 ? '+' : '') + net.toFixed(2).replace('.', ',') + ' R' : '—';
    const f2 = v => v == null ? '—' : v.toFixed(this.dp());
    const hb = bars[s.hover ?? bars.length - 1];
    const crypto = this.CRYPTOS.find(c => c.id === s.crypto);
    const amountOf = c => c.coin === 'BTC' ? (s.prices.BTC ? (this.biz.price / s.prices.BTC).toFixed(6) + ' BTC' : '… BTC') : c.coin === 'ETH' ? (s.prices.ETH ? (this.biz.price / s.prices.ETH).toFixed(5) + ' ETH' : '… ETH') : this.biz.price.toFixed(2) + ' ' + c.coin;
    const dirOf = d => d === 1 ? 'BUY' : 'SELL', colOf = d => d === 1 ? '#3fd2a4' : '#f2707a';
    const rFmt = r => r == null ? '—' : (r > 0 ? '+' : '') + r.toFixed(1) + ' R';
    const ops = perf ? perf.ops.slice().reverse().map(o => ({ time: this.fmtT(o.time), dir: dirOf(o.direction), color: colOf(o.direction), entry: f2(o.entry), stop: f2(o.stop), tp: f2(o.tps[2]), status: o.status, ...this.confOut(o.index, o.direction), r: rFmt(o.resultR), rColor: o.resultR == null ? '#8d93a8' : o.resultR > 0 ? '#3fd2a4' : '#f2707a' })) : [];
    const lastClose = bars.length ? bars[bars.length - 1].close : null;
    const positions = perf ? perf.ops.filter(o => o.status === 'En cours').reverse().map(o => {
      const r = lastClose ? o.direction * (lastClose - o.entry) / Math.abs(o.entry - o.stop) : 0;
      return { dir: dirOf(o.direction), color: colOf(o.direction), symbol: sym.label, time: this.fmtT(o.time), entry: f2(o.entry), price: f2(lastClose), stop: f2(o.stop), tps: o.tps.map(f2).join(' · '), r: rFmt(r), rColor: r >= 0 ? '#3fd2a4' : '#f2707a' };
    }) : [];
    const history = perf ? perf.trades.slice().reverse().map(o => ({ time: this.fmtT(o.time), closed: this.fmtT(o.closedAt), dir: dirOf(o.direction), color: colOf(o.direction), entry: f2(o.entry), exit: f2(o.exit), r: rFmt(o.resultR), rColor: o.resultR > 0 ? '#3fd2a4' : '#f2707a' })) : [];
    const lp = this.model?.plan, lpOp = perf?.ops[perf.ops.length - 1];
    const lastPlan = lp ? { time: this.fmtT(lp.time), dir: dirOf(lp.direction), color: colOf(lp.direction), status: lpOp?.status ?? '—', ...this.confOut(lp.index, lp.direction), levels: [['Entrée', lp.entry, '#9d8cff'], ['Stop loss', lp.stop, '#f2707a'], ...lp.tps.map((p, i) => ['TP' + (i + 1), p, '#3fd2a4'])].map(([name, p, color]) => ({ name, price: f2(p), color })) } : { time: '', dir: 'Aucun', color: '#8d93a8', status: '—', levels: [], conf: '—', confColor: '#8d93a8', confPct: '0%', confWhy: '' };
    const signalsAll = this.model?.signals ?? [];
    const sigLast = signalsAll[signalsAll.length - 1];
    const steps = ['En attente du paiement', 'Transaction détectée', 'Confirmations 3 / 3', 'Abonnement activé'];
    const active = (key, a, b) => key ? a : b;
    const name = s.name || (s.email ? s.email.split('@')[0] : 'Trader');
    const nm = (k, l) => ({ label: l, select: () => this.setState({ appTab: k, notifOpen: false }), bg: active(s.appTab === k, '#221f3d', 'transparent'), color: active(s.appTab === k, '#c9bfff', '#8d93a8'), dot: active(s.appTab === k, '#9d8cff', '#3a4157') });
    const t0 = new Date(); t0.setMonth(t0.getMonth() + 1);
    return {
      isLanding: s.screen === 'landing', isAuth: s.screen === 'auth', isPlan: s.screen === 'plan', isPayment: s.screen === 'payment', isApp: s.screen === 'app',
      goLanding: () => this.go('landing'), goLogin: () => { this.setState({ authMode: 'login' }); this.go('auth'); }, goSignup: () => { this.setState({ authMode: 'signup' }); this.go('auth'); },
      goPayment: () => { this.setState({ payStep: -1, payLeft: 1800 }); this.go('payment'); this.loadPrices(); }, goApp: () => this.go('app'),
      goProfile: () => this.setState({ appTab: 'profile', notifOpen: false }),
      heroPrice: lastClose ? lastClose.toFixed(2) : '— —', heroSignal: sigLast ? dirOf(sigLast.direction) + ' · ' + this.fmtT(sigLast.time) : 'Aucun', heroSignalColor: sigLast ? colOf(sigLast.direction) : '#8d93a8',
      stats, netR, netColor: !sp ? '#e9ebf2' : net >= 0 ? '#3fd2a4' : '#f2707a', winRate: sp?.winRate != null ? sp.winRate.toFixed(2).replace('.', ',') + ' %' : '—', drawdown: sp ? sp.drawdown.toFixed(2) + ' R' : '—',
      isSignup: s.authMode === 'signup', authTitle: s.authMode === 'signup' ? 'Créer votre compte' : 'Bon retour', authCta: s.authMode === 'signup' ? 'Créer le compte' : 'Se connecter',
      loginTabBg: active(s.authMode === 'login', '#1d2232', 'transparent'), loginTabColor: active(s.authMode === 'login', '#e9ebf2', '#8d93a8'),
      signupTabBg: active(s.authMode === 'signup', '#1d2232', 'transparent'), signupTabColor: active(s.authMode === 'signup', '#e9ebf2', '#8d93a8'),
      name: s.name, email: s.email, password: s.password, authError: s.authError,
      onName: e => this.setState({ name: e.target.value }), onEmail: e => this.setState({ email: e.target.value }), onPassword: e => this.setState({ password: e.target.value }),
      firstName: name.split(' ')[0], displayName: s.name || name, displayEmail: s.email || 'vous@exemple.com', initials: name.slice(0, 2).toUpperCase(),
      toggleNotif: () => this.setState({ notifOpen: !s.notifOpen }), notifOpen: s.notifOpen, hasSignals: signalsAll.length > 0,
      notifList: signalsAll.slice(-5).reverse().map(g => ({ dir: dirOf(g.direction), color: colOf(g.direction), symbol: sym.label + ' ' + s.tf, time: this.fmtT(g.time) })),
      isTrader: s.appTab === 'trader', isPositions: s.appTab === 'positions', isCalendar: s.appTab === 'calendar', isHistory: s.appTab === 'history', isProfile: s.appTab === 'profile',
      tabs: [['chart', 'Graphique'], ['summary', 'Résumé'], ['ops', 'Opérations']].map(([k, label]) => ({ label, select: () => this.setState({ tab: k }), line: active(s.tab === k, '#9d8cff', 'transparent'), color: active(s.tab === k, '#e9ebf2', '#8d93a8') })),
      isChartTab: s.tab === 'chart', isSummaryTab: s.tab === 'summary', isOpsTab: s.tab === 'ops',
      layoutDir: layout === 'B' ? 'column-reverse' : 'row', panelMax: layout === 'B' ? 'none' : '300px', panelDir: layout === 'B' ? 'row' : 'column', fb220: layout === 'B' ? '1 1 220px' : '0 0 auto', fb120: layout === 'B' ? '1 1 120px' : '0 0 auto', fb160: layout === 'B' ? '1 1 160px' : '0 0 auto', fb180: layout === 'B' ? '1 1 180px' : '0 0 auto', fb240: layout === 'B' ? '2 1 240px' : '0 0 auto', chartMinH: layout === 'B' ? '560px' : '520px',
      stateLabel: s.loading ? 'Calcul…' : bars.length < 41 ? 'Indisponible' : 'Calculé', stateColor: s.loading ? '#f0b45b' : '#3fd2a4',
      progressPct: sp ? Math.max(0, Math.min(100, net / 10 * 100)) + '%' : '0%', progressLabel: sp ? netR + ' / +10 R' : '—',
      calcInfo: `${sym.label} · ${s.tf} · ${closed} bougies clôturées · ${sp ? sp.active + sp.excluded : 0} non résolus / exclus`,
      calcRange: bars.length ? this.fmtT(bars[0].time) + ' → ' + this.fmtT(bars[closed - 1]?.time) : '',
      detailsOpen: s.detailsOpen, detailsLabel: (s.detailsOpen ? '▾' : '▸') + ' Détails du calcul', toggleDetails: () => this.setState({ detailsOpen: !s.detailsOpen }),
      chartBoxRef: this.chartBoxRef, canvasRef: this.canvasRef,
      symbols: Object.keys(this.SYM).map(k => ({ label: this.SYM[k].label, select: () => k !== s.symbol && this.setSymbol(k), bg: active(s.symbol === k, '#221f3d', 'transparent'), color: active(s.symbol === k, '#c9bfff', '#8d93a8') })),
      tf: s.tf, onTf: e => { this.view = { count: 140, offset: 0, yZoom: 1 }; this.setState({ tf: e.target.value, bars: [] }, () => this.load()); },
      toggleInd: () => this.setState({ indOpen: !s.indOpen }), indOpen: s.indOpen,
      indList: [['ema', 'EMA 50'], ['zone', 'Zones offre / demande'], ['plan', 'Signaux + plan (Entrée, SL, TP)'], ['structure', 'Structure BOS / CHoCH']].map(([k, label]) => ({ label, bg: s.ind[k] ? '#9d8cff' : 'transparent', toggle: () => this.setState({ ind: { ...s.ind, [k]: !s.ind[k] } }) })),
      resetView: this.resetView, fullscreen: () => { const b = this.box; if (!b) return; document.fullscreenElement ? document.exitFullscreen() : b.requestFullscreen?.(); },
      toggleDemo: () => this.setState({ demo: !s.demo, bars: [] }, () => this.load()),
      demoLabel: s.demo ? 'Démonstration' : 'En direct', demoBg: s.demo ? '#2b2414' : '#0f2620', demoColor: s.demo ? '#f0b45b' : '#3fd2a4', demoBorder: s.demo ? '#5a4520' : '#1f4a3f',
      symbolName: sym.name, symbolLabel: sym.label,
      ohlc: hb ? `O ${f2(hb.open)}  H ${f2(hb.high)}  L ${f2(hb.low)}  C ${f2(hb.close)}` : '',
      sourceLabel: s.source + (s.lastFetch && !s.demo && !s.feedErr ? ' · reçu il y a ' + Math.max(0, Math.round((s.now - s.lastFetch) / 1000)) + ' s' : '') + (bars.length ? ' · bougie ' + new Date(bars[bars.length - 1].time).toLocaleTimeString('fr-FR', { timeZone: this.ex.set.tz, hour: '2-digit', minute: '2-digit' }) : ''),
      feedColor: s.feedErr ? '#f2707a' : s.demo ? '#f0b45b' : (s.now - s.lastFetch) > 30000 ? '#f0b45b' : '#3fd2a4',
      feedBorder: s.feedErr ? '#4a2530' : s.demo ? '#4a3b20' : '#1f3a35',
      fsLabel: s.fs ? 'Quitter le plein écran' : 'Plein écran',
      extraInd: [['planner', 'Signal Trade Planner', 'EMA 21/50 · RSI 14 · stop suiveur après TP1', this.plannerM?.signals.length], ['pa', 'Price Action & Liquidity Map', 'BOS/CHoCH · Sweep · EQH/EQL', this.paM?.events.length], ['heat', 'Volumetric Regression Heatmap', 'Canal de régression + volume', null], ['heatProfile', 'Profil de volume (heatmap)', 'Barres à droite du canal', null]].map(([k, label, sub, c]) => ({ label, sub: sub + (s.ind[k] && c != null ? ' · ' + c + (k === 'pa' ? ' évén.' : ' signaux') : ''), bg: s.ind[k] ? '#9d8cff' : 'transparent', toggle: () => this.setState({ ind: { ...s.ind, [k]: !s.ind[k] } }) })),
      resultsOf: s.resultsOf, onResultsOf: e => this.setState({ resultsOf: e.target.value }),
      msToggles: [['on', 'Market Structure & Fibonacci + RR'], ['fib', 'Zone Fibonacci 50–61,8 %']].map(([k, label]) => ({ label, bg: s.ms[k] ? '#9d8cff' : 'transparent', toggle: () => this.setMs({ [k]: !s.ms[k] }) })),
      msTerm: s.ms.term, onMsTerm: e => this.setMs({ term: e.target.value }),
      msRr: s.ms.rr, onMsRr: e => { const v = parseFloat(e.target.value); if (v > 0) this.setMs({ rr: v }); },
      blhSignals: this.perf ? this.perf.signals : 0, msSetups: this.struct ? this.struct.setups.length : 0,
      legend: [
        ...(s.ms.on ? [{ label: 'BOS', color: '#3fd2a4' }, ...(s.ms.fib ? [{ label: 'Fibonacci 50–61,8 %', color: '#9d8cff' }] : []), { label: 'RR ' + s.ms.rr, color: '#e9ebf2' }] : []),
        ...(s.ind.ema ? [{ label: 'EMA 50', color: '#7aa7ff' }] : []),
        ...(s.ind.plan ? [{ label: 'ENTRÉE', color: '#9d8cff' }, { label: 'TP1–3', color: '#3fd2a4' }, { label: 'SL', color: '#f2707a' }] : []),
        ...(s.ind.zone ? [{ label: 'Offre / demande', color: '#f2707a' }] : []),
        ...(s.ind.planner ? [{ label: 'Trade Planner · EMA 21', color: '#22d3ee' }, { label: 'EMA 50', color: '#8b5cf6' }] : []),
        ...(s.ind.pa ? [{ label: 'PA Liquidity · EQH/EQL', color: '#5b9cf6' }] : []),
        ...(s.ind.heat ? [{ label: this.heat?.error ? 'Régression : historique insuffisant' : 'Volumetric Regression', color: '#f0b45b' }] : []),
        { label: 'Lignes manuelles', color: '#f0b45b' }
      ],
      tools: [['cursor', '＋', 'Curseur / déplacer'], ['hline', '━', 'Ligne horizontale'], ['trend', '╱', 'Ligne de tendance : deux points'], ['rect', '▭', 'Rectangle : deux coins'], ['fib', 'φ', 'Fibonacci manuel : du point de départ au point d\'arrivée'], ['text', 'T', 'Texte : cliquez pour annoter'], ['replay', '⏯', 'Replay de marché'], ['zin', '⊕', 'Zoom avant'], ['zout', '⊖', 'Zoom arrière'], ['reset', '↺', 'Réinitialiser la vue'], ['del', '⌫', 'Supprimer la dernière ligne de cette période']].map(([k, glyph, title]) => {
        const isTool = ['cursor', 'hline', 'trend', 'rect', 'fib', 'text'].includes(k), on = (isTool && s.tool === k) || (k === 'replay' && !!this.rp);
        return { glyph, title, gap: k === 'zin' || k === 'del' || k === 'replay' ? '10px' : '0px', bg: on ? '#221f3d' : 'transparent', color: on ? '#c9bfff' : '#a3a9bd', border: on ? '#4a3f8f' : '#1f2536',
          select: () => {
            if (isTool) { this.pending = null; this.setState({ tool: k, trendPending: false, textAt: null }); return; }
            if (k === 'replay') { this.startReplay(); return; }
            if (k === 'zin') this.view.count = Math.max(20, this.view.count * 0.8);
            if (k === 'zout') this.view.count = Math.min(500, this.view.count * 1.25);
            if (k === 'reset') this.view = { count: 140, offset: 0, yZoom: 1 };
            if (k === 'del') { this.lines[this.lkey()]?.pop(); this.saveLines(); }
            this.draw();
          } };
      }),
      toolHint: this.rp ? 'Replay : lecture bougie par bougie — les indicateurs sont recalculés à chaque bougie' : s.tool === 'rect' || s.tool === 'fib' ? (s.trendPending ? 'Cliquez le second point' : 'Cliquez le premier point') : s.tool === 'text' ? 'Cliquez sur le graphique pour écrire une annotation' : s.tool === 'hline' ? 'Cliquez sur le graphique pour placer une ligne horizontale' : s.tool === 'trend' ? (s.trendPending ? 'Cliquez le second point de la tendance' : 'Cliquez le premier point de la tendance') : 'Molette : zoom · Glisser : déplacer · Axe droit : échelle du prix · Double-clic : échelle auto',
      loading: s.loading,
      lastPlan, ops, noOps: perf && !ops.length, positions, noPositions: perf && !positions.length, history, noHistory: perf && !history.length,
      calendar: [],
      renewDate: new Date(this.biz.until).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }), paidWith: s.paidWith,
      lang: s.lang, onLang: e => this.setState({ lang: e.target.value }),
      prefs: [['prefSignals', 'Alertes de nouveaux signaux'], ['prefSound', 'Son des alertes']].map(([k, label]) => ({ label, toggle: () => this.setState({ [k]: !s[k] }), track: s[k] ? '#9d8cff' : '#2a3145', justify: s[k] ? 'flex-end' : 'flex-start' })),
      logout: () => this.go('landing'),
      ...this.supportVals(),
      ...this.extraVals(s, sym, lastClose, dirOf, colOf),
      ...this.moreVals(s, sym, dirOf, colOf),
      nav: [nm('trader', 'Trader'), nm('positions', 'Positions'), nm('journal', 'Journal'), nm('calendar', 'Calendrier'), nm('history', 'Historique'), nm('support', 'Support'), nm('profile', 'Plus')]
    };
  }
}
