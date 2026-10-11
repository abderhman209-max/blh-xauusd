/* Supplied interface, connected to the existing Pipvoria account and engines. */
class Terminal extends OriginalTerminal {
  state={screen:'landing',authMode:'login',name:'',email:'',password:'',authError:'',authBusy:true,approvalStatus:'',approvalEmailConfirmation:false,
    crypto:'none',payStep:-1,payLeft:0,copied:false,prices:{},appTab:'trader',tab:'chart',symbol:'XAU',tf:'5m',demo:false,
    ind:{ema:true,zone:true,plan:true,structure:true,pa:false,planner:false,heat:false,heatProfile:true},indOpen:false,notifOpen:false,detailsOpen:false,
    bars:[],loading:false,source:'',hover:null,lang:'Français',prefSignals:true,prefSound:false,paidWith:'Non configuré',tool:'cursor',trendPending:false,fs:false,
    resultsOf:'blh',mobileResultsOpen:false,ms:{on:true,fib:true,term:'Mid',rr:2},lastFetch:null,feedErr:false,now:Date.now(),notice:''};
  ex={jRange:'7d',jData:{},fStatus:'open',fDir:'all',calc:{capital:'10000',risk:'1',entry:'',stop:''},
    set:{tz:'Europe/Paris',contract:'100',lotStep:'0.01',risk:'1',confirmed:true,profile:'Standard',sessions:{asia:false,london:true,ny:true},sessionFilter:false,avoid:'',maxLossDay:'',maxTradesDay:'',goalR:'',monthlyMail:false},
    undo:[],setMsg:'',mtf:{},mtfLoading:false,pays:[],users:[]};
  biz={price:0,until:0,expiryDismissed:true,toasts:[],sigSeen:{}};
  sup={tickets:[],cur:null,composing:false,draft:{cat:'Bot / signaux',subject:'',body:''},reply:'',typing:false,configured:null,busy:false,error:'',hasMore:false,older:false};
  lines={}; journal=[]; notifications=[]; preferences={}; settings=PIPVORIA_CORE.settings({timezone:'Europe/Paris'}); settingsRevision=null; settingsReady=false; settingsDirty=false;
  marketSerial=0; settingsSerial=0; journalDrafts=new Map(); pendingMessages=new Map();
  signalTracker=PIPVORIA_CORE.tracker();
  SYM={XAU:{label:'XAU/USD',name:'Or / Dollar américain',base:4300,dp:2},BTC:{label:'BTC/USD',name:'Bitcoin / Dollar',base:98000,dp:2},ETH:{label:'ETH/USD',name:'Ethereum / Dollar',base:3500,dp:2},SOL:{label:'SOL/USD',name:'Solana / Dollar',base:180,dp:3},EUR:{label:'EUR/USD',name:'Euro / Dollar',base:1.08,dp:5},NAS:{label:'NAS100',name:'Nasdaq 100',base:21000,dp:1}};
  componentDidMount(){
    this.session=new TerminalSession({onLock:reason=>this.lock(reason)});
    this.onKey=e=>{if(e.key==='Escape')this.setState({indOpen:false,notifOpen:false,textAt:null});if(e.key==='Enter'&&this.state.screen==='auth'&&e.target.tagName==='INPUT'){e.preventDefault();this.submitAuth();}};
    this.onFs=()=>this.setState({fs:!!document.fullscreenElement});
    this.onHash=()=>{if(this.session.user&&this.state.screen==='app')this.route(location.hash.slice(1));else this.publicRoute();};
    this.onVisible=()=>{if(!document.hidden)this.checkSession();};
    window.addEventListener('keydown',this.onKey);window.addEventListener('hashchange',this.onHash);document.addEventListener('fullscreenchange',this.onFs);document.addEventListener('visibilitychange',this.onVisible);
    this.ageT=setInterval(()=>this.setState({now:Date.now()}),1000);
    this.poll=setInterval(()=>{if(this.session.user&&!document.hidden&&!this.rp&&!this.state.demo)this.load(true);},15000);
    this.sessionT=setInterval(()=>this.checkSession(),15000);
    this.priceT=setInterval(()=>this.tickPrice(),5000);
    this.supportT=setInterval(()=>{if(this.session.user&&this.state.appTab==='support'&&!document.hidden)this.loadTickets(true);},15000);
    this.adminT=setInterval(()=>{if(this.session.user?.isAdmin&&this.state.appTab==='admin'&&!document.hidden&&!this.adminBusy)this.loadAdmin();},15000);
    this.publicRoute();this.restore();
    if('serviceWorker' in navigator)navigator.serviceWorker.register('/sw.js').catch(()=>{});
  }
  componentWillUnmount(){for(const t of [this.ageT,this.poll,this.sessionT,this.priceT,this.supportT,this.adminT,this.wlT,this.rpT,this.settingsT])clearInterval(t);
    window.removeEventListener('keydown',this.onKey);window.removeEventListener('hashchange',this.onHash);window.removeEventListener('pointerup',this.onUp);
    document.removeEventListener('fullscreenchange',this.onFs);document.removeEventListener('visibilitychange',this.onVisible);this.ro?.disconnect();this.marketAbort?.abort();}
  lock(reason){
    window.BLH_AUTH={authenticated:false,user:null};this.ex.users=[];this.adminAudit=[];this.capabilities={};
    this.marketSerial++;this.marketAbort?.abort();clearTimeout(this.settingsT);this.endReplay(true);
    this.journal=[];this.notifications=[];this.preferences={};this.lines={};this.settingsReady=false;this.journalDrafts.clear();this.pendingMessages.clear();
    this.sup={...this.sup,tickets:[],cur:null,reply:'',draft:{cat:'Bot / signaux',subject:'',body:''},composing:false,configured:null,admin:false,drafts:{}};
    this.biz.toasts=[];this.biz.sigSeen={};this.signalTracker.reset();this.model=null;this.perf=null;this.struct=null;this.paM=null;this.plannerM=null;this.wl={};
    this.settings=PIPVORIA_CORE.settings({timezone:'Europe/Paris'});this.settingsRevision=null;this.settingsDirty=false;this.lastSignal=null;this.applySettings();
    this.adminSerial=(this.adminSerial||0)+1;this.adminBusy=null;this.adminLoading=false;this.adminError='';this.adminRejectId=null;
    this.setState({screen:'auth',authMode:'login',name:'',email:'',password:'',bars:[],source:'',notice:'',authBusy:false,approvalStatus:reason==='account_pending'?'pending':reason==='account_rejected'?'rejected':'',approvalEmailConfirmation:false,authError:reason==='logout_pending'?'Déconnexion en cours…':reason==='session_replaced'?'Votre session a été remplacée par une autre connexion.':''});
  }
  async restore(){try{
    const hash=new URLSearchParams(location.hash.slice(1));
    if(hash.has('access_token')){history.replaceState(null,'',location.pathname);const data=await this.session.request('auth/import-session',{publicRequest:true,body:{accessToken:hash.get('access_token'),refreshToken:hash.get('refresh_token')}});
      this.session.accept(data.user);if(hash.get('type')==='recovery'){this.setState({screen:'auth',authMode:'reset',authBusy:false,authError:'',password:''});return;}await this.unlock(data.user);return;}
    if(this.session.pendingLogout){await this.logout();return;}
    const user=await this.session.restore();if(user)await this.unlock(user);else this.setState({authError:'',authBusy:false});
  }catch(error){if(this.showApprovalError(error))return;this.setState({authBusy:false,authError:error.status===401?'':this.session.pendingLogout?'La déconnexion reste à confirmer. Réessayez.':'Session indisponible. Actualisez pour réessayer.'});}}
  showApprovalError(error){if(!['account_pending','account_rejected'].includes(error?.message))return false;this.setState({screen:'auth',authBusy:false,password:'',authError:'',approvalStatus:error.message==='account_pending'?'pending':'rejected',approvalEmailConfirmation:false});return true;}
  async checkSession(){if(!this.session.user||document.hidden||this.checking)return;this.checking=true;try{await this.session.request('auth/session');}catch{}finally{this.checking=false;}}
  async unlock(user){
    if(!user?.id||this.session.pendingLogout)return;window.BLH_AUTH={authenticated:true,user,logout:()=>this.logout()};
    this.setState({screen:'app',name:user.name||'',email:user.email||'',password:'',authBusy:false,authError:''});
    this.route(location.hash.slice(1)||new URLSearchParams(location.search).get('view'));
    const epoch=this.session.epoch;
    await Promise.allSettled([this.loadSettings(),this.loadWorkspace(),this.loadTickets(),this.loadCapabilities(),...(user.isAdmin?[this.loadAdmin()]:[])]);
    if(epoch!==this.session.epoch||!this.session.user)return;
    this.monthlyReminder();await this.load();this.loadWatch();
    this.wlT=setInterval(()=>{if(this.session.user&&!document.hidden)this.loadWatch();},60000);
  }
  async submitAuth(){if(this.state.authBusy||this.session.pendingLogout)return;
    const s=this.state,reset=s.authMode==='reset',recover=s.authMode==='recover';
    if(!reset&&!/^\S+@\S+\.\S+$/.test(s.email))return this.setState({authError:'Adresse e-mail invalide.'});
    if(!recover&&(s.password.length<(s.authMode==='signup'||reset?12:1)))return this.setState({authError:'Le mot de passe doit contenir au moins 12 caractères.'});
    if(s.authMode==='signup'&&!s.name.trim())return this.setState({authError:'Indiquez votre nom.'});
    this.setState({authBusy:true,authError:''});
    try{const route=reset?'auth/update-password':recover?'auth/recover':s.authMode==='signup'?'auth/sign-up':'auth/sign-in';
      const data=await this.session.request(route,{publicRequest:true,body:{email:s.email,password:s.password,name:s.name}});
      if(data.approvalRequired){this.setState({screen:'auth',approvalStatus:'pending',approvalEmailConfirmation:data.confirmationRequired===true,authError:'',authBusy:false,password:''});return;}
      if(recover||data.confirmationRequired){this.setState({authError:recover?'Si ce compte existe, un lien de récupération a été envoyé.':'Vérifiez votre e-mail pour confirmer votre compte.',authBusy:false,password:''});return;}
      if(reset){this.setState({authMode:'login',password:'',authBusy:false,authError:'Mot de passe mis à jour. Reconnectez-vous.'});return;}
      if(!this.session.accept(data.user))throw Error('authentication_required');await this.unlock(data.user);
    }catch(error){if(this.showApprovalError(error))return;const messages={invalid_credentials:'Adresse e-mail ou mot de passe incorrect.',email_not_confirmed:'Confirmez d’abord votre adresse e-mail avec le lien reçu.',account_disabled:'Ce compte est suspendu.',account_exists:'Ce compte existe déjà.',weak_password:'Choisissez un mot de passe plus fort.',rate_limit:'Trop de tentatives. Réessayez plus tard.',session_registry_not_configured:'Connexion temporairement indisponible.'};this.setState({authBusy:false,authError:messages[error.message]||'Impossible de valider la demande. Réessayez.'});}}
  async logout(){window.BLH_AUTH={authenticated:false,user:null};try{await this.session.signOut();this.go('landing');this.setState({authBusy:false,authError:''});}catch{this.setState({screen:'auth',authBusy:false,authError:'Déconnexion non confirmée. L’accès reste bloqué. Réessayez.'});}}
  route(route){const map={signals:'trader',performance:'journal',weekly:'journal',news:'calendar',calendar:'calendar',history:'history',support:'support',settings:'profile',access:'profile',positions:'positions',profile:'profile',journal:'journal',admin:'admin'};
    const tab=map[route]||'trader';this.setState({appTab:tab==='admin'&&!this.session.user?.isAdmin?'profile':tab});if(tab==='admin'&&this.session.user?.isAdmin)this.loadAdmin();}
  navigate(tab){if(tab==='admin'&&!this.session.user?.isAdmin)return;const route=tab==='trader'?'signals':tab;history.replaceState(null,'',location.pathname+'#'+route);this.route(route);window.scrollTo(0,0);}
  publicRoute(){if(this.session?.pendingLogout)return;const hash=location.hash.slice(1);if(hash.includes('access_token='))return;
    const landing=['','features','pricing'].includes(hash);this.setState({screen:landing?'landing':'auth',authMode:hash==='signup'?'signup':'login',authError:''});}
  openAuth(mode){if(this.session?.pendingLogout)return;this.setState({authMode:mode,password:'',authError:'',approvalStatus:'',approvalEmailConfirmation:false},()=>this.go('auth'));}
  go(screen){if(screen==='app'&&!this.session.user||this.session?.pendingLogout)return;
    if(screen==='landing'||screen==='auth')history.replaceState(null,'',location.pathname+(screen==='auth'?'#'+(this.state.authMode==='signup'?'signup':'login'):''));
    this.setState({screen,authError:'',notifOpen:false});window.scrollTo(0,0);}
  fmtT(t){return t?new Date(t).toLocaleString('fr-FR',{timeZone:this.ex.set.tz,day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}):'—';}
  async marketBars(symbol,tf,signal){
    if(symbol==='XAU'){const data=await this.session.request('gold',{query:{interval:this.interval(tf)},signal});return data;}
    if(['BTC','ETH','SOL'].includes(symbol)){
      const bars=await CoinbaseMarket.history(this.interval(tf),signal,this.SYM[symbol].label.replace('/','-'));
      return{bars,source:'Coinbase · '+this.SYM[symbol].label,fetchedAt:Date.now()};}
    return this.session.request('market',{query:{symbol,interval:this.interval(tf)},signal});
  }
  interval(tf=this.state.tf){return {'1m':'1min','5m':'5min','15m':'15min','30m':'30min','1h':'1h'}[tf];}
  async load(silent=false){if(!this.session.user)return;const {symbol,tf,demo}=this.state;if(this.rp&&silent)return;
    const serial=++this.marketSerial,epoch=this.session.epoch;this.marketAbort?.abort();this.marketAbort=new AbortController();if(!silent)this.setState({loading:true});
    try{const data=demo?{bars:this.simBars(),source:'Démonstration · données simulées',fetchedAt:Date.now()}:await this.marketBars(symbol,tf,this.marketAbort.signal);
      if(serial!==this.marketSerial||epoch!==this.session.epoch||symbol!==this.state.symbol||tf!==this.state.tf)return;
      const bars=data.bars?.filter(b=>[b.time,b.open,b.high,b.low,b.close].every(Number.isFinite)&&b.low<=Math.min(b.open,b.close)&&b.high>=Math.max(b.open,b.close));
      if(!bars?.length)throw Error('invalid_market_data');
      this.setState({feedErr:false,lastFetch:data.fetchedAt||Date.now()});this.setBars(bars,data.source);
    }catch(error){if(serial!==this.marketSerial||epoch!==this.session.epoch||error.name==='AbortError')return;
      this.setState({loading:false,feedErr:true,source:this.state.bars.length?this.state.source+' · flux interrompu':'Flux indisponible · aucune donnée simulée',notice:'Le flux '+this.SYM[symbol].label+' est indisponible. Réessayez ou choisissez le mode Démonstration.'});}}
  async tickPrice(){if(!this.session.user||this.state.symbol!=='XAU'||this.state.demo||this.rp||document.hidden||this.ticking||!this.state.bars.length)return;this.ticking=true;
    const serial=this.marketSerial,epoch=this.session.epoch;try{const tick=await this.session.request('gold/price');
      if(serial!==this.marketSerial||epoch!==this.session.epoch||this.state.symbol!=='XAU'||this.rp||!Number.isFinite(tick.price))return;
      GoldLive.add({...tick,time:tick.time||tick.receivedAt,receivedAt:tick.receivedAt||Date.now()});const bars=GoldLive.merge(this.state.bars,this.interval(),this.state.lastFetch||0);
      this.setState({lastFetch:tick.receivedAt||Date.now(),feedErr:false});this.setBars(bars,tick.source||this.state.source);
    }catch{}finally{this.ticking=false;}}
  setBars(bars,source){const duration=this.TFMS[this.state.tf];const closed=bars.filter(b=>b.closed!==false&&b.time+duration<=Date.now());
    this.model=this.analyze(closed);if(this.ex.set.sessionFilter){this.model.plans=this.model.plans.filter(p=>this.inSession(p.time));this.model.signals=this.model.signals.filter(p=>this.inSession(p.time));this.model.plan=this.model.plans.at(-1)||null;}
    this.perf=this.state.symbol==='XAU'&&this.state.tf==='5m'?this.perfCalc(this.model.plans,closed):null;
    this.computeStruct(closed);this.computeExtra(closed);
    if(!this.state.feedErr&&!this.rp&&!this.state.demo){
      const snapshot=PIPVORIA_CORE.watchSnapshot({bars,model:this.state.ind.planner?this.plannerM:{trades:[],sides:[],active:null},blh:this.state.ind.plan?this.model:null,previousSignal:this.lastSignal,symbol:this.SYM[this.state.symbol].label,interval:this.interval(),source:source??this.state.source,receivedAt:this.state.lastFetch});
      this.lastSignal=snapshot.signal;
      snapshot.stale=Date.now()-this.state.lastFetch>30000;
      if(!snapshot.stale)for(const event of this.signalTracker.update(snapshot,{confirmedOnly:this.ex.set.confirmed}))this.storeAlert(event);
    }
    this.setState({bars,loading:false,source:source??this.state.source});
  }
  analyze(bars){const model=BlhClean.analyze(bars,this.blhOptions());if(this.state.symbol!=='XAU'||this.state.tf!=='5m')return {...model,signals:[],plans:[],plan:null,structure:null,zone:null};return model;}
  enginePrefs(){return this.settings.marketProfiles[this.SYM[this.state.symbol].label+'|'+this.interval()]||this.settings.indicators;}
  blhOptions(){const p=this.enginePrefs(),n=(key,d)=>Number(p[key]??d);return{swing:n('blh-swing',4),atrLength:n('blh-atr',14),emaLength:n('blh-ema-length',50),sweepWindow:n('blh-sweep',5),zoneBars:n('blh-zone-bars',30),rr:[1,2,3].map((d,i)=>n('blh-rr'+(i+1),d))};}
  analyzeStructure(bars,opts){return StructureEngine.analyze(bars,{...opts,onlyValid:this.enginePrefs().valid===true});}
  computeStruct(bars=this.state.bars.filter(b=>b.closed!==false&&b.time+this.TFMS[this.state.tf]<=Date.now())){this.struct=this.analyzeStructure(bars,this.state.ms);this.msPerf=PIPVORIA_INDICATOR_PERFORMANCE.structureSummary(this.struct,bars);}
  computeExtra(bars){const preferences=this.enginePrefs();this.plannerM=SmartEngine.analyze(bars,{preferences,rr:[.5,1,1.5].map((d,i)=>Number(preferences['smart-tp'+(i+1)]??d))});this.plannerPerf={...PIPVORIA_INDICATOR_PERFORMANCE.summary(this.plannerM.trades,{signals:this.plannerM.signals.length,active:this.plannerM.active?1:0}),ops:[],trades:this.plannerM.trades};
    this.paM=PALiquidity.analyze(bars);this.paPerf=this.perfCalc(this.paM.plans.map(p=>({...p,tps:[p.target,p.target,p.target]})),bars);this.heat=HeatmapEngine.analyze(bars);}
  async loadMtf(){if(!this.session.user||this.ex.mtfLoading)return;const symbol=this.state.symbol,epoch=this.session.epoch;this.setEx({mtfLoading:true});const mtf={};
    await Promise.allSettled(['1m','5m','15m','30m','1h'].map(async tf=>{const data=await this.marketBars(symbol,tf);const bars=data.bars.filter(b=>b.closed!==false&&b.time+this.TFMS[tf]<=Date.now());const m=BlhClean.analyze(bars,this.blhOptions());if(symbol!=='XAU'||tf!=='5m'){m.signals=[];m.plans=[];}mtf[tf]={m,perf:this.perfCalc(m.plans,bars),close:bars.at(-1)?.close};}));
    if(epoch!==this.session.epoch)return;this.setEx({mtf,mtfSym:symbol===this.state.symbol?symbol:null,mtfLoading:false});}
  async loadWatch(){if(!this.session.user)return;const epoch=this.session.epoch;
    await Promise.allSettled(Object.keys(this.SYM).map(async symbol=>{if(symbol===this.state.symbol&&this.state.bars.length){this.wl[symbol]={price:this.state.bars.at(-1).close,source:this.state.source};return;}
      try{let price,source;if(['BTC','ETH','SOL'].includes(symbol)){const r=await fetch('https://api.exchange.coinbase.com/products/'+this.SYM[symbol].label.replace('/','-')+'/stats');if(!r.ok)throw Error();const j=await r.json();price=+j.last;source='Coinbase · 24 h';if(epoch===this.session.epoch)this.wl[symbol]={price,chg:100*(price/+j.open-1),source};}
      else if(symbol==='XAU'){const t=await this.session.request('gold/price');if(epoch===this.session.epoch)this.wl[symbol]={price:t.price,source:t.source};}
      else{const d=await this.marketBars(symbol,'1h');if(epoch===this.session.epoch)this.wl[symbol]={price:d.bars.at(-1)?.close,source:d.source};}
    }catch{if(epoch===this.session.epoch)this.wl[symbol]={source:'Flux indisponible'};}}));if(epoch===this.session.epoch)this.forceUpdate();}
  loadPrices(){} // No client-side payment conversion or mock payment confirmation.
  async loadCapabilities(){try{this.capabilities=await this.session.request('terminal/capabilities');this.forceUpdate();}catch{this.capabilities={};}}
  async loadSettings(){try{const data=await this.session.request('settings');this.settings=PIPVORIA_CORE.settings(data.settings);this.settingsRevision=data.revision;this.settingsReady=true;this.applySettings();}catch{this.ex.setMsg='Réglages indisponibles. Réessayez avant de modifier.';}}
  applySettings(){const v=this.settings,t=v.terminal;this.lines=t.drawings||{};
    Object.assign(this.ex.set,{tz:v.timezone,contract:String(v.contract),lotStep:String(v.lotStep),risk:String(v.risk.percent),confirmed:v.confirmedOnly,sessions:t.sessions,sessionFilter:t.sessionFilter,avoid:t.avoid,maxLossDay:t.maxLossDay??'',maxTradesDay:t.maxTradesDay??'',goalR:t.goalR??'',monthlyMail:t.monthlyReminder});
    this.ex.calc.capital=String(v.risk.balance);this.ex.calc.risk=String(v.risk.percent);
    const p=v.marketProfiles[this.SYM[this.state.symbol].label+'|'+this.interval()]||v.indicators;
    const ind={...this.state.ind};for(const [key,id] of Object.entries({ema:'blh-ema',zone:'blh-zones',plan:'show-blh-clean',structure:'blh-structure',planner:'show-smart',pa:'show-pa-liquidity',heat:'show-heatmap',heatProfile:'heat-profile'}))if(typeof p[id]==='boolean')ind[key]=p[id];
    const ms={...this.state.ms,on:p['show-structure']!==false,fib:p['show-fib']!==false,term:['Short','Mid','Long'].includes(p.term)?p.term:'Mid',rr:Number(p.rr)||2};
    this.setState({lang:t.language,prefSound:t.sound,ind,ms});}
  captureSettings(){const v=this.settings,s=this.ex.set,p={...v.indicators};
    for(const [key,id] of Object.entries({ema:'blh-ema',zone:'blh-zones',plan:'show-blh-clean',structure:'blh-structure',planner:'show-smart',pa:'show-pa-liquidity',heat:'show-heatmap',heatProfile:'heat-profile'}))p[id]=this.state.ind[key];
    Object.assign(p,{'show-structure':this.state.ms.on,'show-fib':this.state.ms.fib,term:this.state.ms.term,rr:String(this.state.ms.rr)});
    return PIPVORIA_CORE.settings({...v,timezone:s.tz,confirmedOnly:s.confirmed,contract:Number(s.contract),lotStep:Number(s.lotStep),risk:{balance:Number(this.ex.calc.capital),percent:Number(s.risk)},indicators:p,
      marketProfiles:{...v.marketProfiles,[this.SYM[this.state.symbol].label+'|'+this.interval()]:p},terminal:{...v.terminal,language:this.state.lang,sound:this.state.prefSound,sessions:s.sessions,sessionFilter:s.sessionFilter,avoid:s.avoid,maxLossDay:s.maxLossDay,maxTradesDay:s.maxTradesDay,goalR:s.goalR,monthlyReminder:s.monthlyMail,drawings:this.lines}});}
  queueSettings(){if(!this.settingsReady||!this.session.user)return;this.settingsDirty=true;this.settingsSerial++;this.ex.setMsg='Enregistrement…';clearTimeout(this.settingsT);this.settingsT=setTimeout(()=>this.saveSettings(),650);}
  async saveSettings(){if(this.savingSettings||!this.settingsDirty||!this.session.user)return;this.savingSettings=true;const serial=this.settingsSerial,epoch=this.session.epoch,desired=this.captureSettings(),base=this.settings;
    try{const data=await this.session.request('settings',{body:{settings:desired,baseRevision:this.settingsRevision}});if(epoch!==this.session.epoch)return;this.settings=data.settings;this.settingsRevision=data.revision;this.settingsDirty=serial!==this.settingsSerial;this.ex.setMsg=this.settingsDirty?'Enregistrement…':'Réglages enregistrés sur votre compte.';
    }catch(error){if(epoch!==this.session.epoch)return;if(error.message==='settings_conflict'&&error.result?.settings){const current=this.captureSettings();this.settings=PIPVORIA_CORE.mergeSettings(error.result.settings,PIPVORIA_CORE.settingsDiff(base,current));this.settingsRevision=error.result.revision;this.applySettings();this.settingsDirty=true;this.ex.setMsg='Réglages actualisés ; nouvel enregistrement…';}else{this.settingsDirty=false;this.ex.setMsg='Échec de l’enregistrement. Vos changements restent ouverts ; cliquez sur Réessayer.';}}
    finally{this.savingSettings=false;this.forceUpdate();if(this.settingsDirty&&this.session.user)this.settingsT=setTimeout(()=>this.saveSettings(),650);}}
  setSet(p,msg){if(!this.settingsReady)return;this.ex.undo.push(structuredClone(this.ex.set));Object.assign(this.ex.set,p);this.ex.setMsg=msg||'';this.queueSettings();if(this.state.bars.length)this.setBars(this.state.bars);this.forceUpdate();}
  saveLines(){this.queueSettings();this.draw();}
  setMs(p){this.setState(s=>({ms:{...s.ms,...p}}),()=>{this.computeStruct();this.queueSettings();});}
  setSymbol(symbol){if(!this.SYM[symbol]||symbol===this.state.symbol)return;this.endReplay(true);this.marketSerial++;this.model=null;this.perf=null;this.biz.sigSeen={};this.view=this.initialView();this.setState({symbol,bars:[],source:'',lastFetch:null,notice:''},()=>{this.applySettings();this.load();});}
  async loadWorkspace(){try{const data=await this.session.request('workspace');this.journal=data.journal||[];this.notifications=data.notifications||[];this.preferences=data.preferences||{};this.setState({prefSignals:this.preferences.new_signal!==false});}catch{this.setState({notice:'Votre journal est temporairement indisponible. Réessayez.'});}}
  async registerPlan(){const p=this.model?.plan;if(!p||this.state.demo||this.rp)return;const id=crypto.randomUUID(),now=Date.now();const risk=PIPVORIA_CORE.risk({balance:this.ex.calc.capital,riskPercent:this.ex.set.risk,entry:p.entry,stop:p.stop,contract:this.ex.set.contract,lotStep:this.ex.set.lotStep});
    const payload={symbol:this.SYM[this.state.symbol].label,interval:this.interval(),strategy:'blh',status:'planned',direction:p.direction===1?'buy':'sell',entry:p.entry,stopLoss:p.stop,takeProfits:p.tps,targetHits:[false,false,false],createdAt:now,clientUpdatedAt:now,riskPercent:Number(this.ex.set.risk),positionSize:risk.valid?risk.positionSize:null,source:this.state.source,notes:''};
    this.journalDrafts.set(id,{payload,id,kind:'trade',create:true});await this.saveJournal(id);}
  async saveJournal(id){const draft=this.journalDrafts.get(id);if(!draft||draft.saving)return;if(draft.payload.resultR!=null&&(!Number.isFinite(Number(draft.payload.resultR))||Math.abs(Number(draft.payload.resultR))>1000)){this.setState({notice:'Indiquez un résultat numérique entre −1 000 et 1 000 R.'});return;}draft.saving=true;const epoch=this.session.epoch;
    try{const result=await this.session.request(draft.create?'journal/create':'journal/update',{query:draft.create?{}:{id},body:{id,kind:draft.kind||'trade',payload:draft.payload,baseUpdatedAt:draft.baseUpdatedAt}});
      if(epoch!==this.session.epoch)return;this.journal=this.journal.filter(r=>r.id!==id);this.journal.unshift(result.entry);this.journalDrafts.delete(id);this.setState({notice:'Journal enregistré.'});
    }catch(error){if(epoch!==this.session.epoch)return;draft.saving=false;draft.conflict=error.message==='journal_conflict';this.setState({notice:draft.conflict?'Ce trade a été modifié ailleurs. Rechargez le journal avant de réessayer.':'Enregistrement échoué. Votre brouillon est conservé ; cliquez sur Réessayer.'});}this.forceUpdate();}
  changeJournal(row,patch){const draft=this.journalDrafts.get(row.id)||{id:row.id,kind:row.kind,payload:{...row.payload},baseUpdatedAt:row.updated_at};Object.assign(draft.payload,patch,{clientUpdatedAt:Date.now()});this.journalDrafts.set(row.id,draft);this.forceUpdate();}
  async savePreferences(patch){const before={...this.preferences};Object.assign(this.preferences,patch);try{const data=await this.session.request('preferences',{body:this.preferences});this.preferences=data.preferences||this.preferences;}catch{this.preferences=before;this.setState({prefSignals:before.new_signal!==false,notice:'Préférence non enregistrée. Réessayez.'});}}
  async storeAlert(detail){const event=detail.event,pref=event==='new'?'new_signal':event==='entry'?'entry_zone':event.startsWith('tp')?'target_hit':event==='stop'?'stop_loss':'signal_updates';
    if(this.preferences[pref]===false||pref==='new_signal'&&!this.state.prefSignals||pref==='signal_updates'&&this.preferences.signal_updates!==true||this.notifications.some(n=>n.signal_key===detail.eventKey))return;
    const title=(event==='entry'?'Entrée':event==='new'?'Nouveau signal':event==='stop'?'Stop loss':event.toUpperCase())+' · '+detail.symbol;
    const body=detail.interval+' · '+detail.direction.toUpperCase()+' · ENTRY '+detail.entry+' · SL '+detail.stopLoss;
    this.pushToast({title,body,levels:'',color:event==='stop'?'#f2707a':'#9d8cff'});
    const notification={id:crypto.randomUUID(),created_at:new Date().toISOString(),title,body,signal_key:detail.eventKey,is_read:false,metadata:detail};this.notifications.unshift(notification);
    try{await this.session.request('notifications/create',{body:{id:notification.id,title,body,signalKey:detail.eventKey,metadata:detail}});}catch{notification.pending=true;}this.forceUpdate();}
  signalToast(name,sg,plan){if(this.rp||this.state.demo||this.state.feedErr||Date.now()-this.state.lastFetch>30000||sg.time+this.TFMS[this.state.tf]<Date.now()-this.TFMS[this.state.tf])return;
    super.signalToast(name,sg,plan);const toast=this.biz.toasts[0];if(!toast)return;const key=[this.state.symbol,this.state.tf,name,sg.time,sg.direction].join('|');
    this.session.request('notifications/create',{body:{id:crypto.randomUUID(),title:toast.title,body:toast.body+' '+toast.levels,signalKey:key,metadata:{symbol:this.SYM[this.state.symbol].label,interval:this.interval(),entry:plan?.entry,stopLoss:plan?.stop,takeProfits:plan?.tps}}}).then(data=>{if(data.notification)this.notifications.unshift(data.notification);this.forceUpdate();}).catch(()=>{});}
  async loadAdmin(){if(!this.session.user?.isAdmin)return;const epoch=this.session.epoch,serial=this.adminSerial=(this.adminSerial||0)+1;this.adminLoading=true;this.forceUpdate();
    try{const data=await this.session.request('admin/users');if(epoch!==this.session.epoch||serial!==this.adminSerial||!this.session.user?.isAdmin)return;this.ex.users=data.users||[];this.adminAudit=data.audit||[];this.adminError='';}
    catch{if(epoch===this.session.epoch&&serial===this.adminSerial)this.adminError='Demandes indisponibles. Cliquez sur Actualiser pour réessayer.';}
    finally{if(epoch===this.session.epoch&&serial===this.adminSerial){this.adminLoading=false;this.forceUpdate();}}}
  confirmRejection(user){if(this.adminRejectId===user.id)return this.adminAction(user,'reject');this.adminRejectId=user.id;this.forceUpdate();}
  async adminAction(user,action){if(!this.session.user?.isAdmin||this.adminBusy)return;if(['ban','unban'].includes(action)&&!confirm((action==='ban'?'Suspendre':'Réactiver')+' le compte '+user.email+' ?'))return;
    if(action==='delete'&&(user.isAdmin||prompt('Pour supprimer le compte '+user.email+', écrivez SUPPRIMER.')!=='SUPPRIMER'))return;
    const epoch=this.session.epoch;this.adminBusy=user.id;this.adminRejectId=null;this.adminSerial=(this.adminSerial||0)+1;this.adminLoading=false;this.forceUpdate();
    try{await this.session.request('admin/user-action',{body:{userId:user.id,action,...(['approve','reject'].includes(action)?{baseUpdatedAt:user.updatedAt}:{})}});if(epoch!==this.session.epoch)return;await this.loadAdmin();this.setState({notice:action==='approve'?'Compte accepté. La connexion est maintenant autorisée.':action==='reject'?'Demande refusée. L’accès reste bloqué.':action==='recovery'?'Lien de récupération envoyé.':'Compte mis à jour.'});}
    catch(error){if(epoch===this.session.epoch){if(error.message==='approval_conflict')await this.loadAdmin();this.setState({notice:error.message==='approval_conflict'?'Cette demande a déjà été modifiée. La liste a été actualisée.':'Action non enregistrée. Réessayez.'});}}
    finally{if(epoch===this.session.epoch){this.adminBusy=null;this.forceUpdate();}}}
  supportRoute(suffix){return(this.session.user?.isAdmin&&this.sup.admin?'admin/':'')+'support/'+suffix;}
  async loadTickets(silent=false,append=false){if(!this.session.user||this.sup.loading)return;this.sup.loading=true;
    try{const data=await this.session.request(this.supportRoute('tickets'),{query:{offset:append?this.sup.tickets.length:0}});
      this.sup.configured=data.configured===true;if(data.configured){const prior=new Map(this.sup.tickets.map(t=>[t.id,t]));const incoming=data.tickets.map(t=>({...prior.get(t.id),...t}));this.sup.tickets=append?[...this.sup.tickets,...incoming]:incoming;this.sup.hasMore=data.hasMore;if(this.sup.cur)await this.openTicket(this.sup.cur,true);}
      else if(this.sup.admin){const legacy=await this.session.request('admin/support/inbox',{query:{offset:append?this.sup.tickets.length:0}});const incoming=(legacy.threads||[]).map(t=>({...t,id:'legacy:'+t.userId,reference:t.name||'Conversation initiale',subject:'Support existant',status:'open',legacy:true}));this.sup.tickets=append?[...this.sup.tickets,...incoming]:incoming;this.sup.hasMore=legacy.hasMore;if(this.sup.cur)await this.openTicket(this.sup.cur,true);}
      else{const legacy=await this.session.request('support/messages');this.sup.tickets=(legacy.messages||[]).length?[{id:'legacy',reference:'Conversation initiale',subject:'Support existant',status:'open',msgs:legacy.messages,legacy:true}]:[];this.sup.hasMore=false;this.sup.older=legacy.hasMore;}
      this.sup.error=data.configured?'':'La création de tickets attend l’activation de la base de données.';
    }catch{if(!silent)this.sup.error='Support indisponible. Réessayez.';}finally{this.sup.loading=false;this.forceUpdate();}}
  async openTicket(id,silent=false){try{const legacy=id==='legacy'||id.startsWith('legacy:');const data=await this.session.request(this.supportRoute(legacy?'messages':'ticket/messages'),{query:legacy?(this.sup.admin?{userId:id.slice(7)}:{}):{ticketId:id}});
      const prior=this.sup.tickets.find(t=>t.id===id);if(prior){const msgs=silent?[...new Map([...(prior.msgs||[]),...data.messages].map(m=>[m.id,m])).values()].sort((a,b)=>a.seq-b.seq):data.messages;Object.assign(prior,data.ticket,{msgs});}this.sup.cur=id;this.sup.composing=false;if(!silent)this.sup.older=data.hasMore;
      if(!silent)this.sup.reply=this.sup.drafts?.[id]||'';this.forceUpdate();}catch{this.sup.error='Impossible d’ouvrir ce ticket.';this.forceUpdate();}}
  async olderMessages(){const cur=this.sup.tickets.find(t=>t.id===this.sup.cur),first=cur?.msgs?.[0];if(!first?.seq)return;
    try{const data=await this.session.request(this.supportRoute(cur.legacy?'messages':'ticket/messages'),{query:{...(cur.legacy?(this.sup.admin?{userId:cur.userId}:{}):{ticketId:cur.id}),before:first.seq}});cur.msgs=[...data.messages,...cur.msgs];this.sup.older=data.hasMore;this.forceUpdate();}catch{this.sup.error='Historique indisponible.';this.forceUpdate();}}
  async sendTicket(create=false){const S=this.sup;if(S.busy||create&&(S.admin||!S.configured))return;const text=(create?S.draft.body:S.reply).trim(),subject='['+S.draft.cat+'] '+S.draft.subject.trim(),cur=S.tickets.find(t=>t.id===S.cur);
    if(!text||text.length>2000||create&&(S.draft.subject.trim().length<3||subject.length>100)){S.error='Sujet : au moins 3 caractères, 100 avec la catégorie. Message : 1 à 2 000 caractères.';this.forceUpdate();return;}
    const key=create?'create':S.cur;let pending=this.pendingMessages.get(key);if(!pending||pending.text!==text||pending.subject!==(create?subject:undefined)){pending={ticketId:create?crypto.randomUUID():S.cur,id:crypto.randomUUID(),text,...(create?{subject}: {})};this.pendingMessages.set(key,pending);}
    S.busy=true;S.error='';this.forceUpdate();try{
      if(cur?.legacy){await this.session.request(this.supportRoute('send'),{body:{id:pending.id,text,...(S.admin?{userId:cur.userId}:{})}});S.reply='';await this.openTicket(cur.id,true);if(S.drafts)S.drafts[S.cur]='';}
      else{const data=await this.session.request(this.supportRoute(create?'ticket/create':'ticket/send'),{body:pending});if(create)S.tickets.unshift({...data.ticket,msgs:[data.message]});else if(cur)Object.assign(cur,data.ticket,{msgs:[...(cur.msgs||[]).filter(m=>m.id!==data.message.id),data.message]});S.cur=data.ticket.id;S.reply='';S.composing=false;S.draft={cat:'Bot / signaux',subject:'',body:''};if(S.drafts)S.drafts[S.cur]='';}
      this.pendingMessages.delete(key);
    }catch(error){S.error=error.status===429?'Trop de demandes. Réessayez dans un instant.':'Envoi échoué. Votre texte est conservé ; réessayez.';}finally{S.busy=false;this.forceUpdate();}}
  async ticketStatus(){const cur=this.sup.tickets.find(t=>t.id===this.sup.cur);if(!cur||cur.legacy||this.sup.busy)return;this.sup.busy=true;
    try{const result=await this.session.request(this.supportRoute('ticket/status'),{body:{ticketId:cur.id,status:cur.status==='resolved'?'open':'resolved',updatedAt:cur.updatedAt}});Object.assign(cur,result.ticket);this.sup.error='';}
    catch(error){this.sup.error=error.status===409?'Ticket modifié ailleurs. Actualisez avant de réessayer.':'Statut non enregistré.';}finally{this.sup.busy=false;this.forceUpdate();}}
  supportVals(){const S=this.sup,cur=S.tickets.find(t=>t.id===S.cur),status=t=>({open:'Ouvert',in_progress:'En cours',resolved:'Résolu'}[t.status]||'Ouvert');
    return{isSupport:this.state.appTab==='support',composing:S.composing,viewing:!S.composing&&!!cur,typing:false,supportBusy:S.busy,supportError:S.error,supportConfigured:S.configured,hasMoreTickets:S.hasMore,olderMessages:S.older,
      refreshTickets:()=>this.loadTickets(),loadMoreTickets:()=>this.loadTickets(false,true),loadOlder:()=>this.olderMessages(),backTickets:()=>this.setSup({cur:null,composing:false}),
      tickets:S.tickets.map(t=>({id:t.reference||t.id,cat:t.name||'Support',subject:t.subject,last:this.fmtT(t.lastMessageAt||t.createdAt),status:status(t),stBg:t.status==='resolved'?'#1a2030':'#0f2620',stColor:t.status==='resolved'?'#8d93a8':'#3fd2a4',bg:t.id===S.cur?'#18152e':'#11151f',border:t.id===S.cur?'#9d8cff':'#1f2536',select:()=>this.openTicket(t.id)})),
      cur:cur?{id:cur.reference||cur.id,cat:cur.name||'Support',subject:cur.subject,msgs:(cur.msgs||[]).map(m=>{const me=this.sup.admin?m.role==='admin':m.role==='customer';return{text:m.text||m.body,time:this.fmtT(m.createdAt||m.created_at),who:me?'Vous':m.role==='admin'?'Support Pipvoria':'Client',align:me?'flex-end':'flex-start',textAlign:me?'right':'left',bg:me?'#9d8cff':'#1a2030',color:me?'#0a0d16':'#e9ebf2'};})}:{msgs:[]},
      curClosed:cur?.status==='resolved',closeLabel:cur?.status==='resolved'?'Rouvrir':'Marquer résolu',toggleClose:()=>this.ticketStatus(),replyPh:cur?.status==='resolved'?'Ticket résolu — rouvrez-le pour répondre':'Écrire un message…',reply:S.reply,
      onReply:e=>{S.drafts||={};S.drafts[S.cur]=e.target.value;this.setSup({reply:e.target.value});},onReplyKey:e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();this.sendTicket();}},sendReply:()=>this.sendTicket(),
      newTicket:()=>{if(S.configured&&!S.admin)this.setSup({composing:true,cur:null});},cancelTicket:()=>this.setSup({composing:false}),draftCat:S.draft.cat,draftSubject:S.draft.subject,draftBody:S.draft.body,
      onDraftCat:e=>this.setSup({draft:{...S.draft,cat:e.target.value}}),onDraftSubject:e=>this.setSup({draft:{...S.draft,subject:e.target.value}}),onDraftBody:e=>this.setSup({draft:{...S.draft,body:e.target.value}}),submitTicket:()=>this.sendTicket(true)};}
  savedRows(){return this.journal.map(row=>({...row,...row.payload,createdAt:Date.parse(row.created_at),updatedAt:Date.parse(row.updated_at)}));}
  monthlyReminder(){if(!this.session.user||!this.settings.terminal.monthlyReminder)return;const key=PIPVORIA_CORE.dateKey(Date.now(),this.ex.set.tz).slice(0,7),storageKey='pipvoria-report-reminder:'+this.session.user.id;try{if(localStorage.getItem(storageKey)===key)return;localStorage.setItem(storageKey,key);}catch{return;}this.setState({notice:'Votre rapport mensuel est disponible dans Journal → Rapport mensuel. Le rappel s’affiche une fois par mois à votre connexion.'});}
  report(){const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    const month=PIPVORIA_CORE.dateKey(Date.now(),this.ex.set.tz).slice(0,7),rows=this.savedRows().filter(r=>r.closedAt&&PIPVORIA_CORE.dateKey(r.closedAt,this.ex.set.tz).startsWith(month));
    const stat=PIPVORIA_CORE.summary(rows,{timezone:this.ex.set.tz});
    this.openPrint('Pipvoria · Rapport '+month,'<h1>Journal · '+esc(month)+'</h1><p>'+esc(this.session.user?.name)+' · '+esc(this.ex.set.tz)+'</p><p>Trades clôturés : '+stat.closed+' · Gagnants : '+stat.wins+' · Perdants : '+stat.losses+' · Net : '+(stat.netR??'—')+' R</p><table><tr><th>Date</th><th>Marché</th><th>Sens</th><th>R</th><th>Note</th></tr>'+rows.map(r=>'<tr><td>'+esc(this.fmtT(r.closedAt))+'</td><td>'+esc(r.symbol)+'</td><td>'+esc(r.direction)+'</td><td>'+esc(r.resultR)+'</td><td>'+esc(r.notes)+'</td></tr>').join('')+'</table><p>Journal personnel. Les résultats d’indicateurs sont des simulations distinctes.</p>');}
  renderVals(){const v=super.renderVals(),s=this.state,user=this.session?.user,rows=this.savedRows(),tz=this.ex.set.tz;
    const period=this.ex.jRange==='day'?'today':this.ex.jRange==='7d'?'week':'all',stat=PIPVORIA_CORE.summary(rows,{period,timezone:tz});
    const f=n=>Number.isFinite(Number(n))&&n!==null&&n!==''?Number(n).toFixed(this.dp()):'—',closed=['win','loss','breakeven'],stateName={planned:'Planifié',active:'En cours',win:'Gagnant',loss:'Perdant',breakeven:'Break-even',cancelled:'Annulé',snapshot:'Observation'},col=r=>r.direction==='buy'?'#3fd2a4':'#f2707a';
    const selected=rows.filter(r=>PIPVORIA_CORE.periodContains(closed.includes(r.status)?PIPVORIA_CORE.closeTime(r):r.createdAt,period,tz));
    const positions=rows.filter(r=>r.kind==='trade'&&(this.ex.fStatus==='all'||(this.ex.fStatus==='open'?['planned','active'].includes(r.status):closed.includes(r.status)))&&(this.ex.fDir==='all'||(this.ex.fDir==='1'?r.direction==='buy':r.direction==='sell')));
    const notice=msg=>this.setState({notice:msg});const pending=label=>()=>notice(label+' : activation du service requise.');
    const goal=Number(this.ex.set.goalR)||null;
    Object.assign(v,{authFormVisible:!s.approvalStatus,waitingApproval:!!s.approvalStatus,approvalTitle:s.approvalStatus==='rejected'?'Demande refusée':'Compte en attente de validation',approvalMessage:s.approvalStatus==='rejected'?'Votre demande a été refusée par l’administrateur. L’accès au terminal reste bloqué.':'Votre demande apparaît dans le dashboard super admin. Vous pourrez vous connecter après son acceptation.',approvalEmailConfirmation:s.approvalEmailConfirmation,backToLogin:()=>this.openAuth('login'),isLanding:s.screen==='landing',goLanding:()=>this.go('landing'),goLogin:()=>this.openAuth('login'),goSignup:()=>this.openAuth('signup'),landingError:s.authBusy?'':s.authError});
    const chosen=s.resultsOf==='blh'?this.perf:s.resultsOf==='ms'?this.msPerf:s.resultsOf==='planner'?this.plannerPerf:this.paPerf;
    Object.assign(v,{authBusy:s.authBusy,isAuth:s.screen==='auth',isSignup:s.authMode==='signup',authTitle:s.authMode==='recover'?'Réinitialiser le mot de passe':s.authMode==='reset'?'Nouveau mot de passe':s.authMode==='signup'?'Créer votre compte':'Bon retour',authCta:s.authBusy?'Vérification…':s.authMode==='recover'?'Envoyer le lien':s.authMode==='reset'?'Mettre à jour':s.authMode==='signup'?'Créer le compte':'Se connecter',submitAuth:()=>this.submitAuth(),forgotPassword:()=>this.setState({authMode:'recover',authError:'',password:''}),recoverMode:s.authMode==='recover',logoutPending:this.session?.pendingLogout,retryLogout:()=>this.logout(),financeUnavailable:true,supportUnavailable:this.sup.configured!==true||this.sup.admin===true,supportBusy:this.sup.busy,cannotRegisterPlan:!this.model?.plan||s.demo||!!this.rp,
      mobileToolHint:this.rp?'Replay : avancez bougie par bougie.':s.tool==='cursor'?'Glissez horizontalement pour parcourir. Boutons + / − pour zoomer.':s.tool==='hline'?'Touchez le graphique pour placer une ligne.':s.tool==='text'?'Touchez le graphique pour ajouter du texte.':'Touchez deux points du graphique pour tracer.',mobileResultsOpen:s.mobileResultsOpen,mobileResultsLabel:s.mobileResultsOpen?'Réduire':'Afficher',toggleMobileResults:()=>this.setState({mobileResultsOpen:!s.mobileResultsOpen}),mobileSecondaryActive:['calendar','history'].includes(s.appTab),goCalendar:()=>this.navigate('calendar'),goHistory:()=>this.navigate('history'),supportDetailVisible:this.sup.composing||this.sup.tickets.some(t=>t.id===this.sup.cur),notice:s.notice,clearNotice:()=>notice(''),retryFeed:()=>this.load(),refreshWorkspace:()=>this.loadWorkspace(),retrySettings:()=>{this.settingsReady?this.queueSettings():this.loadSettings();},
      accountBadge:user?.isAdmin?'ADMIN · ACTIF':user?'ACTIF':'CONNEXION',isAdminUser:user?.isAdmin===true,
      goProfile:()=>this.navigate('profile'),goAdmin:()=>this.navigate('admin'),backProfile:()=>this.navigate('profile'),logout:()=>this.logout(),displayEmail:user?.email||s.email,displayName:user?.name||s.name,
      nav:[['trader','Trader'],['positions','Positions'],['journal','Journal'],['calendar','Calendrier'],['history','Historique'],['support','Support'],['profile','Plus']].map(([k,label])=>({label,secondary:['calendar','history'].includes(k),more:k==='profile',current:s.appTab===k?'page':'false',select:()=>{if(k==='support'&&this.sup.admin){this.sup.admin=false;this.sup.cur=null;this.sup.tickets=[];this.loadTickets();}this.navigate(k);},bg:s.appTab===k?'#221f3d':'transparent',color:s.appTab===k?'#c9bfff':'#8d93a8',dot:s.appTab===k?'#9d8cff':'#3a4157'})),
      watch:v.watch.map((w,i)=>({...w,src:this.wl[Object.keys(this.SYM)[i]]?.source||'Flux non reçu'})),
      stateLabel:s.loading?'Calcul…':s.resultsOf==='blh'&&(s.symbol!=='XAU'||s.tf!=='5m')?'XAU/USD · 5 min uniquement':s.feedErr?'Flux indisponible':chosen?'Calculé':'Indisponible',
      goalLabel:goal?'+'+goal+' R':'À définir',progressLabel:goal&&chosen?v.netR+' / +'+goal+' R':'Objectif à définir',progressPct:goal&&chosen?Math.max(0,Math.min(100,chosen.netR/goal*100))+'%':'0%',
      onTf:e=>{this.endReplay(true);this.view=this.initialView();this.setState({tf:e.target.value,bars:[],source:'',lastFetch:null,notice:''},()=>{this.applySettings();this.load();});},
      onLang:e=>this.setState({lang:e.target.value},()=>this.queueSettings()),
      onResultsOf:e=>this.setState({resultsOf:e.target.value}),
      indList:v.indList.map((item,i)=>({...item,toggle:()=>this.setState({ind:{...s.ind,[['ema','zone','plan','structure'][i]]:!s.ind[['ema','zone','plan','structure'][i]]}},()=>this.queueSettings())})),
      extraInd:v.extraInd.map((item,i)=>({...item,toggle:()=>this.setState({ind:{...s.ind,[['planner','pa','heat','heatProfile'][i]]:!s.ind[['planner','pa','heat','heatProfile'][i]]}},()=>this.queueSettings())})),
      prefs:[{label:'Alertes de nouveaux signaux',track:s.prefSignals?'#9d8cff':'#2a3145',justify:s.prefSignals?'flex-end':'flex-start',toggle:()=>{this.setState({prefSignals:!s.prefSignals});this.savePreferences({new_signal:!s.prefSignals});}},{label:'Son des alertes',track:s.prefSound?'#9d8cff':'#2a3145',justify:s.prefSound?'flex-end':'flex-start',toggle:()=>this.setState({prefSound:!s.prefSound},()=>this.queueSettings())}],
      notifList:this.notifications.slice(0,10).map(n=>({dir:n.title,color:'#9d8cff',symbol:n.body,time:this.fmtT(n.created_at)})),hasSignals:this.notifications.length>0,
      toggleNotif:()=>{this.setState({notifOpen:!s.notifOpen});if(!s.notifOpen)this.session.request('notifications/read',{body:{}}).catch(()=>{});},
      testAlert:()=>this.pushToast({title:'Alerte de test',body:this.SYM[s.symbol].label+' · '+s.tf,levels:'Test local',color:'#9d8cff'}),
      registerPlan:()=>this.registerPlan(),canRegisterPlan:!!this.model?.plan&&!s.demo&&!this.rp,workspacePending:this.journalDrafts.size>0,
      retryJournal:()=>{for(const [id,d]of this.journalDrafts)if(!d.conflict)this.saveJournal(id);},
      jStats:[['Trades clôturés',stat.closed,'#e9ebf2'],['Gagnants',stat.wins,'#3fd2a4'],['Perdants',stat.losses,'#f2707a'],['Break-even',stat.breakeven,'#c4c8d6'],['Résultat net',stat.netR===null?'—':stat.netR.toFixed(2)+' R','#9d8cff'],['Drawdown max',stat.drawdown===null?'—':stat.drawdown.toFixed(2)+' R','#e9ebf2']].map(([label,value,color])=>({label,value:String(value),color})),
      journal:selected.map(r=>{const d=this.journalDrafts.get(r.id)?.payload||r;return{dir:r.direction.toUpperCase(),color:col(r),symbol:r.symbol+' '+r.interval,time:this.fmtT(r.createdAt),entry:f(r.entry),stop:f(r.stopLoss),status:stateName[r.status],statusValue:d.status,onStatus:e=>this.changeJournal(r,{status:e.target.value,closedAt:closed.includes(e.target.value)?d.closedAt||Date.now():null}),autoR:r.resultR??'R',r:d.resultR??'',note:d.notes||'',onR:e=>this.changeJournal(r,{resultR:e.target.value===''?null:Number(e.target.value)}),onNote:e=>this.changeJournal(r,{notes:e.target.value}),save:()=>this.saveJournal(r.id),tps:(r.targetHits||[false,false,false]).map((hit,i)=>({label:'TP'+(i+1),bg:hit?'#0f2620':'transparent',color:hit?'#3fd2a4':'#8d93a8',border:hit?'#1f4a3f':'#2a3145',toggle:()=>{const hits=[...(this.journalDrafts.get(r.id)?.payload.targetHits||r.targetHits||[false,false,false])];hits[i]=!hits[i];this.changeJournal(r,{targetHits:hits});this.saveJournal(r.id);}}))};}),
      noJournal:selected.length===0,
      exportCsv:()=>{const cell=x=>'"'+String(x??'').replace(/^[=+@-]/,"'").replaceAll('"','""')+'"';const data=[['date','marché','sens','entrée','stop','TP1','TP2','TP3','statut','R','note'],...selected.map(r=>[new Date(r.createdAt).toISOString(),r.symbol,r.direction,r.entry,r.stopLoss,...(r.takeProfits||[]),r.status,r.resultR,r.notes])];this.download('pipvoria-journal.csv','\ufeff'+data.map(r=>r.map(cell).join(';')).join('\n'),'text/csv;charset=utf-8');},
      monthlyReport:()=>this.report(),printJournal:()=>this.report(),toggleMonthly:()=>{this.setSet({monthlyMail:!this.ex.set.monthlyMail});this.monthlyReminder();},
      positionsF:positions.map(r=>{const price=r.symbol===this.SYM[s.symbol].label?this.state.bars.at(-1)?.close:null,live=['active','planned'].includes(r.status),risk=Math.abs(r.entry-r.stopLoss),result=live&&Number.isFinite(price)&&risk>0?(r.direction==='buy'?1:-1)*(price-r.entry)/risk:r.resultR;return{dir:r.direction.toUpperCase(),color:col(r),symbol:r.symbol,time:this.fmtT(r.createdAt),entry:f(r.entry),price:live?f(price):stateName[r.status],stop:f(r.stopLoss),tps:(r.takeProfits||[]).map(f).join(' · '),r:result==null?'—':Number(result).toFixed(2)+' R',rColor:result>=0?'#3fd2a4':'#f2707a',rLabel:live?'P&L indicatif':'Résultat'};}),noPositionsF:positions.length===0,
      historyClosed:rows.filter(r=>closed.includes(r.status)).length,historyNetR:(PIPVORIA_CORE.summary(rows,{timezone:tz}).netR??'—')+' R',history:rows.filter(r=>closed.includes(r.status)).map(r=>({time:this.fmtT(r.createdAt),closed:this.fmtT(r.closedAt||r.updatedAt),dir:r.direction.toUpperCase(),color:col(r),entry:f(r.entry),exit:f(r.exitPrice),r:r.resultR===null?'—':r.resultR+' R',rColor:r.resultR>=0?'#3fd2a4':'#f2707a'})),noHistory:!rows.some(r=>closed.includes(r.status)),
      calendarLabel:'Horaires dans '+tz+' · calendrier vérifié le 2 octobre 2026',calendar:(this.capabilities?.calendar||[]).filter(e=>Date.parse(e.at)>=Date.now()-86400000).map(e=>({day:new Date(e.at).toLocaleDateString('fr-FR',{timeZone:tz,dateStyle:'full'}),events:[{time:new Date(e.at).toLocaleTimeString('fr-FR',{timeZone:tz,hour:'2-digit',minute:'2-digit'}),ccy:'USD',name:e.name,fc:'—',prev:'—',impact:'#f0b45b',url:e.url,source:e.source}]})),
      showExpiry:false,renewDate:'Non configurée',paidWith:'Aucun paiement enregistré',goPayment:pending('Paiement crypto'),planPrice:'—',promoOn:false,promoMsg:'Paiements non configurés.',promo:'',onPromo:()=>{},applyPromo:pending('Codes promotionnels'),startTrial:pending('Abonnement'),
      refLink:'Parrainage non activé',refCopyLabel:'Indisponible',copyRef:pending('Parrainage'),refWallet:'',onRefWallet:()=>{},withdrawRef:pending('Retraits'),refStats:[{label:'Filleuls',value:'—',color:'#8d93a8'},{label:'Commission',value:'—',color:'#8d93a8'},{label:'Retiré',value:'—',color:'#8d93a8'}],invoices:[],
      securityInfo:'Session sécurisée sur le serveur. Une seule connexion active par compte. La 2FA nécessite l’activation du service dédié.',tfaBadge:'Session sécurisée',tfaBadgeBg:'#0f2620',tfaBadgeColor:'#3fd2a4',tfaSetup:false,tfaBackupShow:false,tfaMsg:'',tfaBtn:'Demander l’activation de la 2FA',toggleTfa:()=>this.navigate('support'),
      undoSettings:()=>{const old=this.ex.undo.pop();if(old){this.ex.set=old;this.queueSettings();this.setBars(this.state.bars);}},
      exportSettings:()=>this.download('pipvoria-reglages.json',JSON.stringify(this.captureSettings(),null,2),'application/json'),importSettings:()=>this.importSettings(),
      adminPendingCount:this.ex.users.filter(u=>u.approvalStatus==='pending').length,adminMenuLabel:'Super admin'+(this.ex.users.some(u=>u.approvalStatus==='pending')?' · '+this.ex.users.filter(u=>u.approvalStatus==='pending').length+' en attente':''),adminLoading:this.adminLoading,adminActionsDisabled:!!this.adminBusy||!!this.adminLoading,adminError:this.adminError||'',
      adminRequests:this.ex.users.filter(u=>u.approvalStatus==='pending'&&!u.isAdmin).map(u=>({name:u.name,email:u.email,created:u.createdAt?this.fmtT(Date.parse(u.createdAt)):'—',emailStatus:u.emailConfirmedAt?'E-mail confirmé':'E-mail à confirmer',busy:!!this.adminBusy,confirmReject:this.adminRejectId===u.id,rejectLabel:this.adminRejectId===u.id?'Confirmer le refus':'Refuser',cancelReject:()=>{this.adminRejectId=null;this.forceUpdate();},approve:()=>this.adminAction(u,'approve'),reject:()=>this.confirmRejection(u)})),
      noAdminRequests:!this.ex.users.some(u=>u.approvalStatus==='pending')&&!this.adminLoading&&!this.adminError,
      adminKpis:[{label:'Utilisateurs',value:String(this.ex.users.length)},{label:'En attente',value:String(this.ex.users.filter(u=>u.approvalStatus==='pending').length)},{label:'Refusés',value:String(this.ex.users.filter(u=>u.approvalStatus==='rejected').length)},{label:'Suspendus',value:String(this.ex.users.filter(u=>u.bannedUntil&&Date.parse(u.bannedUntil)>Date.now()).length)}],adminPays:[],adminUsers:this.ex.users.map(u=>({name:u.name,email:u.email,until:u.createdAt?this.fmtT(Date.parse(u.createdAt)):'—',status:u.isAdmin?'Administrateur':u.approvalStatus==='pending'?'En attente':u.approvalStatus==='rejected'?'Refusé':u.bannedUntil&&Date.parse(u.bannedUntil)>Date.now()?'Suspendu':'Actif',stColor:u.approvalStatus==='pending'?'#f0b45b':u.approvalStatus==='rejected'||u.bannedUntil&&Date.parse(u.bannedUntil)>Date.now()?'#f2707a':'#3fd2a4',action:u.approvalStatus==='rejected'?'Accepter':u.bannedUntil&&Date.parse(u.bannedUntil)>Date.now()?'Réactiver':'Suspendre',protected:u.isAdmin||u.approvalStatus==='pending'||!!this.adminBusy,toggle:()=>this.adminAction(u,u.approvalStatus==='rejected'?'approve':u.bannedUntil&&Date.parse(u.bannedUntil)>Date.now()?'unban':'ban'),recover:()=>this.adminAction(u,'recovery'),remove:()=>this.adminAction(u,'delete')})),
      refreshAdmin:()=>this.loadAdmin(),
      adminSupport:()=>{this.sup.admin=true;this.sup.cur=null;this.sup.tickets=[];this.navigate('support');this.loadTickets();},
      faq:[{q:'Le bot passe-t-il des ordres ?',a:'Le site affiche des signaux et des plans. Aucun ordre n’est exécuté chez votre courtier.'},{q:'Comment sont calculés les résultats ?',a:'Les indicateurs utilisent les bougies clôturées. Les résultats du journal proviennent uniquement des trades enregistrés sur votre compte.'},{q:'Pourquoi un marché peut-il être indisponible ?',a:'Un problème de flux reste indiqué. Aucune donnée simulée ne remplace automatiquement le flux réel.'}]
    });
    const risk=PIPVORIA_CORE.risk({balance:this.ex.calc.capital,riskPercent:this.ex.calc.risk,entry:this.ex.calc.entry,stop:this.ex.calc.stop,contract:s.symbol==='XAU'?this.ex.set.contract:this.settings.btcContract,lotStep:s.symbol==='XAU'?this.ex.set.lotStep:this.settings.btcLotStep});
    v.calcOut=[{label:'Montant risqué',value:risk.valid?risk.riskAmount.toFixed(2)+' $':'—',color:'#f2707a'},{label:'Distance SL',value:risk.valid?f(risk.distance):'—',color:'#e9ebf2'},{label:'Taille (lots)',value:risk.valid?String(risk.positionSize):'—',color:'#c9bfff'},{label:'Risque effectif',value:risk.valid?risk.actualRisk.toFixed(2)+' $':'Valeurs à vérifier',color:'#3fd2a4'}];
    const today=PIPVORIA_CORE.summary(rows,{period:'today',timezone:tz}),week=PIPVORIA_CORE.summary(rows,{period:'week',timezone:tz});v.periodWins=[{label:'Aujourd’hui',wins:today.wins,losses:today.losses,tp:today.targets.join(' / ')},{label:'7 derniers jours',wins:week.wins,losses:week.losses,tp:week.targets.join(' / ')}];
    const lossLimit=Number(this.ex.set.maxLossDay)||null,tradeLimit=Number(this.ex.set.maxTradesDay)||null;v.ruleStatus=(lossLimit&&today.netR<=-lossLimit||tradeLimit&&today.closed>=tradeLimit)?'Limite atteinte':'Journal personnel · limites indicatives';v.rules=[{label:'Résultat du jour',value:(today.netR??'—')+' R'+(lossLimit?' / −'+lossLimit+' R':''),pct:'0%',color:'#f0b45b'},{label:'Trades clôturés',value:String(today.closed)+(tradeLimit?' / '+tradeLimit:''),pct:'0%',color:'#9d8cff'}];
    if(window.innerWidth<=767){const order=['zin','zout','cursor','hline','trend','rect','fib','text','replay','reset','del'];v.tools=v.tools.slice().sort((a,b)=>order.indexOf(a.key)-order.indexOf(b.key)).map(t=>t.key==='cursor'?{...t,glyph:'↔'}:t);}
    return v;
  }
  async importSettings(){const input=document.createElement('input');input.type='file';input.accept='.json,application/json';input.onchange=async()=>{try{if(!input.files[0]||input.files[0].size>48000)throw Error();const value=JSON.parse(await input.files[0].text());if(!PIPVORIA_CORE.settingsTargetsValid(value))throw Error();this.settings=PIPVORIA_CORE.settings(value);this.applySettings();this.queueSettings();}catch{this.ex.setMsg='Fichier invalide ou trop volumineux.';this.forceUpdate();}};input.click();}
}
window.Terminal=Terminal;
