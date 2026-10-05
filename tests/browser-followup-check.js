(async()=>{
if(location.hostname!=='127.0.0.1'||window.BLH_AUTH?.user?.id!=='11111111-1111-4111-8111-111111111111')throw Error('Synthetic fixture only');
const results=[],wait=ms=>new Promise(r=>setTimeout(r,ms)),until=async(fn)=>{for(let i=0;i<80;i++){if(fn())return;await wait(100)}throw Error('timeout')},check=(name,pass,detail)=>{results.push({name,pass:!!pass,detail});if(!pass)throw Error(name+': '+JSON.stringify(detail))};
const route=async hash=>{location.hash=hash;await wait(200)},input=(selector,value)=>{const n=document.querySelector(selector);n.value=value;n.dispatchEvent(new Event('input',{bubbles:true}));return n};
await until(()=>PIPVORIA_WORKSPACE.getSnapshot().loaded);
await route('#history');
const a='22222222-2222-4222-8222-222222222222',b='33333333-3333-4333-8333-333333333333',row=id=>'[data-journal-id="'+id+'"]',originalFetch=window.fetch;
let release,held=false;
try{
window.fetch=async(...args)=>{const response=await originalFetch(...args);if(String(args[0]).includes('journal%2Fupdate')&&!held){held=true;await new Promise(resolve=>release=resolve)}return response};
input(row(a)+' [data-notes]','Saved note A');document.querySelector(row(a)+' [data-save-trade]').click();await until(()=>release);
const node=input(row(b)+' [data-notes]','UNSAVED DRAFT: keep this');node.focus();node.setSelectionRange(4,10);
input(row(b)+' [data-result-r]','1.25');
const target=document.querySelector(row(b)+' [data-target="2"]');target.checked=true;target.dispatchEvent(new Event('change',{bubbles:true}));
release();await wait(300);
check('another save preserves note draft',document.querySelector(row(b)+' [data-notes]').value==='UNSAVED DRAFT: keep this');
check('another save preserves result and target drafts',document.querySelector(row(b)+' [data-result-r]').value==='1.25'&&document.querySelector(row(b)+' [data-target="2"]').checked);
check('focus and selection restored',document.activeElement.matches(row(b)+' [data-notes]')&&document.activeElement.selectionStart===4&&document.activeElement.selectionEnd===10);
}finally{release?.();window.fetch=originalFetch}
await route('#performance');await route('#history');check('navigation preserves drafts',document.querySelector(row(b)+' [data-notes]').value==='UNSAVED DRAFT: keep this');
document.dispatchEvent(new Event('blh-language-change'));check('language rerender preserves drafts',document.querySelector(row(b)+' [data-notes]').value==='UNSAVED DRAFT: keep this');
await route('#settings');await wait(1200);
check('essential alert defaults',!document.querySelector('[data-preference="new_signal"]').checked&&!document.querySelector('[data-preference="signal_updates"]').checked&&document.querySelector('[data-preference="entry_zone"]').checked);
const before=await(await fetch('/api?route=settings')).json();
const external=await fetch('/api?route=settings',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({settings:{...before.settings,timezone:'Asia/Riyadh'},baseRevision:before.revision})});check('external edit saved',external.ok);
const expected=!before.settings.confirmedOnly;PIPVORIA_SETTINGS.update({confirmedOnly:expected});
await until(()=>PIPVORIA_SETTINGS.get().timezone==='Asia/Riyadh');
await until(()=>document.querySelector('#desk-sync').textContent==='Synchronisé');
const after=await(await fetch('/api?route=settings')).json();
check('browser rebases own field over remote settings',after.settings.timezone==='Asia/Riyadh'&&after.settings.confirmedOnly===expected,after.settings);
for(const prefix of ['smart-tp','blh-rr']){
const previous=[1,2,3].map(i=>document.querySelector('#'+prefix+i).value);
[3,2,1].forEach((v,i)=>input('#'+prefix+(i+1),String(v)));
check(prefix+' reversed values blocked',[1,2,3].every(i=>!document.querySelector('#'+prefix+i).checkValidity())&&!document.querySelector('#'+prefix+'-error').hidden);
check(prefix+' invalid values never synced',PIPVORIA_CORE.targetsValid(PIPVORIA_SETTINGS.get().indicators));
previous.forEach((v,i)=>input('#'+prefix+(i+1),v));
check(prefix+' valid values clear error',document.querySelector('#'+prefix+'-error').hidden);
}
const invalid={...PIPVORIA_SETTINGS.get(),indicators:{'smart-tp1':'3','smart-tp2':'2','smart-tp3':'1'}};
const dt=new DataTransfer();dt.items.add(new File([JSON.stringify(invalid)],'invalid.json',{type:'application/json'}));const file=document.querySelector('#desk-import');file.files=dt.files;file.dispatchEvent(new Event('change',{bubbles:true}));await wait(100);
check('invalid imported targets rejected',document.querySelector('#desk-sync').textContent==='Fichier de paramètres invalide');
document.querySelector('[data-preference="signal_updates"]').click();await wait(200);
const time=Date.now(),signal={key:'grouped-browser-'+time,time,confirmed:true,engine:'planner',status:'active',direction:'buy',entry:100,stopLoss:90,takeProfits:[110,120,130]},snapshot={symbol:'XAU/USD',interval:'15min',signal,price:100,bar:{time,high:100,low:100}};
const emit=signal=>document.dispatchEvent(new CustomEvent('pipvoria-watch-state',{detail:{...snapshot,signal}}));
emit(signal);emit({...signal,stopLoss:91});emit({...signal,stopLoss:92});emit({...signal,stopLoss:93});await wait(200);
const alerts=(await(await fetch('/__verify')).json()).notifications.filter(n=>n.metadata?.key===signal.key);
check('stop changes grouped without blocking entry',alerts.filter(n=>n.metadata.event.startsWith('update-')).length===1&&alerts.some(n=>n.metadata.event==='entry'),alerts.map(n=>n.metadata.event));
const outcome={...signal,status:'historical',exitReason:'stop',targetHits:[true,false,false]};
document.dispatchEvent(new CustomEvent('pipvoria-watch-state',{detail:{...snapshot,signal:null,transitions:[outcome]}}));await wait(200);
const exit=(await(await fetch('/__verify')).json()).notifications.filter(n=>n.metadata?.key===signal.key).map(n=>n.metadata.event);
check('watcher closure delivers TP and stop without cancellation',exit.includes('tp1')&&exit.includes('stop')&&!exit.includes('cancel'),exit);
check('no JavaScript errors',window.__uiErrors.length===0,window.__uiErrors);
window.__followupResults=results;
return results;
})()
