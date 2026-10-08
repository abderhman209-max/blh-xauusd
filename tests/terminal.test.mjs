import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import '../public/core.js';
import {additionalMarket} from '../lib/terminal-market.js';
const C=globalThis.PIPVORIA_CORE;
function session(fetcher){const ctx={URLSearchParams,globalThis:null};ctx.globalThis=ctx;vm.createContext(ctx);vm.runInContext(fs.readFileSync('public/terminal-api.js','utf8'),ctx);return new ctx.TerminalSession({fetcher});}
const response=(body,status=200)=>({ok:status<400,status,json:async()=>body});
function terminalApp(){
  const ctx={Date,Intl,URLSearchParams,structuredClone,console,document:{querySelector:()=>null},window:null,DCLogic:class{props={};setState(p,cb){Object.assign(this.state,typeof p==='function'?p(this.state):p);cb?.();}forceUpdate(){}}};ctx.window=ctx;vm.createContext(ctx);
  for(const name of ['core','structure','smart','blh-clean','pa-liquidity','heatmap','indicator-performance','terminal-original','terminal'])vm.runInContext(fs.readFileSync('public/'+name+'.js','utf8'),ctx);
  return vm.runInContext('new Terminal()',ctx);
}
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
  const app=vm.runInContext('new Terminal()',ctx);app.state.lastFetch=Date.now();
  let seed=7,p=4300;const now=Math.floor(Date.now()/300000)*300000;
  const bars=Array.from({length:300},(_,i)=>{seed=(seed*16807)%2147483647;const open=p;p+=(seed/2147483647-.5)*10;return{time:now-(299-i)*300000,open,high:Math.max(open,p)+2,low:Math.min(open,p)-2,close:p,closed:i<299};});
  app.setBars(bars,'Fixture');assert.equal(app.state.bars.length,300);assert.equal(app.plannerM.fast.length,299);
  const expected=vm.runInContext('BlhClean',ctx).analyze(bars.slice(0,-1));assert.equal(app.model.signals.length,expected.signals.length);
  app.state.tf='15m';app.setBars(bars,'Fixture');assert.equal(app.model.signals.length,0);assert.equal(app.perf,null);
  app.state.symbol='BTC';app.state.tf='5m';app.setBars(bars,'Fixture');assert.equal(app.model.plans.length,0);
});
