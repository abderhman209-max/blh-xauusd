begin;
do $$
declare
  users uuid[];
  a uuid := gen_random_uuid(); b uuid := gen_random_uuid(); c uuid := gen_random_uuid();
  own_row uuid := gen_random_uuid(); other_row uuid := gen_random_uuid();
begin
  select array_agg(id) into users from (select id from auth.users order by id limit 2) u;
  insert into auth.sessions (id,user_id,created_at,updated_at) values
    (a,users[1],now()+interval '1 day',now()),
    (b,users[1],now()+interval '2 days',now()),
    (c,users[2],now()+interval '1 day',now());
  perform public.pipvoria_claim_session(users[1],a);
  perform public.pipvoria_claim_session(users[1],b);
  perform public.pipvoria_claim_session(users[2],c);
  insert into public.analysis_snapshots(id,user_id,payload) values
    (own_row,users[1],'{"fixture":true}'),(other_row,users[2],'{"fixture":true}');
  perform set_config('pipvoria.fixture_owner',users[1]::text,true);
  perform set_config('pipvoria.fixture_other',users[2]::text,true);
  perform set_config('pipvoria.fixture_old',a::text,true);
  perform set_config('pipvoria.fixture_new',b::text,true);
  perform set_config('pipvoria.fixture_other_session',c::text,true);
  perform set_config('pipvoria.fixture_own_row',own_row::text,true);
  perform set_config('pipvoria.fixture_other_row',other_row::text,true);
end $$;
set local role authenticated;
do $$
declare
  owner_id uuid := current_setting('pipvoria.fixture_owner')::uuid;
  other_id uuid := current_setting('pipvoria.fixture_other')::uuid;
  own_row uuid := current_setting('pipvoria.fixture_own_row')::uuid;
  other_row uuid := current_setting('pipvoria.fixture_other_row')::uuid;
  affected integer;
begin
  perform set_config('request.jwt.claims',jsonb_build_object('sub',owner_id,'role','authenticated','session_id',current_setting('pipvoria.fixture_new'))::text,true);
  if not private.pipvoria_session_is_current() then raise exception 'New session rejected by RLS helper'; end if;
  if (select count(*) from public.analysis_snapshots where id in (own_row,other_row)) <> 1 then raise exception 'Active owner isolation failed'; end if;
  update public.analysis_snapshots set payload='{"fixture":"updated"}' where id=own_row;
  get diagnostics affected = row_count;
  if affected <> 1 then raise exception 'Active owner cannot update'; end if;
  begin
    insert into public.analysis_snapshots(id,user_id,payload) values(gen_random_uuid(),other_id,'{}');
    raise exception 'Active owner inserted another account row';
  exception when insufficient_privilege then null;
  end;
  perform set_config('request.jwt.claims',jsonb_build_object('sub',owner_id,'role','authenticated','session_id',current_setting('pipvoria.fixture_old'))::text,true);
  if private.pipvoria_session_is_current() then raise exception 'Old session accepted by RLS helper'; end if;
  if (select count(*) from public.analysis_snapshots where id=own_row) <> 0 then raise exception 'Stale direct read succeeded'; end if;
  update public.analysis_snapshots set payload='{}' where id=own_row;
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'Stale direct update succeeded'; end if;
  delete from public.analysis_snapshots where id=own_row;
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'Stale direct delete succeeded'; end if;
  begin
    insert into public.analysis_snapshots(id,user_id,payload) values(gen_random_uuid(),owner_id,'{}');
    raise exception 'Stale direct insert succeeded';
  exception when insufficient_privilege then null;
  end;
  perform set_config('request.jwt.claims',jsonb_build_object('sub',other_id,'role','authenticated','session_id',current_setting('pipvoria.fixture_other_session'))::text,true);
  if not private.pipvoria_session_is_current() then raise exception 'Other account rejected'; end if;
  if (select count(*) from public.analysis_snapshots where id in (own_row,other_row)) <> 1 then raise exception 'Other account isolation failed'; end if;
  perform set_config('request.jwt.claims','{}',true);
  if private.pipvoria_session_is_current() then raise exception 'Missing JWT accepted'; end if;
  perform set_config('request.jwt.claims',jsonb_build_object('sub',owner_id,'session_id','bad-uuid')::text,true);
  if private.pipvoria_session_is_current() then raise exception 'Malformed session accepted'; end if;
end $$;
rollback;
select true as rls_checks_passed;
