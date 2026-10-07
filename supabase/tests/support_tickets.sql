-- Isolated synthetic accounts, sessions and messages. No test data survives this transaction.
begin;
do $$ declare owner_id uuid:=gen_random_uuid(); other_id uuid:=gen_random_uuid(); admin_id uuid:=gen_random_uuid(); sid uuid:=gen_random_uuid();
begin
  insert into auth.users(id,raw_app_meta_data) values(owner_id,'{}'),(other_id,'{}'),(admin_id,'{"role":"super_admin"}');
  insert into auth.sessions(id,user_id,created_at,updated_at) values(sid,owner_id,now(),now()),(gen_random_uuid(),other_id,now(),now()),(gen_random_uuid(),admin_id,now(),now());
  perform public.pipvoria_claim_session(owner_id,sid);
  perform public.pipvoria_claim_session(other_id,(select id from auth.sessions where user_id=other_id limit 1));
  perform public.pipvoria_claim_session(admin_id,(select id from auth.sessions where user_id=admin_id limit 1));
  perform set_config('ticket.owner',owner_id::text,true);perform set_config('ticket.other',other_id::text,true);perform set_config('ticket.admin',admin_id::text,true);
  perform set_config('ticket.session',sid::text,true);perform set_config('ticket.id',gen_random_uuid()::text,true);perform set_config('ticket.message',gen_random_uuid()::text,true);
  perform set_config('ticket.adminsession',(select id::text from auth.sessions where user_id=admin_id limit 1),true);
  perform set_config('ticket.othersession',(select id::text from auth.sessions where user_id=other_id limit 1),true);
end $$;
set local role service_role;
do $$ declare owner_id uuid:=current_setting('ticket.owner')::uuid; other_id uuid:=current_setting('ticket.other')::uuid;
  sid uuid:=current_setting('ticket.session')::uuid; tid uuid:=current_setting('ticket.id')::uuid; mid uuid:=current_setting('ticket.message')::uuid;
  saved jsonb; again jsonb; replied jsonb; resolved jsonb; version timestamptz; i integer;
begin
  saved:=public.pipvoria_ticket_send(tid,mid,owner_id,sid,false,'Chart problem','Synthetic question','Test',true);
  again:=public.pipvoria_ticket_send(tid,mid,owner_id,sid,false,'Chart problem','Synthetic question','Test',true);
  if saved->'message'->>'seq'<>again->'message'->>'seq' then raise exception 'Duplicate ticket message'; end if;
  if (select count(*) from public.support_tickets where id=tid)<>1 then raise exception 'Duplicate ticket'; end if;
  begin
    perform public.pipvoria_ticket_send(tid,mid,owner_id,sid,false,'Changed subject','Synthetic question','Test',true);
    raise exception 'Changed create accepted';
  exception when others then if sqlerrm<>'support_message_conflict' then raise; end if; end;
  begin
    perform public.pipvoria_ticket_send(tid,gen_random_uuid(),other_id,current_setting('ticket.othersession')::uuid,false,null,'Foreign ticket','Test',false);
    raise exception 'Foreign ticket accepted';
  exception when others then if sqlerrm<>'support_thread_not_found' then raise; end if; end;
  begin
    perform public.pipvoria_ticket_send(tid,gen_random_uuid(),other_id,current_setting('ticket.othersession')::uuid,true,null,'Forged administrator','Test',false);
    raise exception 'Forged administrator accepted';
  exception when others then if sqlerrm<>'support_forbidden' then raise; end if; end;
  version:=(saved->'ticket'->>'updated_at')::timestamptz;
  replied:=public.pipvoria_ticket_send(tid,gen_random_uuid(),current_setting('ticket.admin')::uuid,current_setting('ticket.adminsession')::uuid,true,null,'Synthetic response','Test',false);
  if replied->'ticket'->>'status'<>'in_progress' then raise exception 'Reply state incorrect'; end if;
  begin
    perform public.pipvoria_ticket_status(tid,owner_id,sid,false,'resolved',version);
    raise exception 'Stale closure accepted';
  exception when others then if sqlerrm<>'support_ticket_conflict' then raise; end if; end;
  resolved:=public.pipvoria_ticket_status(tid,owner_id,sid,false,'resolved',(replied->'ticket'->>'updated_at')::timestamptz);
  if resolved->>'status'<>'resolved' then raise exception 'Closure failed'; end if;
  saved:=public.pipvoria_ticket_send(tid,gen_random_uuid(),owner_id,sid,false,null,'Another question','Test',false);
  if saved->'ticket'->>'status'<>'open' then raise exception 'Customer reply did not reopen'; end if;
  perform public.pipvoria_ticket_send(gen_random_uuid(),gen_random_uuid(),owner_id,sid,false,'Second problem','Independent ticket','Test',true);
  perform public.pipvoria_ticket_send(gen_random_uuid(),gen_random_uuid(),other_id,current_setting('ticket.othersession')::uuid,false,'Private problem','Other account','Test',true);
  perform public.pipvoria_support_send(owner_id,owner_id,sid,gen_random_uuid(),'customer','Legacy browser message','Test');
  if not exists(select 1 from public.support_ticket_messages m join public.support_tickets t on t.id=m.ticket_id
    where t.legacy_user_id=owner_id and m.body='Legacy browser message') then raise exception 'Legacy message lost'; end if;
  for i in 1..6 loop perform public.pipvoria_ticket_send(tid,gen_random_uuid(),owner_id,sid,false,null,'Rate test','Test',false); end loop;
  begin
    perform public.pipvoria_ticket_send(tid,gen_random_uuid(),owner_id,sid,false,null,'Eleventh message','Test',false);
    raise exception 'Rate limit absent';
  exception when others then if sqlerrm<>'support_rate_limit' then raise; end if; end;
  perform public.pipvoria_ticket_send(tid,mid,owner_id,sid,false,'Chart problem','Synthetic question','Test',true);
end $$;
set local role authenticated;
do $$ declare owner_id uuid:=current_setting('ticket.owner')::uuid; other_id uuid:=current_setting('ticket.other')::uuid; tid uuid:=current_setting('ticket.id')::uuid;
begin
  perform set_config('request.jwt.claims',jsonb_build_object('sub',owner_id,'role','authenticated','session_id',current_setting('ticket.session'))::text,true);
  if not exists(select 1 from public.support_ticket_messages where ticket_id=tid) then raise exception 'Owner cannot read messages'; end if;
  if exists(select 1 from public.support_tickets where user_id=other_id) then raise exception 'Ticket RLS failed'; end if;
  if has_table_privilege('authenticated','public.support_tickets','UPDATE') or has_table_privilege('authenticated','public.support_ticket_messages','INSERT')
    or has_function_privilege('authenticated','public.pipvoria_ticket_send(uuid,uuid,uuid,uuid,boolean,text,text,text,boolean)','EXECUTE') then raise exception 'Direct mutation allowed'; end if;
  perform set_config('request.jwt.claims',jsonb_build_object('sub',other_id,'role','authenticated','session_id',current_setting('ticket.othersession'),'user_metadata',jsonb_build_object('role','super_admin'))::text,true);
  if exists(select 1 from public.support_ticket_messages where ticket_id=tid) then raise exception 'Foreign messages exposed'; end if;
  perform set_config('request.jwt.claims',jsonb_build_object('sub',owner_id,'role','authenticated','session_id',gen_random_uuid())::text,true);
  if exists(select 1 from public.support_tickets where user_id=owner_id) then raise exception 'Replaced session reads tickets'; end if;
end $$;
set local role anon;
do $$ begin
  if has_table_privilege('anon','public.support_tickets','SELECT') or has_table_privilege('anon','public.support_ticket_messages','SELECT') then raise exception 'Anonymous access'; end if;
end $$;
rollback;
select true as tickets_isolation_retries_status_legacy_and_rate_checks_passed;
