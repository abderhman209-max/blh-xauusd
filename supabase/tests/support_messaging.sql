begin;
do $$
declare
  owners uuid[]; a uuid:=gen_random_uuid(); b uuid:=gen_random_uuid(); newer uuid:=gen_random_uuid();
begin
  select array_agg(id) into owners from (select id from auth.users order by id limit 2) u;
  if coalesce(cardinality(owners),0)<2 then raise exception 'Need two test owners'; end if;
  insert into auth.sessions(id,user_id,created_at,updated_at) values
    (a,owners[1],now()+interval '1 day',now()), (newer,owners[1],now()+interval '2 days',now()), (b,owners[2],now()+interval '1 day',now());
  perform public.pipvoria_claim_session(owners[1],a);
  perform public.pipvoria_claim_session(owners[2],b);
  perform set_config('pipvoria.support_owner',owners[1]::text,true);
  perform set_config('pipvoria.support_other',owners[2]::text,true);
  perform set_config('pipvoria.support_session',a::text,true);
  perform set_config('pipvoria.support_new',newer::text,true);
  perform set_config('pipvoria.support_other_session',b::text,true);
  perform set_config('pipvoria.support_message',gen_random_uuid()::text,true);
end $$;
set local role service_role;
do $$
declare
  owner_id uuid:=current_setting('pipvoria.support_owner')::uuid;
  other_id uuid:=current_setting('pipvoria.support_other')::uuid;
  sid uuid:=current_setting('pipvoria.support_session')::uuid;
  other_sid uuid:=current_setting('pipvoria.support_other_session')::uuid;
  mid uuid:=current_setting('pipvoria.support_message')::uuid;
  saved jsonb; duplicate jsonb; reply jsonb; i integer;
begin
  saved:=public.pipvoria_support_send(owner_id,owner_id,sid,mid,'customer','Test question','Synthetic fixture');
  duplicate:=public.pipvoria_support_send(owner_id,owner_id,sid,mid,'customer','Test question','Synthetic fixture');
  if saved->>'seq'<>duplicate->>'seq' then raise exception 'Retry created duplicate'; end if;
  begin
    perform public.pipvoria_support_send(owner_id,owner_id,sid,mid,'customer','Changed text','Synthetic fixture');
    raise exception 'Conflict was accepted';
  exception when others then if sqlerrm<>'support_message_conflict' then raise; end if; end;
  begin
    perform public.pipvoria_support_send(other_id,owner_id,sid,gen_random_uuid(),'customer','Forged owner','Synthetic fixture');
    raise exception 'Foreign owner was accepted';
  exception when others then if sqlerrm<>'invalid_support_message' then raise; end if; end;
  reply:=public.pipvoria_support_send(owner_id,other_id,other_sid,gen_random_uuid(),'admin','Test reply','Synthetic fixture');
  if (select last_sender_role from public.support_threads where user_id=owner_id)<>'admin' then raise exception 'Reply did not update inbox'; end if;
  perform public.pipvoria_support_send(other_id,other_id,other_sid,gen_random_uuid(),'customer','Private second conversation','Synthetic fixture');
  for i in 1..9 loop perform public.pipvoria_support_send(owner_id,owner_id,sid,gen_random_uuid(),'customer','Rate test','Synthetic fixture'); end loop;
  begin
    perform public.pipvoria_support_send(owner_id,owner_id,sid,gen_random_uuid(),'customer','Eleventh','Synthetic fixture');
    raise exception 'Rate limit absent';
  exception when others then if sqlerrm<>'support_rate_limit' then raise; end if; end;
  -- Successful retries remain allowed after hitting the limit.
  perform public.pipvoria_support_send(owner_id,owner_id,sid,mid,'customer','Test question','Synthetic fixture');
  perform public.pipvoria_claim_session(owner_id,current_setting('pipvoria.support_new')::uuid);
  begin
    perform public.pipvoria_support_send(owner_id,owner_id,sid,gen_random_uuid(),'customer','Old session','Synthetic fixture');
    raise exception 'Replaced session can send';
  exception when others then if sqlerrm<>'session_replaced' then raise; end if; end;
end $$;
set local role authenticated;
do $$
declare
  owner_id uuid:=current_setting('pipvoria.support_owner')::uuid;
  other_id uuid:=current_setting('pipvoria.support_other')::uuid;
  amount integer;
begin
  perform set_config('request.jwt.claims',jsonb_build_object('sub',owner_id,'role','authenticated','session_id',current_setting('pipvoria.support_new'))::text,true);
  if (select count(*) from public.support_threads where user_id in(owner_id,other_id))<>1 then raise exception 'Thread isolation failed'; end if;
  if exists(select 1 from public.support_messages where user_id=other_id) then raise exception 'Message isolation failed'; end if;
  if not exists(select 1 from public.support_messages where user_id=owner_id and sender_role='admin') then raise exception 'Owner cannot read reply'; end if;
  begin
    insert into public.support_messages(id,user_id,sender_id,sender_role,body) values(gen_random_uuid(),owner_id,owner_id,'admin','Spoofed reply');
    raise exception 'Client can forge messages';
  exception when insufficient_privilege then null; end;
  if has_function_privilege('authenticated','public.pipvoria_support_send(uuid,uuid,uuid,uuid,text,text,text)','EXECUTE') then raise exception 'Client can call server RPC'; end if;
  perform set_config('request.jwt.claims',jsonb_build_object('sub',owner_id,'role','authenticated','session_id',current_setting('pipvoria.support_session'))::text,true);
  if exists(select 1 from public.support_messages where user_id=owner_id) then raise exception 'Old session direct read succeeded'; end if;
  perform set_config('request.jwt.claims',jsonb_build_object('sub',other_id,'role','authenticated','session_id',current_setting('pipvoria.support_other_session'),'user_metadata',jsonb_build_object('role','super_admin'))::text,true);
  if exists(select 1 from public.support_messages where user_id=owner_id) then raise exception 'Editable metadata bypassed RLS'; end if;
end $$;
set local role anon;
do $$ begin
  if has_table_privilege('anon','public.support_messages','SELECT') or has_function_privilege('anon','public.pipvoria_support_send(uuid,uuid,uuid,uuid,text,text,text)','EXECUTE') then raise exception 'Anonymous support access'; end if;
end $$;
rollback;
select true as support_storage_rls_retry_rate_and_session_checks_passed;
