(function(){
const languages={fr:'Français',en:'English',es:'Español',ar:'العربية'};
const rtl=new Set(['ar']);
const titles={fr:'BLH XAUUSD — Le marché, en perspective',en:'BLH XAUUSD — The market in perspective',es:'BLH XAUUSD — El mercado en perspectiva',ar:'BLH XAUUSD — السوق برؤية أوضح'};
const translations={
'⚙ Indikatoren':{en:'⚙ Indicators',fr:'⚙ Indicateurs',es:'⚙ Indicadores',ar:'⚙ المؤشرات',ary:'⚙ المؤشرات'},
'Markt auswählen':{en:'Choose market',fr:'Choisir le marché',es:'Elegir mercado',ar:'اختر السوق',ary:'اختار السوق'},
'Chart-Zeitrahmen':{en:'Chart timeframe',fr:'Période du graphique',es:'Temporalidad',ar:'الإطار الزمني',ary:'المدة ديال الشارت'},
'Chart-Werkzeuge':{en:'Chart tools',fr:'Outils du graphique',es:'Herramientas del gráfico',ar:'أدوات الرسم',ary:'أدوات الشارت'},
'Vollbild':{en:'Fullscreen',fr:'Plein écran',es:'Pantalla completa',ar:'ملء الشاشة',ary:'الشاشة كاملة'},
'Cursor / Verschieben':{en:'Cursor / Pan',fr:'Curseur / déplacer',es:'Cursor / mover',ar:'المؤشر / التحريك',ary:'المؤشر / حرّك'},
'Horizontale Linie hinzufügen':{en:'Add horizontal line',fr:'Ajouter une ligne horizontale',es:'Añadir línea horizontal',ar:'إضافة خط أفقي',ary:'زيد خط أفقي'},
'Trendlinie: zwei Punkte':{en:'Trend line: two points',fr:'Ligne de tendance : deux points',es:'Línea de tendencia: dos puntos',ar:'خط اتجاه: نقطتان',ary:'خط الاتجاه: جوج نقاط'},
'Vergrößern':{en:'Zoom in',fr:'Zoom avant',es:'Acercar',ar:'تكبير',ary:'كبّر'},
'Verkleinern':{en:'Zoom out',fr:'Zoom arrière',es:'Alejar',ar:'تصغير',ary:'صغّر'},
'Ansicht zurücksetzen':{en:'Reset view',fr:'Réinitialiser la vue',es:'Restablecer vista',ar:'إعادة ضبط العرض',ary:'رجّع الشارت'},
'Letzte Linie dieses Zeitrahmens löschen':{en:'Delete last line on this timeframe',fr:'Supprimer la dernière ligne de cette période',es:'Borrar la última línea de este marco',ar:'حذف آخر خط في هذا الإطار',ary:'حيد آخر خط فهاد المدة'},
'Gold / US-Dollar':{en:'Gold / US Dollar',fr:'Or / Dollar américain',es:'Oro / Dólar estadounidense',ar:'الذهب / الدولار الأمريكي',ary:'الذهب / الدولار'},
'Bitcoin / US-Dollar':{en:'Bitcoin / US Dollar',fr:'Bitcoin / Dollar américain',es:'Bitcoin / Dólar estadounidense',ar:'بيتكوين / الدولار الأمريكي',ary:'بيتكوين / الدولار'},
'Struktur':{en:'Structure',fr:'Structure',es:'Estructura',ar:'البنية',ary:'البنية'},
'Marktstruktur & Fibonacci + CRV':{en:'Market Structure & Fibonacci + RR',fr:'Structure de marché & Fibonacci + RR',es:'Estructura de mercado & Fibonacci + RR',ar:'بنية السوق وفايبوناتشي + العائد/المخاطرة',ary:'بنية السوق وفايبوناتشي + الربح/الخسارة'},
'Risiko / Ertrag':{en:'Risk / reward',fr:'Risque / rendement',es:'Riesgo / beneficio',ar:'المخاطرة / العائد',ary:'الخسارة / الربح'},
'Ersetzte Setups ohne Einstieg ausblenden':{en:'Hide replaced setups without entry',fr:'Masquer les configurations remplacées sans entrée',es:'Ocultar setups reemplazados sin entrada',ar:'إخفاء الإعدادات المستبدلة بلا دخول',ary:'خبي الستابات اللي تبدلو بلا دخول'},
'Intelligente BUY- & SELL-Zonen + TP Engine V2':{en:'Smart BUY & SELL Zones + TP Engine V2',fr:'Zones BUY & SELL intelligentes + TP Engine V2',es:'Zonas BUY & SELL inteligentes + TP Engine V2',ar:'مناطق شراء وبيع ذكية + أهداف V2',ary:'مناطق شراء وبيع ذكية + أهداف V2'},
'Signal Trade Planner Strategy':{en:'Signal Trade Planner Strategy',fr:'Stratégie de planification des signaux',es:'Estrategia de planificación de señales',ar:'استراتيجية تخطيط إشارات التداول'},
'Signal mode':{en:'Signal mode',fr:'Mode de signal',es:'Modo de señal',ar:'وضع الإشارة'},
'Hybrid':{en:'Hybrid',fr:'Hybride',es:'Híbrido',ar:'هجين'},
'EMA crossover':{en:'EMA crossover',fr:'Croisement des EMA',es:'Cruce de EMA',ar:'تقاطع المتوسطات EMA'},
'Pullback continuation':{en:'Pullback continuation',fr:'Continuation après repli',es:'Continuación tras retroceso',ar:'استمرار بعد التصحيح'},
'Fast EMA':{en:'Fast EMA',fr:'EMA rapide',es:'EMA rápida',ar:'EMA سريع'},
'Slow EMA':{en:'Slow EMA',fr:'EMA lente',es:'EMA lenta',ar:'EMA بطيء'},
'RSI length':{en:'RSI length',fr:'Période RSI',es:'Período RSI',ar:'فترة RSI'},
'RSI threshold':{en:'RSI threshold',fr:'Seuil RSI',es:'Umbral RSI',ar:'عتبة RSI'},
'Minimum EMA separation (ATR)':{en:'Minimum EMA separation (ATR)',fr:'Écart minimal des EMA (ATR)',es:'Separación mínima de EMA (ATR)',ar:'أدنى تباعد بين EMA ‏(ATR)'},
'Minimum candle body (ATR)':{en:'Minimum candle body (ATR)',fr:'Corps minimal de bougie (ATR)',es:'Cuerpo mínimo de vela (ATR)',ar:'أدنى جسم للشمعة ‏(ATR)'},
'Cooldown bars':{en:'Cooldown bars',fr:'Bougies de temporisation',es:'Velas de espera',ar:'شموع الانتظار'},
'Stop mode':{en:'Stop mode',fr:'Mode du stop',es:'Modo de stop',ar:'وضع وقف الخسارة'},
'Recent swing':{en:'Recent swing',fr:'Dernier swing',es:'Último swing',ar:'آخر قمة أو قاع'},
'Swing lookback':{en:'Swing lookback',fr:'Fenêtre du swing',es:'Ventana del swing',ar:'نطاق البحث عن السوينغ'},
'Same-bar priority':{en:'Same-bar priority',fr:'Priorité sur la même bougie',es:'Prioridad en la misma vela',ar:'الأولوية داخل الشمعة نفسها'},
'Stop first':{en:'Stop first',fr:'Stop en premier',es:'Stop primero',ar:'وقف الخسارة أولاً'},
'Targets first':{en:'Targets first',fr:'Objectifs en premier',es:'Objetivos primero',ar:'الأهداف أولاً'},
'Trade direction':{en:'Trade direction',fr:'Sens du trade',es:'Dirección de la operación',ar:'اتجاه الصفقة'},
'Both':{en:'Both',fr:'Les deux',es:'Ambos',ar:'كلا الاتجاهين'},
'Long only':{en:'Long only',fr:'Achats uniquement',es:'Solo compras',ar:'شراء فقط'},
'Short only':{en:'Short only',fr:'Ventes uniquement',es:'Solo ventas',ar:'بيع فقط'},
'Trailing stop after TP1':{en:'Trailing stop after TP1',fr:'Stop suiveur après TP1',es:'Stop dinámico después de TP1',ar:'وقف متحرك بعد الهدف الأول'},
'Trailing ATR multiplier':{en:'Trailing ATR multiplier',fr:'Multiplicateur ATR du stop suiveur',es:'Multiplicador ATR del stop dinámico',ar:'مضاعف ATR للوقف المتحرك'},
'Show backtest dashboard':{en:'Show backtest dashboard',fr:'Afficher le tableau de backtest',es:'Mostrar panel de backtest',ar:'عرض لوحة الاختبار التاريخي'},
'Stop ATR multiplier':{en:'Stop ATR multiplier',fr:'Multiplicateur ATR du stop',es:'Multiplicador ATR del stop',ar:'مضاعف ATR لوقف الخسارة'},
'EMA 21 / EMA 50':{en:'EMA 21 / EMA 50',fr:'EMA 21 / EMA 50',es:'EMA 21 / EMA 50',ar:'EMA 21 / EMA 50'},
'BUY SIGNAL':{en:'BUY SIGNAL',fr:'SIGNAL D’ACHAT',es:'SEÑAL DE COMPRA',ar:'إشارة شراء'},
'SELL SIGNAL':{en:'SELL SIGNAL',fr:'SIGNAL DE VENTE',es:'SEÑAL DE VENTA',ar:'إشارة بيع'},
'Swing-Länge':{en:'Swing length',fr:'Longueur swing',es:'Longitud swing',ar:'طول السوينغ',ary:'طول السوينغ'},
'ATR-Länge':{en:'ATR length',fr:'Longueur ATR',es:'Longitud ATR',ar:'طول ATR',ary:'طول ATR'},
'ATR-Zonengröße':{en:'ATR zone size',fr:'Taille zone ATR',es:'Tamaño zona ATR',ar:'حجم منطقة ATR',ary:'حجم زون ATR'},
'BUY- / SELL-Zonen':{en:'BUY / SELL zones',fr:'Zones BUY / SELL',es:'Zonas BUY / SELL',ar:'مناطق الشراء / البيع',ary:'مناطق الشراء / البيع'},
'BUY- / SELL-Signale':{en:'BUY / SELL signals',fr:'Signaux BUY / SELL',es:'Señales BUY / SELL',ar:'إشارات الشراء / البيع',ary:'إشارات الشراء / البيع'},
'Trendlinien':{en:'Trend lines',fr:'Lignes de tendance',es:'Líneas de tendencia',ar:'خطوط الاتجاه',ary:'خطوط الاتجاه'},
'Volumetrische Regressions-Heatmap':{en:'Volumetric Regression Heatmap',fr:'Heatmap de régression volumétrique',es:'Mapa de calor de regresión volumétrica',ar:'خريطة حرارة الانحدار الحجمي',ary:'هيتماب ديال الانحدار والحجم'},
'Quelle':{en:'Source',fr:'Source',es:'Fuente',ar:'المصدر',ary:'المصدر'},
'Basisperiode':{en:'Base period',fr:'Période de base',es:'Periodo base',ar:'الفترة الأساسية',ary:'الفترة الأساسية'},
'Rasterzeilen je Seite':{en:'Grid rows each side',fr:'Lignes de grille par côté',es:'Filas de cuadrícula por lado',ar:'صفوف الشبكة لكل جهة',ary:'سطور الشبكة فكل جهة'},
'Verlaufsglättung':{en:'Gradient smoothing',fr:'Lissage du gradient',es:'Suavizado del gradiente',ar:'تنعيم التدرج',ary:'تنعيم التدرج'},
'Signalband (SD)':{en:'Signal band (SD)',fr:'Bande signal (SD)',es:'Banda de señal (SD)',ar:'نطاق الإشارة (SD)',ary:'نطاق الإشارة (SD)'},
'Schwellenwert für flache Steigung':{en:'Flat slope threshold',fr:'Seuil de pente plate',es:'Umbral de pendiente plana',ar:'عتبة الميل المسطح',ary:'حد الميل المسطح'},
'Projektion in die Zukunft':{en:'Future projection',fr:'Projection future',es:'Proyección futura',ar:'الإسقاط المستقبلي',ary:'الإسقاط لقدّام'},
'Heatmap-Linienbreite':{en:'Heatmap line width',fr:'Largeur ligne heatmap',es:'Ancho línea heatmap',ar:'عرض خطوط الخريطة',ary:'عرض خطوط الهيتماب'},
'Profilbreite':{en:'Profile width',fr:'Largeur du profil',es:'Ancho del perfil',ar:'عرض البروفايل',ary:'عرض البروفايل'},
'Delta-Höhe':{en:'Delta height',fr:'Hauteur delta',es:'Altura delta',ar:'ارتفاع دلتا',ary:'علو دلتا'},
'Delta-Breite':{en:'Delta width',fr:'Largeur delta',es:'Ancho delta',ar:'عرض دلتا',ary:'عرض دلتا'},
'Dynamische Periode':{en:'Dynamic period',fr:'Période dynamique',es:'Periodo dinámico',ar:'فترة ديناميكية',ary:'فترة كتبدل'},
'Mittelwert-Rückkehrsignale':{en:'Mean reversion signals',fr:'Signaux retour à la moyenne',es:'Señales de reversión a la media',ar:'إشارات الرجوع للمتوسط',ary:'إشارات الرجوع للمتوسط'},
'Volumenprofil':{en:'Volume profile',fr:'Profil de volume',es:'Perfil de volumen',ar:'بروفايل الحجم',ary:'بروفايل الحجم'},
'Delta-Histogramme':{en:'Delta histograms',fr:'Histogrammes delta',es:'Histogramas delta',ar:'مدرجات دلتا',ary:'هيستوغرامات دلتا'},
'Willkommen':{en:'Welcome',fr:'Bienvenue',es:'Bienvenido',ar:'مرحبا',ary:'مرحبا'},
'Vollständiger Name':{en:'Full name',fr:'Nom complet',es:'Nombre completo',ar:'الاسم الكامل',ary:'الاسم الكامل'},
'Gmail-Adresse':{en:'Gmail address',fr:'Adresse Gmail',es:'Dirección Gmail',ar:'عنوان Gmail',ary:'Gmail ديالك'},
'Mit Gmail anmelden':{en:'Sign in with Gmail',fr:'Se connecter avec Gmail',es:'Entrar con Gmail',ar:'الدخول بـ Gmail',ary:'دخل بـ Gmail'},
'Abmelden':{en:'Sign out',fr:'Se déconnecter',es:'Cerrar sesión',ar:'تسجيل الخروج',ary:'خرج من الحساب'},
'Kerzen werden geladen…':{en:'Loading candles…',fr:'Chargement des bougies…',es:'Cargando velas…',ar:'جارٍ تحميل الشموع…',ary:'كنحمّلو الشموع…'},
'Verbindung…':{en:'Connecting…',fr:'Connexion…',es:'Conectando…',ar:'جارٍ الاتصال…',ary:'كيتربط…'},
'Wird geladen…':{en:'Loading…',fr:'Chargement…',es:'Cargando…',ar:'جارٍ التحميل…',ary:'كيتحمّل…'},
'Verbindung zu Twelve Data…':{en:'Connecting to Twelve Data…',fr:'Connexion à Twelve Data…',es:'Conectando con Twelve Data…',ar:'جارٍ الاتصال بـ Twelve Data…',ary:'كنربطو مع Twelve Data…'},
'Letzte Kerze geschlossen':{en:'Last candle closed',fr:'Dernière bougie clôturée',es:'Última vela cerrada',ar:'آخر شمعة مغلقة',ary:'آخر شمعة تسدات'},
'Kerze in Bildung':{en:'Candle forming',fr:'Bougie en formation',es:'Vela en formación',ar:'الشمعة قيد التكوين',ary:'الشمعة كتكوّن'},
'Keine Auslösung in den geladenen Kerzen.':{en:'No trigger in loaded candles.',fr:'Aucun signal dans les bougies chargées.',es:'Sin señal en las velas cargadas.',ar:'لا توجد إشارة في الشموع المحملة.',ary:'ما كايناش إشارة فالشموع المحملة.'},
'Manuelle Linien':{en:'Manual lines',fr:'Lignes manuelles',es:'Líneas manuales',ar:'خطوط يدوية',ary:'خطوط يدوية'},
'Indikatoren deaktiviert':{en:'Indicators disabled',fr:'Indicateurs désactivés',es:'Indicadores desactivados',ar:'المؤشرات معطلة',ary:'المؤشرات طافيين'},
'Daten nicht verfügbar':{en:'Data unavailable',fr:'Données indisponibles',es:'Datos no disponibles',ar:'البيانات غير متاحة',ary:'الداتا ما متوفراش'},
'Mausrad: Zoom · Ziehen: Verschieben · Rechte Achse: Preisskala · Doppelklick: automatische Skala':{en:'Mouse wheel: zoom · Drag: pan · Right axis: price scale · Double-click: auto scale',fr:'Molette : zoom · Glisser : déplacer · Axe droit : échelle du prix · Double-clic : échelle automatique',es:'Rueda: zoom · Arrastrar: mover · Eje derecho: escala de precio · Doble clic: escala automática',ar:'عجلة الفأرة: تكبير · السحب: تحريك · المحور الأيمن: مقياس السعر · نقرتان: مقياس تلقائي',ary:'روليت الفأرة: زوم · جر: حرّك · المحور ليمن: سلم الثمن · دوبل كليك: سلم أوطوماتيك'},
'Verbindung oder Datenkontingent für 15 min nicht verfügbar. Keine künstlichen Marktdaten verwendet.':{en:'Connection or data quota for 15 min is unavailable. No artificial market data is used.',fr:'Connexion ou quota de données indisponible pour 15 min. Aucune donnée de marché artificielle utilisée.',es:'Conexión o cuota de datos no disponible para 15 min. No se usan datos artificiales.',ar:'الاتصال أو حصة البيانات لمدة 15 دقيقة غير متاحة. لا يتم استخدام بيانات سوق اصطناعية.',ary:'الاتصال ولا كوطا الداتا ديال 15 دقيقة ما متوفراش. ما كنستعملوش داتا سوق مصطنعة.'}
};
const fragments={
en:{'LIVE-FEED VERBUNDEN':'LIVE FEED CONNECTED','LIVE-FEED VERBINDET NEU':'LIVE FEED RECONNECTING','LIVE-FEED UNTERBROCHEN':'LIVE FEED INTERRUPTED','AUTOMATISCHE NEUVERBINDUNG':'AUTO RECONNECT','HISTORIE VERFÜGBAR':'HISTORY AVAILABLE','WARTEN AUF NEUEN PREIS':'WAITING FOR NEW PRICE','LADEN':'LOADING','DATEN NICHT VERFÜGBAR':'DATA UNAVAILABLE','AKTUALISIERUNG FEHLGESCHLAGEN':'UPDATE FAILED','VORHERIGE DATEN':'PREVIOUS DATA','Preis empfangen':'Price received','Empfangen':'Received','Letzter Schlusskurs':'Latest close','Daten empfangen':'Data received','Kerzen werden abgerufen':'Fetching candles','Volumen des Datenanbieters':'Provider volume','Kerzenaktivität + Live-Ticks':'Candle activity + live ticks','Smart: vorläufige Signale bis zum Kerzenschluss':'Smart: provisional signals until candle close','Smart: vorläufige':'Smart: provisional','bis zum Kerzenschluss':'until candle close','Regression aktiv':'Regression active','Letztes historisches Signal':'Latest historical signal','Kauf':'Buy','Verkauf':'Sell','Einstieg':'Entry','Signale':'signals'},
fr:{'LIVE-FEED VERBUNDEN':'FLUX DIRECT CONNECTÉ','LIVE-FEED VERBINDET NEU':'RECONNEXION DU FLUX','LIVE-FEED UNTERBROCHEN':'FLUX DIRECT COUPÉ','AUTOMATISCHE NEUVERBINDUNG':'RECONNEXION AUTO','HISTORIE VERFÜGBAR':'HISTORIQUE DISPONIBLE','WARTEN AUF NEUEN PREIS':'EN ATTENTE DU NOUVEAU PRIX','LADEN':'CHARGEMENT','DATEN NICHT VERFÜGBAR':'DONNÉES INDISPONIBLES','AKTUALISIERUNG FEHLGESCHLAGEN':'MISE À JOUR ÉCHOUÉE','VORHERIGE DATEN':'DONNÉES PRÉCÉDENTES','Preis empfangen':'Prix reçu','Empfangen':'Reçu','Letzter Schlusskurs':'Dernière clôture','Daten empfangen':'Données reçues','Kerzen werden abgerufen':'Récupération des bougies','Volumen des Datenanbieters':'Volume du fournisseur','Kerzenaktivität + Live-Ticks':'Activité des bougies + ticks live','Smart: vorläufige Signale bis zum Kerzenschluss':'Smart : signaux provisoires jusqu’à la clôture','Smart: vorläufige':'Smart : provisoire','bis zum Kerzenschluss':'jusqu’à la clôture','Regression aktiv':'Régression active','Letztes historisches Signal':'Dernier signal historique','Kauf':'Achat','Verkauf':'Vente','Einstieg':'Entrée','Signale':'signaux'},
es:{'LIVE-FEED VERBUNDEN':'DATOS EN VIVO CONECTADOS','LIVE-FEED VERBINDET NEU':'DATOS EN VIVO RECONECTANDO','LIVE-FEED UNTERBROCHEN':'DATOS EN VIVO INTERRUMPIDOS','AUTOMATISCHE NEUVERBINDUNG':'RECONEXIÓN AUTO','HISTORIE VERFÜGBAR':'HISTORIAL DISPONIBLE','WARTEN AUF NEUEN PREIS':'ESPERANDO NUEVO PRECIO','LADEN':'CARGANDO','DATEN NICHT VERFÜGBAR':'DATOS NO DISPONIBLES','AKTUALISIERUNG FEHLGESCHLAGEN':'ACTUALIZACIÓN FALLIDA','VORHERIGE DATEN':'DATOS ANTERIORES','Preis empfangen':'Precio recibido','Empfangen':'Recibido','Letzter Schlusskurs':'Último cierre','Daten empfangen':'Datos recibidos','Kerzen werden abgerufen':'Cargando velas','Volumen des Datenanbieters':'Volumen del proveedor','Kerzenaktivität + Live-Ticks':'Actividad de velas + ticks en vivo','Smart: vorläufige Signale bis zum Kerzenschluss':'Smart: señales provisionales hasta el cierre','Smart: vorläufige':'Smart: provisional','bis zum Kerzenschluss':'hasta el cierre','Regression aktiv':'Regresión activa','Letztes historisches Signal':'Última señal histórica','Kauf':'Compra','Verkauf':'Venta','Einstieg':'Entrada','Signale':'señales'},
ar:{'LIVE-FEED VERBUNDEN':'البث المباشر متصل','LIVE-FEED VERBINDET NEU':'إعادة ربط البث المباشر','LIVE-FEED UNTERBROCHEN':'البث المباشر منقطع','AUTOMATISCHE NEUVERBINDUNG':'إعادة الاتصال تلقائياً','HISTORIE VERFÜGBAR':'البيانات السابقة متوفرة','WARTEN AUF NEUEN PREIS':'في انتظار سعر جديد','LADEN':'تحميل','DATEN NICHT VERFÜGBAR':'البيانات غير متاحة','AKTUALISIERUNG FEHLGESCHLAGEN':'فشل التحديث','VORHERIGE DATEN':'البيانات السابقة','Preis empfangen':'السعر المستلم','Empfangen':'تم الاستلام','Letzter Schlusskurs':'آخر إغلاق','Daten empfangen':'تم استلام البيانات','Kerzen werden abgerufen':'جارٍ جلب الشموع','Volumen des Datenanbieters':'حجم المزود','Kerzenaktivität + Live-Ticks':'نشاط الشموع + تحديثات مباشرة','Smart: vorläufige Signale bis zum Kerzenschluss':'Smart: إشارات مؤقتة حتى إغلاق الشمعة','Smart: vorläufige':'Smart: مؤقتة','bis zum Kerzenschluss':'حتى إغلاق الشمعة','Regression aktiv':'الانحدار نشط','Letztes historisches Signal':'آخر إشارة تاريخية','Kauf':'شراء','Verkauf':'بيع','Einstieg':'دخول','Signale':'إشارات'},
ary:{'LIVE-FEED VERBUNDEN':'اللايف مربوط','LIVE-FEED VERBINDET NEU':'اللايف كيرجع يتربط','LIVE-FEED UNTERBROCHEN':'اللايف تقطع','AUTOMATISCHE NEUVERBINDUNG':'غادي يرجع يتربط بوحدو','HISTORIE VERFÜGBAR':'الداتا القديمة موجودة','WARTEN AUF NEUEN PREIS':'كنتسناو ثمن جديد','LADEN':'تحميل','DATEN NICHT VERFÜGBAR':'الداتا ما متوفراش','AKTUALISIERUNG FEHLGESCHLAGEN':'التحديث ما خدمش','VORHERIGE DATEN':'الداتا السابقة','Preis empfangen':'الثمن وصل','Empfangen':'وصل','Letzter Schlusskurs':'آخر إغلاق','Daten empfangen':'الداتا وصلات','Kerzen werden abgerufen':'كنجيبو الشموع','Volumen des Datenanbieters':'حجم المزود','Kerzenaktivität + Live-Ticks':'نشاط الشموع + تيكات لايف','Smart: vorläufige Signale bis zum Kerzenschluss':'Smart: إشارات مؤقتة حتى تسد الشمعة','Smart: vorläufige':'Smart: مؤقتة','bis zum Kerzenschluss':'حتى تسد الشمعة','Regression aktiv':'التحليل خدام','Letztes historisches Signal':'آخر إشارة قديمة','Kauf':'شراء','Verkauf':'بيع','Einstieg':'دخول','Signale':'إشارات'}
};
const selector=document.createElement('label');
selector.className='language-picker';
selector.setAttribute('aria-label','Language');
selector.innerHTML='<span>🌐</span><select>'+Object.entries(languages).map(([code,name])=>`<option value="${code}">${name}</option>`).join('')+'</select>';
(document.querySelector('.symbol-switcher')||document.querySelector('.logo')).after(selector);
const select=selector.querySelector('select'),original=new WeakMap(),attrs=new WeakMap();
let current='fr';
try{current=localStorage.getItem('blh-language')||'fr'}catch{}
if(!languages[current])current='fr';
select.value=current;
function findEntry(clean){
 if(translations[clean])return {de:clean,...translations[clean]};
 for(const [key,entry] of Object.entries(translations))if(Object.values(entry).includes(clean))return {de:key,...entry};
 return null;
}
function translateText(source){
 const clean=source.trim();
 if(!clean)return source;
 const entry=findEntry(clean);
 if(entry){
  const translated=entry[current]||clean;
  return source.replace(clean,translated);
 }
 if(current==='de')return source;
 let out=source,parts=fragments[current]||{};
 for(const [from,to] of Object.entries(parts))out=out.replaceAll(from,to);
 return out;
}
function translateNode(node){
 const element=node.nodeType===1?node:node.parentElement;
 if(element?.closest('script,style,.language-picker,#user-name,[data-copy],[data-portal-only]'))return;
 if(node.nodeType===3){
  let state=original.get(node);
  // Application updates replace the source; our own translations must not.
  if(!state||node.data!==state.rendered)state={source:node.data};
  const next=translateText(state.source);
  state.rendered=next;original.set(node,state);
  if(node.data!==next)node.data=next;
  return;
 }
 if(node.nodeType!==1||['SCRIPT','STYLE'].includes(node.tagName)||node===selector||node.id==='user-name')return;
 for(const attr of ['title','aria-label','placeholder']){
  if(!node.hasAttribute(attr))continue;
  let map=attrs.get(node);
  if(!map){map={};attrs.set(node,map)}
  const value=node.getAttribute(attr);
  let state=map[attr];
  if(!state||value!==state.rendered)state={source:value};
  const next=translateText(state.source);state.rendered=next;map[attr]=state;
  if(value!==next)node.setAttribute(attr,next);
 }
 for(const child of node.childNodes)translateNode(child);
}
const observation={subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['title','aria-label','placeholder']};
const observer=new MutationObserver(records=>{
 observer.disconnect();
 try{
  for(const record of records){
   for(const node of record.addedNodes)translateNode(node);
   if(record.type==='characterData'||record.type==='attributes')translateNode(record.target);
  }
 }finally{observer.observe(document.body,observation)}
});
function apply(){
 observer.disconnect();
 try{
 document.documentElement.lang=current;
 document.documentElement.dir=rtl.has(current)?'rtl':'ltr';
 document.title=titles[current];
 document.body.classList.toggle('rtl',rtl.has(current));
 translateNode(document.body);
 }finally{observer.observe(document.body,observation)}
 document.dispatchEvent(new Event('blh-language-change'));
}
select.addEventListener('change',()=>{current=select.value;try{localStorage.setItem('blh-language',current)}catch{}apply()});
apply();
})();
