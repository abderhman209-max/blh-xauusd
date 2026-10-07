// Dependencies retain the site's verified session, origin and service-role boundaries.
export function ticketApi({currentSession,requireSuperAdmin,supabaseData,supabaseAdminData,sessionJson,json,body,uuid,publicUser,validatedSessionId}) {
  const fields='id,number,user_id,user_name,subject,status,created_at,updated_at,last_message_at,last_sender_role,last_message_preview';
  const messageFields='id,seq,sender_role,body,created_at';
  const ticket=row=>({id:row.id,reference:'PV-'+String(row.number).padStart(6,'0'),userId:row.user_id,name:row.user_name,
    subject:row.subject,status:row.status,createdAt:row.created_at,updatedAt:row.updated_at,lastMessageAt:row.last_message_at,
    awaitingReply:row.last_sender_role==='customer',preview:row.last_message_preview});
  const message=row=>({id:row.id,seq:Number(row.seq),role:row.sender_role,text:row.body,createdAt:row.created_at});
  const cursor=value=>value===null?null:/^[1-9]\d{0,15}$/.test(value)&&Number.isSafeInteger(Number(value))?Number(value):false;
  const clean=(value,min,max,line=false)=>typeof value==='string'&&Array.from(value.trim()).length>=min&&Array.from(value.trim()).length<=max&&
    !(line?/[\u0000-\u001f\u007f]/:/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/).test(value);
  async function failure(response) {
    const result=await response.json().catch(()=>({}));
    if(result.message==='session_replaced')throw Error('session_replaced');
    const codes={support_forbidden:403,support_rate_limit:429,support_message_conflict:409,support_ticket_conflict:409,
      support_thread_not_found:404,invalid_support_message:400,invalid_support_status:400};
    return json({error:Object.hasOwn(codes,result.message)?result.message:'support_unavailable'},codes[result.message]||503);
  }
  return async function handle(request,url,admin,action) {
    const auth=admin?await requireSuperAdmin(request):{session:await currentSession(request)};
    if(auth.error)return auth.error;
    const session=auth.session;if(!session)return json({error:'authentication_required'},401);
    const read=path=>admin?supabaseAdminData(path):supabaseData(path,session.accessToken);
    const owner=admin?'':`&user_id=eq.${session.user.id}`;
    if(action==='list') {
      const offset=url.searchParams.get('offset')||'0',status=url.searchParams.get('status')||'all';
      if(!/^\d{1,5}$/.test(offset)||Number(offset)>10000)return json({error:'invalid_support_cursor'},400);
      if(!['all','open','in_progress','resolved'].includes(status))return json({error:'invalid_support_status'},400);
      const response=await read(`support_tickets?select=${fields}${owner}${status==='all'?'':`&status=eq.${status}`}&order=last_message_at.desc,id.asc&limit=51&offset=${Number(offset)}`);
      if(!response.ok) {
        const error=await response.json().catch(()=>({}));
        // Explicit capability response permits deployment before the additive migration.
        if(error.code==='PGRST205'||error.code==='42P01')return sessionJson({configured:false,tickets:[],hasMore:false},200,session);
        return json({error:'support_unavailable'},503);
      }
      const rows=await response.json();return sessionJson({configured:true,tickets:rows.slice(0,50).map(ticket),hasMore:rows.length>50},200,session);
    }
    if(action==='messages') {
      const id=url.searchParams.get('ticketId'),before=cursor(url.searchParams.get('before')),after=cursor(url.searchParams.get('after'));
      if(!uuid(id))return json({error:'invalid_support_thread'},400);
      if(before===false||after===false||before!==null&&after!==null)return json({error:'invalid_support_cursor'},400);
      const response=await read(`support_tickets?select=${fields}&id=eq.${id}${owner}&limit=1`);
      if(!response.ok)return json({error:'support_unavailable'},503);
      const rows=await response.json();if(!rows.length)return json({error:'support_thread_not_found'},404);
      const filter=before!==null?`&seq=lt.${before}`:after!==null?`&seq=gt.${after}`:'';
      const history=await read(`support_ticket_messages?select=${messageFields}&ticket_id=eq.${id}${filter}&order=seq.${after!==null?'asc':'desc'}&limit=51`);
      if(!history.ok)return json({error:'support_unavailable'},503);
      const messages=await history.json(),page=messages.slice(0,50).map(message);if(after===null)page.reverse();
      return sessionJson({ticket:ticket(rows[0]),messages:page,hasMore:messages.length>50},200,session);
    }
    const data=await body(request);
    const identity={p_ticket_id:data.ticketId,p_sender_id:session.user.id,p_session_id:validatedSessionId(session.accessToken,session.user),p_admin:admin};
    if(action==='status') {
      if(!uuid(data.ticketId)||!['open','in_progress','resolved'].includes(data.status)||!admin&&data.status==='in_progress'||
        typeof data.updatedAt!=='string'||!/^\d{4}-\d{2}-\d{2}T/.test(data.updatedAt)||!Number.isFinite(Date.parse(data.updatedAt)))return json({error:'invalid_support_status'},400);
      const response=await supabaseAdminData('rpc/pipvoria_ticket_status',{method:'POST',body:JSON.stringify({...identity,p_status:data.status,p_updated_at:data.updatedAt})});
      if(!response.ok)return failure(response);return sessionJson({ticket:ticket(await response.json())},200,session);
    }
    const create=action==='create';
    if(!uuid(data.ticketId)||!uuid(data.id)||!clean(data.text,1,2000)||create&&(admin||!clean(data.subject,3,100,true)))return json({error:'invalid_support_message'},400);
    const response=await supabaseAdminData('rpc/pipvoria_ticket_send',{method:'POST',body:JSON.stringify({...identity,p_message_id:data.id,
      p_subject:create?data.subject.trim():null,p_body:data.text.trim(),p_create:create,
      p_user_name:String(publicUser(session.user).name).replace(/[\u0000-\u001f\u007f]/g,'').slice(0,80)})});
    if(!response.ok)return failure(response);
    const saved=await response.json();return sessionJson({ticket:ticket(saved.ticket),message:message(saved.message)},200,session);
  };
}
