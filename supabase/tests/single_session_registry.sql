begin;
do $$
declare
  users uuid[];
  a uuid := gen_random_uuid(); b uuid := gen_random_uuid(); c uuid := gen_random_uuid();
  missing uuid := gen_random_uuid();
begin
  select array_agg(id) into users from (select id from auth.users order by id limit 2) u;
  if coalesce(cardinality(users),0) < 2 then raise exception 'Need two existing fixture owners'; end if;
  insert into auth.sessions (id,user_id,created_at,updated_at) values
    (a,users[1],now()+interval '1 day',now()),
    (b,users[1],now()+interval '2 days',now()),
    (c,users[2],now()+interval '1 day',now());
  if not public.pipvoria_claim_session(users[1],a) then raise exception 'First claim failed'; end if;
  if not public.pipvoria_claim_session(users[1],a) then raise exception 'Idempotent claim failed'; end if;
  if not public.pipvoria_claim_session(users[1],b) then raise exception 'Newer claim failed'; end if;
  if public.pipvoria_claim_session(users[1],a) then raise exception 'Old claim displaced newer'; end if;
  if public.pipvoria_session_active(users[1],a) then raise exception 'Old session still active'; end if;
  if not public.pipvoria_session_active(users[1],b) then raise exception 'New session inactive'; end if;
  if not public.pipvoria_claim_session(users[2],c) then raise exception 'Separate account blocked'; end if;
  if public.pipvoria_claim_session(users[1],c) then raise exception 'Mismatched owner accepted'; end if;
  if public.pipvoria_claim_session(users[1],missing) then raise exception 'Unknown session accepted'; end if;
  if public.pipvoria_release_session(users[1],a) then raise exception 'Stale logout released current'; end if;
  if not public.pipvoria_session_active(users[1],b) then raise exception 'Stale logout blocked current'; end if;
  if not public.pipvoria_release_session(users[1],b) then raise exception 'Current logout failed'; end if;
  if public.pipvoria_claim_session(users[1],b) then raise exception 'Revoked session resurrected'; end if;
  if public.pipvoria_claim_session(users[1],a) then raise exception 'Old session resurrected after logout'; end if;
  if public.pipvoria_session_active(users[1],b) then raise exception 'Revoked session active'; end if;
  delete from auth.sessions where id=c;
  if public.pipvoria_session_active(users[2],c) then raise exception 'Deleted provider session active'; end if;
  if has_function_privilege('authenticated','public.pipvoria_claim_session(uuid,uuid)','EXECUTE') then raise exception 'Clients can claim sessions'; end if;
  if has_function_privilege('anon','public.pipvoria_session_active(uuid,uuid)','EXECUTE') then raise exception 'Anonymous session enumeration possible'; end if;
  if has_table_privilege('authenticated','private.pipvoria_account_sessions','SELECT') then raise exception 'Registry exposed to client'; end if;
  if not has_function_privilege('service_role','public.pipvoria_claim_session(uuid,uuid)','EXECUTE') then raise exception 'Server cannot claim'; end if;
end $$;
rollback;
select true as registry_checks_passed;
