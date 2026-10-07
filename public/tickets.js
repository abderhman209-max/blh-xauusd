(function () {
  'use strict';
  const copy={
    title:['Support tickets','Support-Anfragen','Demandes de support','Solicitudes de soporte','طلبات الدعم','طلبات الدعم'],
    sub:['Follow your requests and the team’s replies here.','Anfragen und Antworten des Teams verfolgen.','Retrouvez vos demandes et les réponses de l’équipe.','Consulta tus solicitudes y las respuestas del equipo.','تابع طلباتك وردود الفريق هنا.','تابع الطلبات ديالك وجواب الفريق هنا.'],
    new:['New request','Neue Anfrage','Nouvelle demande','Nueva solicitud','طلب جديد','طلب جديد'],
    subject:['Subject','Betreff','Objet','Asunto','الموضوع','الموضوع'],
    subjectHint:['Briefly describe the problem','Problem kurz beschreiben','Décrivez brièvement le problème','Describe brevemente el problema','صف المشكلة باختصار','وصف المشكل باختصار'],
    message:['Message','Nachricht','Message','Mensaje','الرسالة','الرسالة'],
    send:['Send','Senden','Envoyer','Enviar','إرسال','صيفط'],
    create:['Create request','Anfrage erstellen','Créer la demande','Crear solicitud','إنشاء الطلب','إنشاء الطلب'],
    cancel:['Cancel','Abbrechen','Annuler','Cancelar','إلغاء','إلغاء'],
    all:['All requests','Alle Anfragen','Toutes les demandes','Todas las solicitudes','كل الطلبات','كل الطلبات'],
    open:['Open','Offen','Ouvert','Abierta','مفتوح','مفتوح'],
    in_progress:['In progress','In Bearbeitung','En cours','En curso','قيد المعالجة','قيد المعالجة'],
    resolved:['Resolved','Gelöst','Résolu','Resuelta','تم الحل','تم الحل'],
    status:['Request status','Anfragestatus','Statut de la demande','Estado de la solicitud','حالة الطلب','حالة الطلب'],
    empty:['No requests in this view.','Keine Anfragen in dieser Ansicht.','Aucune demande dans cette liste.','No hay solicitudes en esta vista.','لا توجد طلبات في هذه القائمة.','ما كايناش طلبات فهاد القائمة.'],
    choose:['Select a request to view the conversation.','Anfrage auswählen, um die Unterhaltung zu öffnen.','Sélectionnez une demande pour afficher la conversation.','Selecciona una solicitud para ver la conversación.','اختر طلباً لعرض المحادثة.','ختار طلب باش تشوف المحادثة.'],
    refresh:['Refresh','Aktualisieren','Actualiser','Actualizar','تحديث','تحديث'],
    more:['Load more','Weitere laden','Afficher plus','Cargar más','عرض المزيد','عرض المزيد'],
    older:['Earlier messages','Ältere Nachrichten','Messages précédents','Mensajes anteriores','الرسائل السابقة','الرسائل السابقة'],
    back:['All requests','Alle Anfragen','Liste des demandes','Lista de solicitudes','قائمة الطلبات','قائمة الطلبات'],
    close:['Mark resolved','Als gelöst markieren','Marquer comme résolu','Marcar resuelta','تحديد كمحلول','تحديد كمحلول'],
    reopen:['Reopen','Wieder öffnen','Rouvrir','Reabrir','إعادة فتح','عاود فتح'],
    you:['You','Du','Vous','Tú','أنت','نتا'],
    team:['Support team','Support-Team','Équipe support','Equipo de soporte','فريق الدعم','فريق الدعم'],
    member:['Member','Mitglied','Membre','Miembro','عضو','عضو'],
    last:['Last message','Letzte Nachricht','Dernier message','Último mensaje','آخر رسالة','آخر رسالة'],
    privacy:['Private · Visible only to you and site administrators.','Privat · Nur du und die Website-Admins können mitlesen.','Privé · Visible uniquement par vous et les administrateurs du site.','Privado · Solo tú y los administradores pueden leerlo.','خاص · متاح لك ولمشرفي الموقع فقط.','خاص · غير نتا ومشرفين الموقع يقدرو يشوفوه.'],
    loading:['Loading…','Wird geladen…','Chargement…','Cargando…','جارٍ التحميل…','كنحمّل…'],
    sending:['Sending…','Wird gesendet…','Envoi…','Enviando…','جارٍ الإرسال…','كنصيفط…'],
    sent:['Message sent.','Nachricht gesendet.','Message envoyé.','Mensaje enviado.','تم إرسال الرسالة.','تصيفطات الرسالة.'],
    saved:['Status updated.','Status aktualisiert.','Statut mis à jour.','Estado actualizado.','تم تحديث الحالة.','تحدثات الحالة.'],
    error:['Unable to load. Retry.','Laden fehlgeschlagen. Erneut versuchen.','Chargement impossible. Réessayez.','No se pudo cargar. Reintenta.','تعذر التحميل. أعد المحاولة.','ما تحملش. عاود جرب.'],
    failed:['Send not confirmed. Your draft is kept; retry to check or send.','Senden nicht bestätigt. Entwurf bleibt erhalten; erneut versuchen.','Envoi non confirmé. Votre brouillon est conservé ; réessayez pour vérifier ou envoyer.','Envío sin confirmar. Se conserva tu borrador; reintenta.','لم يتأكد الإرسال. تم حفظ المسودة؛ أعد المحاولة للتحقق أو الإرسال.','الإرسال ما تأكدش. المسودة باقية؛ عاود جرب.'],
    conflict:['A newer reply changed this request. Review it and retry.','Neue Antwort vorhanden. Prüfen und erneut versuchen.','Une réponse plus récente a modifié cette demande. Relisez-la et réessayez.','Una respuesta nueva modificó la solicitud. Revísala y reintenta.','تغير الطلب برد أحدث. راجعه وأعد المحاولة.','كاين جواب جديد. راجعو وعاود جرب.'],
    rate:['Too many requests. Wait one minute.','Zu viele Anfragen. Eine Minute warten.','Trop de demandes. Attendez une minute.','Demasiadas solicitudes. Espera un minuto.','طلبات كثيرة. انتظر دقيقة.','طلبات بزاف. تسنى دقيقة.'],
    invalid:['Subject: 3–100 characters. Message: 1–2,000 characters.','Betreff: 3–100 Zeichen. Nachricht: 1–2.000 Zeichen.','Objet : 3 à 100 caractères. Message : 1 à 2 000 caractères.','Asunto: 3–100 caracteres. Mensaje: 1–2.000 caracteres.','الموضوع: 3–100 حرف. الرسالة: 1–2000 حرف.','الموضوع: 3–100 حرف. الرسالة: 1–2000 حرف.']
  };
  const t=key=>copy[key]?.[({en:0,de:1,fr:2,es:3,ar:4,ary:5})[document.documentElement.lang]??0]||key;
  const node=(tag,cls='',text)=>{const n=document.createElement(tag);n.className=cls;if(text!==undefined)n.textContent=text;return n};
  const label=key=>`<span data-ticket-copy="${key}"></span>`;
  const date=value=>new Date(value).toLocaleString(document.documentElement.lang==='ary'?'ar-MA':document.documentElement.lang,{dateStyle:'short',timeStyle:'short'});
  let accountId=null,epoch=0,capability=false;
  function workspace(admin) {
    const old=document.querySelector(admin?'#view-admin .support-panel':'#view-support .support-panel');if(!old)return null;
    const box=node('section','ticket-workspace support-panel surface');box.hidden=true;old.after(box);
    box.innerHTML=`<header class="support-heading"><div><h2>${label('title')}</h2><p>${label('sub')}</p></div><div class="ticket-actions"><button type="button" data-ticket-refresh>${label('refresh')}</button>${admin?'':`<button type="button" class="support-send" data-ticket-new>${label('new')}</button>`}</div></header>
      <div class="ticket-grid"><aside class="ticket-list-pane"><label class="ticket-filter-label">${label('title')}<select data-ticket-filter></select></label><div class="ticket-list"></div><button type="button" data-ticket-more hidden>${label('more')}</button></aside>
      <div class="ticket-chat-pane"><button type="button" class="ticket-back" data-ticket-back>${label('back')}</button><div class="ticket-selected-header"></div><div class="ticket-empty"></div>
      <form class="ticket-create" hidden><label>${label('subject')}<input name="subject" minlength="3" maxlength="100" required></label><label>${label('message')}<textarea name="text" rows="5" maxlength="2000" required></textarea></label><footer><button type="button" data-ticket-cancel>${label('cancel')}</button><button class="support-send" type="submit">${label('create')}</button></footer></form>
      <div class="ticket-conversation" hidden><button type="button" data-ticket-older hidden>${label('older')}</button><div class="support-messages" role="log" aria-live="polite" aria-relevant="additions"></div><form class="support-compose"><label>${label('message')}<textarea rows="3" maxlength="2000" required></textarea></label><footer><small class="support-count">0 / 2000</small><button class="support-send" type="submit">${label('send')}</button></footer></form></div>
      </div></div><p class="support-status" role="status" aria-live="polite"></p><p class="support-privacy">${label('privacy')}</p>`;
    const s={admin,box,old,rows:[],selected:null,messages:[],drafts:new Map(),version:0,listEpoch:0,loading:false,listing:false,sending:false,hasOlder:false,hasMore:false,filter:'all',creating:false,status:'',createRetry:null};
    s.input=box.querySelector('.support-compose textarea');s.createForm=box.querySelector('.ticket-create');s.subject=s.createForm.elements.subject;s.createText=s.createForm.elements.text;
    box.querySelector('[data-ticket-refresh]').onclick=()=>refresh(s);
    box.querySelector('[data-ticket-more]').onclick=()=>list(s,true);
    box.querySelector('[data-ticket-older]').onclick=()=>messages(s,'older');
    box.querySelector('[data-ticket-new]')?.addEventListener('click',()=>{if(s.sending)return;s.version++;s.loading=false;s.creating=true;render(s);s.subject.focus()});
    box.querySelector('[data-ticket-cancel]').onclick=()=>{s.creating=false;render(s)};
    box.querySelector('[data-ticket-back]').onclick=()=>{if(s.sending)return;s.version++;s.loading=false;s.creating=false;s.selected=null;s.messages=[];render(s)};
    box.querySelector('[data-ticket-filter]').onchange=event=>{s.filter=event.target.value;s.listEpoch++;s.listing=false;list(s)};
    box.querySelector('.support-compose').onsubmit=event=>{event.preventDefault();send(s,false)};
    s.createForm.onsubmit=event=>{event.preventDefault();send(s,true)};
    s.input.oninput=()=>{if(s.selected)s.drafts.set(s.selected.id,{text:s.input.value});count(s)};
    for(const input of [s.subject,s.createText])input.addEventListener('input',()=>{s.createRetry=null});
    return s;
  }
  const states=[workspace(false),workspace(true)].filter(Boolean);
  const active=s=>accountId&&window.BLH_AUTH?.user?.id===accountId&&!document.hidden&&(s.admin?location.hash==='#admin'&&window.BLH_AUTH.user.isAdmin:location.hash==='#support');
  async function api(s,action,params={},data) {
    const requestEpoch=epoch;
    const route=(s.admin?'admin/':'')+'support/'+(action==='list'?'tickets':'ticket/'+action);
    const response=await fetch('/api?'+new URLSearchParams({route,...params}),{credentials:'same-origin',cache:'no-store',...(data?{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(data)}:{})});
    const result=await response.json().catch(()=>({}));
    if(response.status===401&&requestEpoch===epoch&&accountId)document.dispatchEvent(new CustomEvent('blh-session-expired',{detail:{reason:result.error}}));
    if(!response.ok)throw Object.assign(Error('ticket request failed'),{code:result.error});return result;
  }
  function status(s,key,failure=false){s.status=key;const n=s.box.querySelector('.support-status');n.textContent=key?t(key):'';n.classList.toggle('support-error',failure)}
  function count(s){s.box.querySelector('.support-count').textContent=`${s.input.value.length} / 2000`}
  function controls(s){
    s.box.querySelectorAll('.ticket-create input,.ticket-create textarea,.ticket-create button,.support-compose textarea,.support-compose button,[data-ticket-new],[data-ticket-back],[data-ticket-cancel],.ticket-thread,.ticket-status-edit').forEach(n=>n.disabled=s.sending);
    s.box.querySelector('[data-ticket-older]').disabled=s.loading;s.box.querySelector('[data-ticket-older]').hidden=!s.hasOlder;
    s.box.querySelector('[data-ticket-more]').disabled=s.listing;s.box.querySelector('[data-ticket-more]').hidden=!s.hasMore;
  }
  function renderList(s){
    const list=s.box.querySelector('.ticket-list');list.replaceChildren();
    if(!s.rows.length)list.append(node('p','support-empty',t('empty')));
    for(const row of s.rows){
      const button=node('button','ticket-thread'+(s.selected?.id===row.id?' selected':''));button.type='button';button.dataset.ticketId=row.id;
      button.setAttribute('aria-pressed',String(s.selected?.id===row.id));
      const top=node('div','ticket-thread-top');top.append(node('small','ticket-reference',row.reference),node('span','ticket-status ticket-status-'+row.status,t(row.status)));
      button.append(top,node('strong','',row.subject));if(s.admin)button.append(node('small','ticket-member',row.name||t('member')));
      button.append(node('p','support-thread-preview',row.preview));const time=node('time','',t('last')+' · '+date(row.lastMessageAt));time.dateTime=row.lastMessageAt;button.append(time);
      button.onclick=()=>choose(s,row);list.append(button);
    }
    controls(s);
  }
  function renderHeader(s){
    const head=s.box.querySelector('.ticket-selected-header');head.replaceChildren();
    if(s.creating){head.append(node('h3','',t('new')));return}if(!s.selected)return;
    const row=s.selected;head.append(node('small','ticket-reference',row.reference),node('h3','',row.subject));
    const action=node('div','ticket-heading-state');action.append(node('span','ticket-status ticket-status-'+row.status,t(row.status)));
    if(s.admin){const select=node('select','ticket-status-edit');select.setAttribute('aria-label',t('status'));
      for(const key of ['open','in_progress','resolved']){const option=node('option','',t(key));option.value=key;option.selected=key===row.status;select.append(option)}
      select.onchange=()=>changeStatus(s,select.value);action.append(select);
    }else{const button=node('button','ticket-status-edit',t(row.status==='resolved'?'reopen':'close'));button.type='button';button.onclick=()=>changeStatus(s,row.status==='resolved'?'open':'resolved');action.append(button)}
    head.append(action);controls(s);
  }
  function renderMessages(s,bottom=false){
    const log=s.box.querySelector('.support-messages'),nearBottom=log.scrollHeight-log.scrollTop-log.clientHeight<60;log.replaceChildren();
    for(const message of s.messages){const own=message.role===(s.admin?'admin':'customer');const article=node('article','support-message '+(own?'support-outgoing':'support-incoming'));
      const meta=node('header','support-message-meta'),time=node('time','',date(message.createdAt));time.dateTime=message.createdAt;meta.append(node('strong','',t(own?'you':s.admin?'member':'team')),time);
      article.append(meta,node('p','support-message-body',message.text));log.append(article)}
    if(nearBottom||bottom)log.scrollTop=log.scrollHeight;renderHeader(s);controls(s);
  }
  function render(s){
    s.box.classList.toggle('ticket-has-selection',s.creating||!!s.selected);
    s.box.querySelector('.ticket-empty').textContent=!s.creating&&!s.selected?t('choose'):'';
    s.createForm.hidden=!s.creating;s.box.querySelector('.ticket-conversation').hidden=s.creating||!s.selected;
    renderList(s);renderMessages(s);count(s);
  }
  function choose(s,row){if(s.sending)return;s.version++;s.creating=false;s.loading=false;s.selected=row;s.messages=[];s.hasOlder=false;
    s.input.value=s.drafts.get(row.id)?.text||'';status(s,'');render(s);messages(s,'initial')}
  function merge(s,rows){const map=new Map(s.messages.map(m=>[m.id,m]));for(const row of rows)map.set(row.id,row);s.messages=[...map.values()].sort((a,b)=>a.seq-b.seq)}
  async function list(s,more=false){
    if(s.listing||!active(s))return;const currentEpoch=epoch,listEpoch=s.listEpoch;s.listing=true;controls(s);
    try{const result=await api(s,'list',{offset:more?s.rows.length:0,status:s.filter});if(epoch!==currentEpoch||listEpoch!==s.listEpoch)return;
      if(result.configured===false){s.box.hidden=true;s.old.hidden=false;return}
      capability=true;window.PIPVORIA_TICKETS_ACTIVE=true;for(const state of states){state.old.hidden=true;state.box.hidden=false}
      s.rows=more?[...new Map([...s.rows,...result.tickets].map(row=>[row.id,row])).values()]:result.tickets;s.hasMore=result.hasMore;
      renderList(s);if(s.status==='error')status(s,'');
    }catch{if(epoch===currentEpoch&&listEpoch===s.listEpoch&&capability)status(s,'error',true)}
    finally{if(epoch===currentEpoch&&listEpoch===s.listEpoch){s.listing=false;controls(s)}}
  }
  async function messages(s,mode='new'){
    if(!active(s)||!s.selected||s.creating||s.loading||s.sending)return;
    const version=s.version,currentEpoch=epoch,params={ticketId:s.selected.id},log=s.box.querySelector('.support-messages');
    if(mode==='new'&&s.messages.length)params.after=s.messages.at(-1).seq;if(mode==='older'&&s.messages.length)params.before=s.messages[0].seq;
    const height=log.scrollHeight,scroll=log.scrollTop;s.loading=true;controls(s);if(mode==='initial')status(s,'loading');
    try{const result=await api(s,'messages',params);if(epoch!==currentEpoch||version!==s.version)return;s.selected=result.ticket;merge(s,result.messages);
      if(mode!=='new')s.hasOlder=result.hasMore;renderMessages(s,mode==='initial');if(mode==='older')log.scrollTop=scroll+log.scrollHeight-height;
      if(s.status==='loading'||s.status==='error')status(s,'');
    }catch{if(epoch===currentEpoch&&version===s.version)status(s,'error',true)}finally{if(epoch===currentEpoch&&version===s.version){s.loading=false;controls(s)}}
  }
  async function refresh(s){await list(s);await messages(s)}
  async function send(s,create){
    if(!active(s)||s.sending||!create&&!s.selected)return;const input=create?s.createText:s.input,text=input.value.trim(),subject=s.subject.value.trim();
    if(!text||Array.from(text).length>2000||/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(text)||create&&(Array.from(subject).length<3||Array.from(subject).length>100||/[\u0000-\u001f\u007f]/.test(subject))){status(s,'invalid',true);return}
    let retry=create?s.createRetry:s.drafts.get(s.selected.id);
    if(!retry?.id||retry.text!==text||create&&retry.subject!==subject)retry={id:crypto.randomUUID(),ticketId:create?crypto.randomUUID():s.selected.id,text,...(create?{subject}:{})};
    if(create)s.createRetry=retry;else s.drafts.set(s.selected.id,retry);
    s.version++;s.loading=false;const version=s.version,currentEpoch=epoch;s.sending=true;controls(s);status(s,'sending');
    try{const result=await api(s,create?'create':'send',{},retry);if(epoch!==currentEpoch||version!==s.version)return;
      if(create){s.messages=[];s.hasOlder=false;s.createRetry=null;s.subject.value='';s.createText.value='';s.creating=false;s.filter='all';s.box.querySelector('[data-ticket-filter]').value='all'}
      s.selected=result.ticket;s.drafts.delete(result.ticket.id);s.input.value='';merge(s,[result.message]);render(s);renderMessages(s,true);status(s,'sent');await list(s);
    }catch(error){if(epoch===currentEpoch&&version===s.version)status(s,error.code==='support_rate_limit'?'rate':error.code==='invalid_support_message'?'invalid':'failed',true)}
    finally{if(epoch===currentEpoch&&version===s.version){s.sending=false;controls(s)}}
  }
  async function changeStatus(s,value){
    if(!active(s)||s.sending||!s.selected)return;s.version++;s.loading=false;const version=s.version,currentEpoch=epoch;s.sending=true;controls(s);
    try{const result=await api(s,'status',{}, {ticketId:s.selected.id,status:value,updatedAt:s.selected.updatedAt});if(epoch!==currentEpoch||version!==s.version)return;s.selected=result.ticket;renderHeader(s);status(s,'saved');await list(s)}
    catch(error){if(epoch===currentEpoch&&version===s.version){status(s,error.code==='support_ticket_conflict'?'conflict':'error',true);s.sending=false;await messages(s);renderHeader(s)}}
    finally{if(epoch===currentEpoch&&version===s.version){s.sending=false;controls(s)}}
  }
  function translate(){for(const s of states){s.box.querySelectorAll('[data-ticket-copy]').forEach(n=>n.textContent=t(n.dataset.ticketCopy));
    const select=s.box.querySelector('[data-ticket-filter]');select.replaceChildren();for(const key of ['all','open','in_progress','resolved']){const option=node('option','',t(key));option.value=key;option.selected=key===s.filter;select.append(option)}
    s.subject.placeholder=t('subjectHint');s.box.querySelector('.support-status').textContent=s.status?t(s.status):'';render(s)}}
  function reset(){epoch++;capability=false;window.PIPVORIA_TICKETS_ACTIVE=false;for(const s of states){s.version++;s.listEpoch++;s.rows=[];s.messages=[];s.selected=null;s.creating=false;s.loading=false;s.listing=false;s.sending=false;s.hasOlder=false;s.hasMore=false;s.filter='all';s.drafts.clear();s.createRetry=null;s.subject.value='';s.createText.value='';s.input.value='';s.box.hidden=true;s.old.hidden=false;status(s,'');render(s)}}
  function poll(){for(const s of states)if(active(s))refresh(s)}
  document.addEventListener('blh-authenticated',event=>{reset();accountId=event.detail.user.id;poll()});
  document.addEventListener('blh-session-expired',()=>{accountId=null;reset()});document.addEventListener('blh-language-change',translate);
  window.addEventListener('hashchange',poll);document.addEventListener('visibilitychange',()=>{if(!document.hidden)poll()});setInterval(poll,15000);
  accountId=window.BLH_AUTH?.user?.id||null;translate();poll();
})();
