import {randomUUID} from 'node:crypto';
const owner='11111111-1111-4111-8111-111111111111';
let seq=65,version=Date.now(),configured=true,failNext=false;const updated=()=>new Date(++version).toISOString();
const first={id:'44444444-4444-4444-8444-444444444444',reference:'PV-000001',userId:owner,name:'Vérification',subject:'Affichage du graphique',status:'open',createdAt:new Date().toISOString(),updatedAt:updated(),lastMessageAt:new Date().toISOString(),preview:'Les niveaux sont-ils disponibles ?',awaitingReply:true};
const second={...first,id:'55555555-5555-4555-8555-555555555555',reference:'PV-000002',subject:'Question sur les alertes',status:'resolved',updatedAt:updated(),preview:'Merci pour votre réponse.'};
const rows=[first,second],history=new Map([[first.id,Array.from({length:65},(_,i)=>({id:randomUUID(),seq:i+1,role:i%2?'admin':'customer',text:i===64?'<img src=x onerror=alert(1)>':`Message fictif ${i+1}`,createdAt:new Date(Date.now()-(65-i)*60000).toISOString()}))],[second.id,[{id:randomUUID(),seq:++seq,role:'admin',text:'Vous pouvez activer les alertes dans vos paramètres.',createdAt:new Date().toISOString()}]]]);
export function ticketControls(url){
  if(url.searchParams.has('tickets'))configured=url.searchParams.get('tickets')!=='0';if(url.searchParams.has('failTicketSend'))failNext=true;
  if(url.searchParams.has('ticketReply')){const row=rows.find(r=>r.id===url.searchParams.get('ticketReply'));if(row){row.updatedAt=updated();row.status='in_progress';row.lastMessageAt=row.updatedAt;history.get(row.id).push({id:randomUUID(),seq:++seq,role:'admin',text:'Nouvelle réponse fictive',createdAt:row.updatedAt})}}
  return {tickets:rows,messages:[...history.values()].flat().length};
}
export function ticketFixture(route,data,url,json,isAdmin){
  if(!route?.match(/^(admin\/)?support\//))return false;
  const admin=route.startsWith('admin/'),key=route.replace(/^admin\//,'');if(admin&&!isAdmin){json({error:'forbidden'},403);return true}
  const reply=(v,status)=>{json(v,status);return true};
  if(key==='support/tickets') {const filtered=rows.filter(r=>url.searchParams.get('status')==='all'||!url.searchParams.get('status')||r.status===url.searchParams.get('status'));return reply({configured,tickets:configured?filtered.slice(Number(url.searchParams.get('offset')||0),Number(url.searchParams.get('offset')||0)+50):[],hasMore:false})}
  if(key==='support/ticket/messages'){const row=rows.find(r=>r.id===url.searchParams.get('ticketId'));if(!row)return reply({error:'support_thread_not_found'},404);const after=Number(url.searchParams.get('after')),before=Number(url.searchParams.get('before')),messages=history.get(row.id).filter(m=>(!after||m.seq>after)&&(!before||m.seq<before));return reply({ticket:row,messages:after?messages.slice(0,50):messages.slice(-50),hasMore:messages.length>50})}
  if(key==='support/ticket/create'||key==='support/ticket/send'){
    let row=rows.find(r=>r.id===data.ticketId),existing=history.get(data.ticketId)?.find(m=>m.id===data.id);if(existing)return reply({ticket:row,message:existing});
    if(key.endsWith('/create')){row={...first,id:data.ticketId,reference:'PV-'+String(rows.length+1).padStart(6,'0'),subject:data.subject,status:'open',updatedAt:updated()};rows.unshift(row);history.set(row.id,[])}
    if(!row)return reply({error:'support_thread_not_found'},404);
    row.updatedAt=updated();row.lastMessageAt=row.updatedAt;row.status=admin?'in_progress':'open';row.preview=data.text;
    const message={id:data.id,seq:++seq,role:admin?'admin':'customer',text:data.text,createdAt:row.updatedAt};history.get(row.id).push(message);
    if(failNext){failNext=false;return reply({error:'fixture_unconfirmed'},503)}return reply({ticket:row,message});
  }
  if(key==='support/ticket/status'){const row=rows.find(r=>r.id===data.ticketId);if(!row)return reply({error:'support_thread_not_found'},404);if(row.updatedAt!==data.updatedAt)return reply({error:'support_ticket_conflict'},409);row.status=data.status;row.updatedAt=updated();return reply({ticket:row})}
  if(key==='support/messages')return reply({thread:{name:first.name,userId:owner},messages:history.get(first.id).slice(-50),hasMore:true});
  if(key==='support/inbox')return reply({threads:[],hasMore:false});
  return false;
}
