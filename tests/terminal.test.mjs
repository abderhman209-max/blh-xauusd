import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import '../public/core.js';
import {additionalMarket} from '../lib/terminal-market.js';
const C=globalThis.PIPVORIA_CORE;
function session(fetcher){const ctx={URLSearchParams,TextDecoder,Uint8Array,globalThis:null};ctx.globalThis=ctx;vm.createContext(ctx);vm.runInContext(fs.readFileSync('public/terminal-api.js','utf8'),ctx);return new ctx.TerminalSession({fetcher});}
const response=(body,status=200)=>({ok:status<400,status,json:async()=>body});
function terminalApp(storage,extras={}){
  const ctx={Date,Intl,URLSearchParams,structuredClone,console,AbortController,clearInterval(){},clearTimeout(){},setTimeout(){return 1;},setInterval(){return 1;},location:{pathname:'/',hash:'',search:''},history:{replaceState(_a,_b,url){ctx.location.hash=url.includes('#')?'#'+url.split('#')[1]:'';}},scrollTo(){},ResizeObserver:class{observe(){}disconnect(){}},addEventListener(){},removeEventListener(){},document:{querySelector:()=>null},window:null,DCLogic:class{props={};setState(p,cb){Object.assign(this.state,typeof p==='function'?p(this.state):p);cb?.();}forceUpdate(){}}};ctx.window=ctx;ctx.localStorage=storage;Object.assign(ctx,extras);vm.createContext(ctx);
  for(const name of ['live','core','structure','smart','blh-clean','pa-liquidity','heatmap','indicator-performance','terminal-original','terminal'])vm.runInContext(fs.readFileSync('public/'+name+'.js','utf8'),ctx);
  const app=vm.runInContext('new Terminal()',ctx);app.session={epoch:1,user:{id:'paid-fixture'}};app.access={active:true,deadline:Date.now()+3600000};return app;
}
test('public landing survives a missing session, while login/signup and protected links open auth',async()=>{
  const app=terminalApp();app.session={restore:async()=>{const error=Error('authentication_required');error.status=401;throw error;}};
  assert.equal(app.state.screen,'landing');await app.restore();assert.equal(app.state.screen,'landing');assert.equal(app.state.authBusy,false);
  app.openAuth('signup');assert.equal(app.state.screen,'auth');assert.equal(app.state.authMode,'signup');app.publicRoute();assert.equal(app.state.authMode,'signup');
  app.openAuth('login');app.publicRoute();assert.equal(app.state.authMode,'login');
  app.go('landing');app.publicRoute();assert.equal(app.state.screen,'landing');
  app.navigate('calendar');app.publicRoute();assert.equal(app.state.screen,'auth');
});
test('successful logout returns to landing; unconfirmed logout keeps the auth retry screen',async()=>{
  const app=terminalApp();app.session={signOut:async()=>{}};await app.logout();assert.equal(app.state.screen,'landing');
  app.session={signOut:async()=>{throw Error('offline');}};await app.logout();assert.equal(app.state.screen,'auth');assert.match(app.state.authError,/Réessayez/);
});
test('registration queues the request without accepting a user or retaining a password',async()=>{
 const app=terminalApp();app.state.authMode='signup';app.state.authBusy=false;app.state.email='member@example.invalid';app.state.name='Member';app.state.password='Strong-Test12!';
 app.session={request:async()=>({approvalRequired:true,confirmationRequired:true}),accept:()=>assert.fail('Pending request must not unlock the site')};
 await app.submitAuth();assert.equal(app.state.approvalStatus,'pending');assert.equal(app.state.approvalEmailConfirmation,true);assert.equal(app.state.password,'');assert.equal(app.state.screen,'auth');
 app.openAuth('login');assert.equal(app.state.approvalStatus,'');assert.equal(app.state.authMode,'login');
});
test('approval errors render the blocked status instead of opening the terminal',async()=>{
 const app=terminalApp();app.state.authBusy=false;app.state.email='member@example.invalid';app.state.password='Existing-Test12!';app.session={request:async()=>{throw Error('account_pending');}};
 await app.submitAuth();assert.equal(app.state.approvalStatus,'pending');assert.equal(app.state.password,'');assert.equal(app.state.screen,'auth');
 assert.equal(app.showApprovalError(Error('account_rejected')),true);assert.equal(app.state.approvalStatus,'rejected');assert.equal(app.state.screen,'auth');
});
test('an invalidated admin list cannot cross accounts and a failed decision remains retryable',async()=>{
 const app=terminalApp();let finish;app.session={epoch:1,user:{isAdmin:true},request:()=>new Promise(r=>finish=r)};
 const loading=app.loadAdmin();app.session.epoch++;app.session.user=null;finish({users:[{email:'private@example.invalid'}]});await loading;assert.equal(app.ex.users.length,0);
 app.session={epoch:3,user:{isAdmin:true},request:async()=>{throw Error('offline');}};app.adminLoading=true;
 await app.adminAction({id:'pending',updatedAt:'2026-10-12T00:00:00Z'},'approve');assert.equal(app.adminBusy,null);assert.equal(app.adminLoading,false);assert.match(app.state.notice,/Réessayez/);
});
test('refusal requires a second inline confirmation before calling the admin API',async()=>{
 const app=terminalApp(),actions=[];app.adminAction=async(user,action)=>actions.push({id:user.id,action});const member={id:'pending'};
 app.confirmRejection(member);assert.equal(app.adminRejectId,'pending');assert.equal(actions.length,0);await app.confirmRejection(member);assert.equal(actions.length,1);assert.equal(actions[0].action,'reject');
});
test('a first finger tap places a drawing without prior hover; a cancelled scroll never draws',()=>{
  const app=terminalApp(),handlers={},drawings=[];let captured=null;
  app.draw=()=>{};app.pW=400;app.inv={price:y=>4300-y,time:x=>x};app.addLine=line=>drawings.push(line);app.state.tool='hline';
  app.canvasRef({parentNode:{},getBoundingClientRect:()=>({left:10,top:20}),setPointerCapture:id=>captured=id,addEventListener:(name,callback)=>handlers[name]=callback});
  const finger={pointerId:1,pointerType:'touch',isPrimary:true,clientX:110,clientY:120};
  handlers.pointerdown(finger);app.onUp(finger);assert.equal(captured,1);assert.equal(drawings.length,1);assert.equal(drawings[0].price,4200);
  handlers.pointerdown(finger);handlers.pointercancel();app.onUp(finger);assert.equal(drawings.length,1);
});
test('Calendar resolves to the economic calendar from the mobile More menu and direct links',()=>{
  const app=terminalApp();app.session={user:{}};app.route('calendar');assert.equal(app.state.appTab,'calendar');app.route('news');assert.equal(app.state.appTab,'calendar');
});
test('ticket refresh preserves earlier history and legacy admin replies remain customer scoped',async()=>{
  const app=terminalApp(),calls=[];app.session={user:{id:'admin',isAdmin:true},request:async(route,options)=>{
    calls.push({route,options});
    if(route==='support/tickets')return{configured:true,tickets:[{id:'ticket',subject:'Question'}],hasMore:false};
    if(route==='support/ticket/messages')return{ticket:{id:'ticket'},messages:[{id:'recent',seq:2}],hasMore:false};
    if(route==='admin/support/tickets')return{configured:false};
    if(route==='admin/support/inbox')return{threads:[{userId:'customer',name:'Client'}],hasMore:false};
    if(route==='admin/support/messages')return{messages:[{id:'recent',seq:2}],hasMore:false};
    return{};
  }};
  app.sup.tickets=[{id:'ticket',msgs:[{id:'older',seq:1}]}];app.sup.cur='ticket';await app.loadTickets(true);
  assert.deepEqual(Array.from(app.sup.tickets[0].msgs,m=>m.id),['older','recent']);
  app.sup.admin=true;app.sup.cur=null;await app.loadTickets();assert.equal(app.sup.tickets[0].id,'legacy:customer');
  await app.openTicket('legacy:customer');assert.equal(calls.at(-1).options.query.userId,'customer');
});
test('invalid journal results never reach the API and a failed save retains its draft',async()=>{
  const app=terminalApp();let calls=0;app.session={epoch:1,request:async()=>{calls++;throw Error('offline');}};
  app.journalDrafts.set('trade',{payload:{resultR:NaN}});await app.saveJournal('trade');assert.equal(calls,0);
  app.journalDrafts.set('trade',{payload:{resultR:-1,status:'loss',closedAt:Date.now()}});await app.saveJournal('trade');
  assert.equal(calls,1);assert.equal(app.journalDrafts.get('trade').saving,false);assert.equal(app.journalDrafts.get('trade').payload.status,'loss');
});
test('private calls are blocked before login and after an unconfirmed logout',async()=>{
  let calls=0;const s=session(async()=>{calls++;return response({error:'offline'},503);});
  await assert.rejects(s.request('workspace'),/authentication_required/);assert.equal(calls,0);
  s.accept({id:'owner'});await assert.rejects(s.signOut(),/offline/);assert.equal(s.pendingLogout,true);assert.equal(s.user,null);
  await assert.rejects(s.request('workspace'),/authentication_required/);assert.equal(calls,1);assert.equal(s.accept({id:'owner'}),false);
});
test('late private and restore responses never cross account or logout boundaries',async()=>{
  let finish;const s=session(()=>new Promise(resolve=>finish=resolve));s.accept({id:'old'});
  const privateCall=s.request('workspace');s.lock();s.accept({id:'new'});finish(response({journal:[{id:'private-old'}]}));await assert.rejects(privateCall,/session_changed/);
  const restore=s.restore();s.lock();finish(response({user:{id:'old'}}));assert.equal(await restore,null);assert.equal(s.user,null);
});
test('expired verified session locks all subsequent private requests',async()=>{
  const s=session(async()=>response({error:'session_replaced'},401));s.accept({id:'owner'});
  await assert.rejects(s.request('settings'),/session_replaced/);assert.equal(s.user,null);assert.equal(s.locked,true);
});
test('settings retain owner annotations, limits and drawings while removing unsupported input',()=>{
  const settings=C.settings({terminal:{goalR:12,language:'العربية',sessions:{asia:true},drawings:{'XAU|5m':[{type:'h',price:4300},{type:'x',t:1,p:2,text:'<img onerror=x>'},{type:'script',text:'bad'}],'evil':[{}]},maxTradesDay:-1}});
  assert.equal(settings.terminal.goalR,12);assert.equal(settings.terminal.language,'العربية');assert.equal(settings.terminal.maxTradesDay,null);
  assert.equal(settings.terminal.drawings['XAU|5m'].length,2);assert.equal(settings.terminal.drawings.evil,undefined);
  assert.equal(C.settings(settings).terminal.drawings['XAU|5m'][1].text,'<img onerror=x>');
});
test('additional market quotes are allowlisted, labelled and never filled with simulated bars',async()=>{
  let calls=0;
  await assert.rejects(additionalMarket('https://evil.invalid','1min',{fetcher:async()=>{calls++;}}),/invalid_market/);assert.equal(calls,0);
  const result=await additionalMarket('EUR','5min',{now:1000000,fetcher:async url=>{assert.match(url,/EURUSD%3DX/);return response({chart:{result:[{timestamp:[100,200],indicators:{quote:[{open:[1,1],high:[2,null],low:[.5,.5],close:[1.1,1.1]}]}}]}});}});
  assert.equal(result.bars.length,1);assert.match(result.source,/différée/);
  await assert.rejects(additionalMarket('NAS','5min',{fetcher:async()=>response({},503)}),/market_data_unavailable/);
});
test('the new terminal uses the existing engines on closed bars and does not invent BLH signals on other markets',()=>{
  const ctx={Date,Intl,URLSearchParams,structuredClone,console,document:{querySelector:()=>null},window:null,DCLogic:class{props={};setState(p,cb){Object.assign(this.state,typeof p==='function'?p(this.state):p);cb?.();}forceUpdate(){}}};ctx.window=ctx;vm.createContext(ctx);
  for(const name of ['core','structure','smart','blh-clean','pa-liquidity','heatmap','indicator-performance','terminal-original','terminal'])vm.runInContext(fs.readFileSync('public/'+name+'.js','utf8'),ctx);
  const app=vm.runInContext('new Terminal()',ctx);app.session={user:{id:'paid-fixture',isAdmin:true}};app.access={active:true,deadline:Date.now()+3600000};app.state.lastFetch=Date.now();
  let seed=7,p=4300;const now=Math.floor(Date.now()/300000)*300000;
  const bars=Array.from({length:300},(_,i)=>{seed=(seed*16807)%2147483647;const open=p;p+=(seed/2147483647-.5)*10;return{time:now-(299-i)*300000,open,high:Math.max(open,p)+2,low:Math.min(open,p)-2,close:p,closed:i<299};});
  app.setBars(bars,'Fixture');assert.equal(app.state.bars.length,300);assert.equal(app.plannerM.fast.length,299);
  const expected=vm.runInContext('BlhClean',ctx).analyze(bars.slice(0,-1));assert.equal(app.model.signals.length,expected.signals.length);
  app.state.tf='15m';app.setBars(bars,'Fixture');assert.equal(app.model.signals.length,0);assert.equal(app.perf,null);
  app.state.symbol='BTC';app.state.tf='5m';app.setBars(bars,'Fixture');assert.equal(app.model.plans.length,0);
});

test('unpaid deep links and data loaders stay blocked while profile, support and owner administration remain accessible',async()=>{
 const app=terminalApp();app.state.screen='app';app.session={epoch:1,user:{id:'unpaid',isAdmin:true},request:()=>assert.fail('An unpaid loader must not fetch')};app.access={active:false,status:'inactive'};
 for(const route of ['signals','positions','journal','history','calendar']){app.route(route);assert.equal(app.state.appTab,'access');assert.equal(app.renderVals().isTrader,false);}
 await app.load();await app.loadWatch();await app.loadWorkspace();await assert.rejects(app.marketBars('BTC','5m'),/subscription_required/);
 app.route('profile');assert.equal(app.state.appTab,'profile');app.route('support');assert.equal(app.state.appTab,'support');app.loadAdmin=()=>{};app.route('admin');assert.equal(app.state.appTab,'admin');
});
test('expiry clears previously loaded premium data and an unpaid API response preserves the authenticated account',async()=>{
 const app=terminalApp();app.state.screen='app';app.state.appTab='trader';app.state.bars=[{close:100}];app.journal=[{id:'private'}];app.notifications=[{title:'Signal'}];app.blockPaidAccess('subscription_required');
 assert.equal(app.state.appTab,'access');assert.equal(app.state.bars.length,0);assert.equal(app.journal.length,0);assert.equal(app.notifications.length,0);
 const s=session(async()=>response({error:'subscription_required'},402));let blocked=0;s.onPaymentRequired=()=>blocked++;s.accept({id:'owner'});
 await assert.rejects(s.request('gold'),/subscription_required/);assert.equal(blocked,1);assert.equal(s.user.id,'owner');assert.equal(s.locked,false);
});
test('only a fresh server subscription response reopens the terminal and stale checks cannot unlock another account',async()=>{
 const app=terminalApp();app.state.appTab='access';app.access=null;let starts=0;app.startPaidWorkspace=async()=>starts++;
 app.session.request=async()=>({active:true,paidUntil:new Date(Date.now()+3600000).toISOString(),checkedAt:new Date().toISOString()});
 assert.equal(await app.refreshAccess(),true);assert.equal(app.state.appTab,'trader');assert.equal(starts,1);
 app.session.request=async()=>{throw Error('offline');};assert.equal(await app.refreshAccess(),false);assert.equal(app.access.status,'error');assert.equal(app.state.appTab,'access');
 let finish;app.session.request=()=>new Promise(r=>finish=r);const pending=app.refreshAccess();app.session.epoch++;app.session.user={id:'another'};finish({active:true,paidUntil:'2099-01-01T00:00:00Z',checkedAt:new Date().toISOString()});
 assert.equal(await pending,false);assert.equal(app.hasPaidAccess(),false);
 const denied=app.refreshAccess();app.blockPaidAccess('subscription_required');finish({active:true,paidUntil:'2099-01-01T00:00:00Z',checkedAt:new Date().toISOString()});assert.equal(await denied,false);assert.equal(app.hasPaidAccess(),false);
});


test('only a fresh server exemption opens an unpaid super admin terminal without renewal prompts',async()=>{
 const app=terminalApp();app.state.screen='app';app.state.appTab='access';app.access=null;app.session.user.isAdmin=true;
 let starts=0;app.startPaidWorkspace=async()=>starts++;
 app.session.request=async()=>({active:true,exempt:true,paidUntil:null,checkedAt:new Date().toISOString()});
 assert.equal(app.hasPaidAccess(),false);assert.equal(await app.refreshAccess(),true);assert.equal(starts,1);
 const v=app.renderVals();assert.equal(v.isTrader,true);assert.equal(v.accountBadge,'SUPER ADMIN');assert.equal(v.showRenewal,false);assert.equal(v.paidWith,'Accès gratuit');
 app.access.deadline=Date.now()-1;assert.equal(app.hasPaidAccess(),false);
 app.session.user.isAdmin=false;assert.equal(await app.refreshAccess(),false);assert.equal(app.renderVals().showRenewal,true);
});

test('AI stream handles split UTF-8 chunks and preserves the subscription and account boundaries',async()=>{
 const encoder=new TextEncoder(),bytes=encoder.encode(JSON.stringify({type:'stage',label:'Lecture des périodes'})+'\n'+JSON.stringify({type:'result',result:{status:'wait'}})+'\n');
 const s=session(async()=>new Response(new ReadableStream({start(c){c.enqueue(bytes.slice(0,20));c.enqueue(bytes.slice(20));c.close();}}),{headers:{'content-type':'application/x-ndjson'}}));s.accept({id:'owner'});
 const stages=[];assert.equal((await s.stream('analysis/run',{body:{},onEvent:e=>stages.push(e.label)})).status,'wait');assert.equal(stages[0],'Lecture des périodes');
 s.fetcher=async()=>response({error:'subscription_required'},402);await assert.rejects(()=>s.stream('analysis/run',{body:{}}),/subscription_required/);assert.equal(s.user.id,'owner');
 let next;s.fetcher=async()=>new Response(new ReadableStream({start(c){next=c;}}),{headers:{'content-type':'application/x-ndjson'}});const pending=s.stream('analysis/run',{body:{}});await new Promise(r=>setImmediate(r));s.lock();next.enqueue(bytes);await assert.rejects(()=>pending,/session_changed/);
 s.accept({id:'owner'});let finishError;s.fetcher=async()=>({ok:false,status:401,json:()=>new Promise(r=>finishError=r)});const oldError=s.stream('analysis/run',{body:{}});await new Promise(r=>setImmediate(r));s.lock();s.accept({id:'new-owner'});finishError({error:'expired'});await assert.rejects(()=>oldError,/session_changed/);assert.equal(s.user.id,'new-owner');assert.equal(s.locked,false);
});
test('the AI bot cannot start unpaid, and a market switch discards an older model answer',async()=>{
 const app=terminalApp();app.state.screen='app';app.access=null;app.session.stream=()=>assert.fail('Unpaid AI request');await app.runAutomaticAnalysis();
 app.access={active:true,deadline:Date.now()+3600000};let finish;app.session.stream=()=>new Promise(r=>finish=r);const pending=app.runAutomaticAnalysis();
 app.cancelAutomaticAnalysis();app.state.symbol='EUR';finish({status:'ready',symbol:'XAU'});await pending;assert.equal(app.automatic,null);assert.equal(app.automaticBusy,false);
 app.state.symbol='XAU';app.automatic={symbol:'XAU',tf:'5m',status:'ready',validUntil:Date.now()-1,plan:{direction:'buy',entry:4200,stop:4190,target:4220,rewardRisk:2}};assert.equal(app.renderVals().analysisReady,false);
});

test('conditional AI levels stay unconfirmed and expired levels remain historical until access is lost',()=>{
 const app=terminalApp();app.state.screen='app';app.state.symbol='XAU';app.state.tf='5m';app.access={active:true,deadline:Date.now()+3600000};
 app.automatic={symbol:'XAU',tf:'5m',status:'conditional',validUntil:Date.now()+60000,message:'Attendre le retest.',plan:{direction:'sell',conditional:true,entry:4200,stop:4210,targets:[4190,4180,4170],rewardRisk:2,trigger:'Attendre une clôture sous 4200 puis son retest.',exitRule:'Objectifs 4190, 4180, 4170 ; sortie au stop 4210.'}};
 let v=app.renderVals();assert.equal(v.analysisReady,false);assert.equal(v.analysisShowLevels,true);assert.equal(v.analysisHasPlan,true);assert.equal(v.analysisTitle,'VENTE À CONFIRMER');assert.ok(v.analysisTrigger.includes('retest'));assert.ok(v.analysisExit.includes('4210'));assert.notEqual(v.analysisTp3,'—');
 app.automatic.status='ready';assert.equal(app.renderVals().analysisReady,true);
 app.automatic.validUntil=Date.now()-1;v=app.renderVals();assert.equal(v.analysisShowLevels,true);assert.equal(v.analysisHasPlan,false);assert.equal(v.analysisReady,false);assert.notEqual(v.analysisEntry,'—');assert.notEqual(v.analysisTp3,'—');assert.match(v.analysisTitle,/Ancien calcul/);assert.match(v.analysisValidity,/actualiser/);
 app.automatic.validUntil=Date.now()+60000;app.access=null;assert.equal(app.renderVals().analysisHasPlan,false);
 app.access={active:true,deadline:Date.now()+60000};app.automatic.status='wait';app.automatic.plan=null;v=app.renderVals();assert.equal(v.analysisShowLevels,true);assert.equal(v.analysisHasPlan,false);assert.equal(v.analysisTitle,'ATTENDRE');assert.equal(v.analysisTp1,'—');
});

function analysisStorage(){const rows=new Map;return{getItem:key=>rows.get(key)||null,setItem:(key,value)=>rows.set(key,value)};}
function savedAnalysis(symbol='XAU',interval='5min'){
 return{symbol,interval,status:'ready',asOf:Date.now()-300000,generatedAt:Date.now()-1000,validUntil:Date.now()+60000,source:'Fixture',
 plan:{direction:'buy',entry:4200,stop:4190,targets:[4210,4220,4230],rewardRisk:2,trigger:'Clôture confirmée.',exitRule:'Sortie aux objectifs ou au stop.'}};
}
test('AI calculations survive a new page and logout/login without a new model call',async()=>{
 const storage=analysisStorage(),first=terminalApp(storage);let calls=0;
 first.state.symbol='EUR';first.state.tf='15m';first.session.stream=async()=>{calls++;return savedAnalysis('EUR','15min');};await first.runAutomaticAnalysis();assert.equal(calls,1);
 const refreshed=terminalApp(storage);refreshed.session.stream=()=>assert.fail('Restoration must never generate an analysis');
 refreshed.loadWorkspace=refreshed.loadCapabilities=refreshed.loadWatch=async()=>{};let loaded;
 refreshed.load=async()=>{loaded=refreshed.state.symbol+'|'+refreshed.state.tf;};await refreshed.startPaidWorkspace();
 assert.equal(loaded,'EUR|15m');assert.equal(refreshed.automatic.plan.entry,4200);assert.equal(refreshed.state.automaticFollow,false);
 refreshed.lock('logout_pending');refreshed.session.user=null;refreshed.session.epoch++;assert.equal(refreshed.automatic,null);
 refreshed.session.user={id:'paid-fixture'};refreshed.access={active:true,deadline:Date.now()+60000};await refreshed.startPaidWorkspace();assert.equal(refreshed.automatic.plan.targets[2],4230);assert.equal(calls,1);
});
test('saved calculations stay scoped to account, market and period and require paid access',async()=>{
 const storage=analysisStorage(),app=terminalApp(storage);app.session.stream=async()=>savedAnalysis();await app.runAutomaticAnalysis();
 const other=terminalApp(storage);other.session.user.id='other-owner';await other.restoreAutomaticAnalysis(true);assert.equal(other.automatic,null);
 app.load=()=>{};app.setSymbol('EUR');assert.equal(app.automatic,null);app.setSymbol('XAU');assert.equal(app.automatic.plan.entry,4200);
 app.renderVals().onTf({target:{value:'15m'}});assert.equal(app.automatic,null);app.renderVals().onTf({target:{value:'5m'}});assert.equal(app.automatic.plan.entry,4200);
 app.cancelAutomaticAnalysis();app.access=null;await app.restoreAutomaticAnalysis(true);assert.equal(app.automatic,null);
 app.access={active:true,deadline:Date.now()+60000};app.state.demo=true;await app.restoreAutomaticAnalysis(true);assert.equal(app.automatic,null);
 app.state.demo=false;app.session.pendingLogout=true;await app.restoreAutomaticAnalysis(true);assert.equal(app.automatic,null);
});
test('expired saved results remain labelled historical and failed refreshes preserve the last calculation',async()=>{
 const storage=analysisStorage(),app=terminalApp(storage);app.session.stream=async()=>savedAnalysis();await app.runAutomaticAnalysis();
 app.automatic.validUntil=Date.now()-1;app.saveAutomaticAnalysis();const refreshed=terminalApp(storage);await refreshed.restoreAutomaticAnalysis(true);
 let view=refreshed.renderVals();assert.equal(view.analysisReady,false);assert.equal(view.analysisHasPlan,false);assert.equal(view.analysisShowLevels,true);assert.match(view.analysisTitle,/Ancien calcul/);assert.match(view.analysisValidity,/actualiser/);assert.notEqual(view.analysisEntry,'—');
 refreshed.session.stream=async()=>{throw Error('analysis_daily_limit');};await refreshed.runAutomaticAnalysis();assert.equal(refreshed.automatic.plan.entry,4200);assert.match(refreshed.automaticError,/limite quotidienne/);
 const again=terminalApp(storage);await again.restoreAutomaticAnalysis(true);assert.equal(again.automatic.plan.entry,4200);assert.equal(again.automaticError,'');
 again.access=null;view=again.renderVals();assert.equal(view.analysisShowLevels,false);assert.equal(view.analysisEntry,'—');
});
test('corrupt or unavailable storage cannot break login, and late AI replies cannot persist for a new account',async()=>{
 const storage=analysisStorage(),app=terminalApp(storage),key=app.analysisMemoryKey();storage.setItem(key,'{');await app.restoreAutomaticAnalysis(true);assert.equal(app.automatic,null);
 storage.setItem(key,JSON.stringify({version:1,owner:'someone-else',entries:{},last:'XAU|5m'}));await app.restoreAutomaticAnalysis(true);assert.equal(app.automatic,null);
 const invalid={...savedAnalysis(),tf:'5m'};invalid.plan.targets=[1,null,3];storage.setItem(key,JSON.stringify({version:1,owner:'paid-fixture',entries:{'XAU|5m':invalid},last:'XAU|5m'}));await app.restoreAutomaticAnalysis(true);assert.equal(app.automatic,null);
 const unavailable=terminalApp({getItem(){throw Error('denied');},setItem(){throw Error('denied');}});await unavailable.restoreAutomaticAnalysis(true);unavailable.session.stream=async()=>savedAnalysis();await unavailable.runAutomaticAnalysis();assert.equal(unavailable.automatic.plan.entry,4200);assert.match(unavailable.state.notice,/conserver/);
 let finish;app.session.stream=()=>new Promise(r=>finish=r);const pending=app.runAutomaticAnalysis();app.cancelAutomaticAnalysis();app.session.epoch++;app.session.user={id:'new-owner'};finish(savedAnalysis());await pending;assert.equal(storage.getItem(app.analysisMemoryKey()),null);
});

test('subscribers keep market candles and AI results without running or exposing indicator tools',async()=>{
 const app=terminalApp();app.state.screen='app';app.state.tab='summary';app.state.indOpen=true;
 app.analyze=app.computeStruct=app.computeExtra=()=>assert.fail('A subscriber must not run an indicator engine');
 app.session.request=()=>assert.fail('Indicator-only actions must not fetch');app.load=()=>assert.fail('Replay must not load');
 const bars=[{time:Date.now()-600000,open:4200,high:4210,low:4190,close:4205,closed:true}];
 app.model={plan:{entry:4200}};app.heat={old:true};app.msPerf={old:true};app.setBars(bars,'Fixture');
 assert.equal(app.state.bars.length,1);assert.equal(app.model,null);assert.equal(app.heat,null);assert.equal(app.msPerf,null);
 let view=app.renderVals();assert.equal(view.canUseIndicators,false);assert.equal(view.showIndicatorResults,false);assert.equal(view.isChartTab,true);assert.equal(view.isSummaryTab,false);assert.equal(view.isOpsTab,false);assert.equal(view.indOpen,false);assert.equal(view.indList.length,0);assert.equal(view.extraInd.length,0);assert.equal(view.tools.some(t=>t.key==='replay'),false);
 view.toggleInd();view.onResultsOf({target:{value:'planner'}});assert.equal(app.state.resultsOf,'blh');await app.loadMtf();await app.registerPlan();app.startReplay();assert.equal(app.rp,null);
 app.automatic={...savedAnalysis(),tf:'5m'};view=app.renderVals();assert.equal(view.analysisDirection,'ACHAT');assert.equal(view.analysisEntry,'4200.00');assert.equal(view.analysisTp3,'4230.00');assert.equal(view.analysisNoResult,false);
 app.session.user.isAdmin='true';assert.equal(app.canUseIndicators(),false);app.session.user={id:'member',user_metadata:{isAdmin:true,role:'super_admin'}};assert.equal(app.canUseIndicators(),false);
});
test('only verified administrators retain the indicator result panels, controls and historical tabs',()=>{
 const app=terminalApp();app.session.user.isAdmin=true;app.state.screen='app';app.state.indOpen=true;
 let view=app.renderVals();assert.equal(view.canUseIndicators,true);assert.equal(view.showIndicatorResults,true);assert.equal(view.indOpen,true);assert.equal(view.indList.length,4);assert.equal(view.tools.some(t=>t.key==='replay'),true);
 app.state.tab='summary';view=app.renderVals();assert.equal(view.isSummaryTab,true);app.state.tab='ops';assert.equal(app.renderVals().isOpsTab,true);
 app.access=null;view=app.renderVals();assert.equal(view.canUseIndicators,false);assert.equal(view.showIndicatorResults,false);
});
test('AI chart levels and table values agree while conditional, wait, stale and access states stay distinct',()=>{
 const app=terminalApp();app.automatic={...savedAnalysis(),tf:'5m'};
 let levels=app.analysisChartLevels(),view=app.renderVals();assert.equal(levels.length,5);assert.equal(levels[0].price,Number(view.analysisEntry));assert.equal(levels[4].price,Number(view.analysisTp3));
 app.automatic.status='conditional';assert.match(app.analysisChartLevels()[0].label,/CONFIRMER/);assert.equal(app.renderVals().analysisReady,false);
 const text=[],ctx=new Proxy({measureText:value=>({width:value.length*6}),fillText:value=>text.push(value)},{get:(target,key)=>key in target?target[key]:()=>{}});
 app.state.bars=Array.from({length:80},(_,i)=>({time:Date.now()-(80-i)*300000,open:4200,high:4208,low:4198,close:4205,closed:true}));
 app.cv={isConnected:true,parentNode:{clientWidth:900,clientHeight:500},getContext:()=>ctx};app.draw();assert.ok(text.some(s=>s.includes('IA ACHAT À CONFIRMER')));assert.ok(text.some(s=>s.includes('IA TP3  4230.00')));assert.ok(!text.some(s=>s.includes('BOS')||s.includes('FIB 50')));
 text.length=0;app.automatic.validUntil=Date.now()-1;app.draw();assert.equal(app.analysisChartLevels().length,0);assert.ok(!text.some(s=>s.startsWith('IA ')));assert.equal(app.renderVals().analysisEntry,'4200.00');
 app.automatic={...savedAnalysis(),tf:'5m',status:'wait',plan:null};view=app.renderVals();assert.equal(view.analysisDirection,'ATTENDRE');assert.equal(view.analysisEntry,'—');assert.equal(app.analysisChartLevels().length,0);
 app.automatic={...savedAnalysis(),tf:'5m'};app.state.tf='15m';assert.equal(app.analysisChartLevels().length,0);app.state.tf='5m';app.state.demo=true;assert.equal(app.analysisChartLevels().length,0);app.state.demo=false;app.access=null;assert.equal(app.analysisChartLevels().length,0);assert.equal(app.renderVals().analysisEntry,'—');
});

test('Bitcoin can run and restore AI calculations while live ticks update the chart and table without replacing the plan',async()=>{
 const sockets=[];class Socket{readyState=0;constructor(){sockets.push(this);}send(){}close(){this.readyState=3;this.onclose?.();}}
 const storage=analysisStorage(),app=terminalApp(storage,{WebSocket:Socket});app.state.symbol='BTC';
 app.session.request=async(route,options)=>{assert.equal(route,'market');assert.equal(options.query.symbol,'BTC');return {bars:[{time:Math.floor(Date.now()/300000)*300000,open:100000,high:100100,low:99900,close:100010,volume:8,closed:false}],source:'Coinbase · BTC/USD',fetchedAt:Date.now()};};
 await app.load();assert.equal(sockets.length,1);const socket=sockets[0];socket.readyState=1;socket.onopen();
 app.session.stream=async(_route,options)=>{assert.equal(options.body.symbol,'BTC');return savedAnalysis('BTC');};await app.runAutomaticAnalysis();assert.equal(app.renderVals().analysisUnsupported,false);
 socket.onmessage({data:JSON.stringify({type:'ticker',product_id:'BTC-USD',price:'100123.45',time:new Date().toISOString()})});app.paintLive();
 let view=app.renderVals();assert.equal(app.state.bars.at(-1).close,100123.45);assert.equal(view.analysisLivePrice,'100123.45');assert.equal(view.analysisPriceLabel,'Cours en direct');assert.equal(app.automatic.plan.entry,4200);
 const restored=terminalApp(storage);await restored.restoreAutomaticAnalysis(true);assert.equal(restored.state.symbol,'BTC');assert.equal(restored.automatic.plan.entry,4200);
 app.state.quoteAt=Date.now()-40000;assert.notEqual(app.renderVals().analysisPriceLabel,'Cours en direct');
 app.lock('logout_pending');const previous=app.state.bars.length;socket.onmessage({data:JSON.stringify({type:'ticker',product_id:'BTC-USD',price:'200000',time:new Date().toISOString()})});assert.equal(app.state.bars.length,previous);assert.equal(app.liveProduct,null);
});
test('a live price arriving during slow history loading survives REST reconciliation and late loads cannot cross logout',async()=>{
 const sockets=[];class Socket{readyState=1;constructor(){sockets.push(this);}send(){}close(){this.readyState=3;this.onclose?.();}}
 const app=terminalApp(undefined,{WebSocket:Socket});app.state.symbol='BTC';let finish;app.session.request=()=>new Promise(r=>finish=r);
 const loading=app.load();sockets[0].onmessage({data:JSON.stringify({type:'ticker',product_id:'BTC-USD',price:'100200',time:new Date().toISOString()})});
 const data={bars:[{time:Math.floor(Date.now()/300000)*300000,open:100000,high:100100,low:99900,close:100010,volume:8,closed:false}],source:'Coinbase',fetchedAt:Date.now()};finish(data);await loading;assert.equal(app.state.bars.at(-1).close,100200);
 const late=app.load();app.lock('logout_pending');app.session.epoch++;finish(data);await late;assert.equal(app.state.bars.length,0);
 const delayed=terminalApp();delayed.state.symbol='EUR';delayed.state.source='Yahoo Finance · cotation susceptible d’être différée';delayed.state.lastFetch=Date.now();assert.match(delayed.renderVals().sourceLabel,/Données différées/);
});

test('the price table publishes the latest crypto tick at one second without recalculating AI',async()=>{
 const sockets=[],timers=[];class Socket{constructor(){sockets.push(this);}send(){}close(){this.onclose?.();}}
 const app=terminalApp(undefined,{WebSocket:Socket,setTimeout:(fn,ms)=>{timers.push({fn,ms});return timers.length;}});app.state.symbol='BTC';
 app.session.request=async()=>({bars:[{time:Math.floor(Date.now()/300000)*300000,open:100000,high:100010,low:99990,close:100000,volume:1,closed:false}],fetchedAt:Date.now(),source:'Coinbase'});app.session.stream=()=>assert.fail('Price refresh must not run AI');
 await app.load();const tick=price=>sockets[0].onmessage({data:JSON.stringify({type:'ticker',product_id:'BTC-USD',price:String(price),time:new Date().toISOString()})});
 tick(100100);tick(100200);assert.equal(timers.length,1);assert.equal(timers[0].ms,1000);assert.equal(app.renderVals().analysisLivePrice,'100000.00');
 timers[0].fn();assert.equal(app.renderVals().analysisLivePrice,'100200.00');tick(100300);assert.equal(timers[1].ms,1000);assert.equal(app.renderVals().analysisLivePrice,'100200.00');timers[1].fn();assert.equal(app.renderVals().analysisLivePrice,'100300.00');
});
test('gold quote refreshes never overlap a slow request or trigger AI calculations',async()=>{
 const app=terminalApp();app.state.bars=[{time:Math.floor(Date.now()/300000)*300000,open:4200,high:4200,low:4200,close:4200,volume:0,closed:false}];let calls=0,finish;
 app.session.stream=()=>assert.fail('Quote refresh must not run AI');app.session.request=async route=>{assert.equal(route,'gold/price');calls++;return new Promise(resolve=>finish=resolve);};
 const first=app.tickPrice();await app.tickPrice();assert.equal(calls,1);finish({price:4210,receivedAt:Date.now(),source:'Twelve Data'});await first;assert.equal(app.renderVals().analysisLivePrice,'4210.00');
 const second=app.tickPrice();assert.equal(calls,2);finish({price:4220,receivedAt:Date.now()+1000,source:'Twelve Data'});await second;assert.equal(app.renderVals().analysisLivePrice,'4220.00');assert.equal(app.automatic,null);
});
test('bot performance renders shared outcomes only with paid access and refreshes after a new plan',async()=>{
 const app=terminalApp();let calls=0;const stats={checkedAt:Date.now(),overall:{plans:3,triggered:2,closed:2,winRate:50,avgR:.5,totalR:1,tpRate:[50,50,0]},ready:{plans:2,closed:1,winRate:100,avgR:2},conditional:{plans:1,closed:1,winRate:0,avgR:-1},adjusted:{plans:0},
  markets:[{symbol:'XAU',interval:'5min',plans:3,triggered:2,closed:2,winRate:50,avgR:.5,totalR:1}],recent:[{generatedAt:Date.now(),symbol:'XAU',interval:'5min',direction:'sell',conditional:true,state:'closed',reason:'stop',reached:[true,false,false],resultR:-.33}]};
 app.session.request=async route=>{assert.equal(route,'analysis/stats');calls++;return stats;};
 let v=app.renderVals();assert.equal(v.botStatsOpen,false);assert.equal(v.botStatsToggle,'Afficher');assert.equal(calls,0);
 v.toggleBotStats();await new Promise(r=>setImmediate(r));assert.equal(calls,1);v=app.renderVals();assert.equal(v.botStatsOpen,true);assert.equal(v.botStatsToggle,'Masquer');
 assert.equal(v.botStatsHas,true);assert.equal(v.botKpis[2].value,'50 %');assert.equal(v.botKpis[3].value,'+0.5 R');assert.equal(v.botKinds.length,2);
 assert.equal(v.botMarkets[0].market,'XAU/USD · 5m');assert.equal(v.botRecent[0].direction,'VENTE · à confirmer');assert.equal(v.botRecent[0].result,'Stop');assert.equal(v.botRecent[0].tps,'TP1');assert.equal(v.botRecent[0].r,'-0.33 R');
 app.session.stream=async()=>({symbol:'XAU',interval:'5min',status:'ready',asOf:Date.now()-1000,generatedAt:Date.now(),validUntil:Date.now()+60000,plan:{direction:'buy',entry:4200,stop:4190,targets:[4210,4220,4230],rewardRisk:2,trigger:'t',exitRule:'e'}});
 await app.runAutomaticAnalysis();await new Promise(r=>setImmediate(r));assert.equal(calls,2);
 app.session.request=async()=>{throw Error('analysis_stats_unavailable');};await app.loadBotStats();assert.match(app.renderVals().botStatsError,/indisponibles/);
 app.access=null;v=app.renderVals();assert.equal(v.botStatsHas,false);assert.equal(v.botKpis.length,0);
 app.access={active:true,deadline:Date.now()+60000};app.renderVals().toggleBotStats();assert.equal(app.renderVals().botStatsOpen,false);
 app.session.stream=async()=>({symbol:'XAU',interval:'5min',status:'ready',asOf:Date.now()-1000,generatedAt:Date.now(),validUntil:Date.now()+60000,plan:{direction:'buy',entry:4200,stop:4190,targets:[4210,4220,4230],rewardRisk:2,trigger:'t',exitRule:'e'}});
 const before=calls;app.session.request=async()=>{calls++;return stats;};await app.runAutomaticAnalysis();await new Promise(r=>setImmediate(r));assert.equal(calls,before,'A closed panel never loads stats');
});
test('a conditional AI scenario activates on a close beyond its trigger, alerts once and survives until its own expiry',()=>{
 const app=terminalApp(),ms=300000,asOf=Math.floor(Date.now()/ms)*ms-3*ms,toasts=[];app.pushToast=t=>toasts.push(t);app.state.symbol='XAU';app.state.tf='5m';
 app.automatic={symbol:'XAU',interval:'5min',tf:'5m',status:'conditional',asOf,generatedAt:asOf+1000,validUntil:asOf+ms,source:'Fixture',message:'m',checks:[],
  plan:{direction:'buy',conditional:true,entry:4200,stop:4190,targets:[4210,4220,4230],rewardRisk:2,rewardRisks:[1,2,3],triggerLevel:4202,activeUntil:asOf+12*ms,trigger:'Clôture au-dessus de 4202.',exitRule:'e'}};
 const bar=(i,low,high,close)=>({time:asOf+i*ms,open:close,high,low,close,closed:true});
 app.state.bars=[bar(0,4195,4203,4199)];let v=app.renderVals();
 assert.equal(v.analysisTitle,'ACHAT À CONFIRMER');assert.match(v.analysisScenarioLine,/clôture 5m au-dessus de 4202/);assert.equal(v.analysisShowLevels,true);assert.match(v.analysisPlanNotice,/au-dessus de 4202/);
 assert.ok(app.analysisChartLevels().some(l=>l.label.startsWith('IA DÉCLENCHEUR')));assert.match(v.analysisValidity,/Valide/);
 app.state.bars.push(bar(1,4199,4206,4204));app.checkScenarioTrigger(app.state.bars);app.checkScenarioTrigger(app.state.bars);v=app.renderVals();
 assert.equal(v.analysisTitle,'ACHAT ACTIVÉ');assert.match(v.analysisScenarioLine,/^Activé le/);assert.equal(toasts.length,1);assert.match(toasts[0].title,/Scénario IA activé/);
 app.state.bars=[bar(0,4189,4199,4195),bar(1,4199,4206,4204)];v=app.renderVals();
 assert.equal(v.analysisTitle,'SCÉNARIO ANNULÉ');assert.equal(app.analysisChartLevels().length,0);
 app.automatic.plan.activeUntil=Date.now()-1;assert.equal(app.renderVals().analysisTitle,'Ancien calcul · à actualiser');
});
test('EUR/USD and crypto contracts and per-market spreads are editable and drive the calculator',()=>{
 const app=terminalApp();app.settingsReady=true;let queued=0;app.queueSettings=()=>queued++;
 Object.assign(app.ex.calc,{capital:'10000',risk:'1',entry:'1.08',stop:'1.078'});app.state.symbol='EUR';
 let v=app.renderVals();assert.equal(v.marketSettings[0].contract,'100000');assert.equal(v.calcOut[2].value,'0.5');
 v.marketSettings[0].onContract({target:{value:'10000'}});assert.equal(app.renderVals().calcOut[2].value,'5');
 app.renderVals().spreadSettings.find(s=>s.label==='EUR/USD').onChange({target:{value:'0,0002'}});
 v=app.renderVals();assert.equal(app.settings.spreads.EUR,.0002);assert.equal(v.calcOut[2].value,'4.54');assert.match(v.calcOut[1].value,/spread/);
 v.marketSettings[1].onLotStep({target:{value:'-1'}});assert.equal(app.settings.btcLotStep,.0001);assert.match(app.ex.setMsg,/invalide/);
 assert.equal(queued,2);
});
test('the terminal names the release that pauses the agent and warns about one during an open plan',async()=>{
 const app=terminalApp(),at=new Date(Date.now()+600000).toISOString();app.state.symbol='XAU';app.state.tf='5m';
 app.session.stream=async()=>{throw Object.assign(Error('analysis_news_window'),{event:{name:'Inflation CPI',at}});};
 await app.runAutomaticAnalysis();assert.match(app.automaticError,/Inflation CPI/);assert.equal(app.automaticNextAt,Date.parse(at)+31*60000);
 app.automatic={symbol:'XAU',interval:'5min',tf:'5m',status:'ready',asOf:Date.now()-1000,generatedAt:Date.now(),validUntil:Date.now()+60000,source:'F',message:'m',checks:[],news:{name:'Décision de la Fed',at},
  plan:{direction:'buy',entry:4200,stop:4190,targets:[4210,4220,4230],rewardRisk:2,trigger:'t',exitRule:'e'}};
 assert.match(app.renderVals().analysisNewsLine,/Décision de la Fed/);
});
test('phone notifications subscribe through the service worker, send a test and can be turned off',async()=>{
 const pushManager={sub:null,async getSubscription(){return this.sub;},async subscribe(o){assert.equal(o.userVisibleOnly,true);assert.equal(o.applicationServerKey.length,65);
   this.sub={endpoint:'https://fcm.googleapis.com/fcm/send/x',toJSON:()=>({endpoint:'https://fcm.googleapis.com/fcm/send/x',keys:{p256dh:'p',auth:'a'}}),unsubscribe:async()=>{pushManager.sub=null;}};return this.sub;}};
 let permission='default';const Notification={get permission(){return permission;},requestPermission:async()=>(permission='granted')};
 const app=terminalApp(undefined,{atob,navigator:{serviceWorker:{ready:Promise.resolve({pushManager}),register:async()=>{}}},PushManager:class{},Notification});
 const routes=[];app.session.request=async(route,o)=>{routes.push(route);return route==='push/config'?{configured:true,publicKey:'B'+'A'.repeat(86)}:route==='push/test'?{sent:1}:{};};
 await app.loadPush();let v=app.renderVals();assert.equal(v.pushVisible,true);assert.equal(v.pushButton,'Activer');assert.match(v.pushLabel,/même site fermé/);
 await v.togglePush();v=app.renderVals();assert.equal(v.pushButton,'Désactiver');assert.match(v.pushMsg,/test/);assert.deepEqual(routes,['push/config','push/subscribe','push/test']);
 await v.togglePush();assert.equal(app.renderVals().pushButton,'Activer');assert.equal(pushManager.sub,null);assert.equal(routes.at(-1),'push/unsubscribe');
 const denied=terminalApp(undefined,{navigator:{serviceWorker:{ready:Promise.resolve({pushManager}),register:async()=>{}}},PushManager:class{},Notification:{permission:'default',requestPermission:async()=>'denied'}});
 denied.session.request=app.session.request;await denied.loadPush();await denied.togglePush();assert.match(denied.renderVals().pushMsg,/Autorisez/);
 const old=terminalApp();old.session.request=app.session.request;await old.loadPush();assert.match(old.renderVals().pushLabel,/non prises en charge/);
});
