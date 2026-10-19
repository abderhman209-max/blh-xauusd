-- A market-only cache and persistent generation limits; never readable by clients.
create table public.ai_analysis_cache (
  cache_key text primary key check (cache_key ~ '^[a-f0-9]{64}$'),
  user_id uuid references auth.users(id) on delete set null,
  claim_id uuid not null default gen_random_uuid(),
  status text not null check (status in ('running','completed','failed')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  result jsonb,
  check ((status = 'completed' and result is not null) or (status <> 'completed' and result is null))
);
create index ai_analysis_cache_daily on public.ai_analysis_cache(created_at,user_id);
alter table public.ai_analysis_cache enable row level security;
revoke all on public.ai_analysis_cache from public,anon,authenticated;
grant select,insert,update on public.ai_analysis_cache to service_role;

create function public.pipvoria_reserve_ai_analysis(p_cache_key text,p_user_id uuid,p_expires_at timestamptz)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare cached public.ai_analysis_cache; claim uuid; day_start timestamptz;
begin
  if p_cache_key is null or p_cache_key !~ '^[a-f0-9]{64}$' or p_user_id is null
    or p_expires_at is null or p_expires_at <= now() or p_expires_at > now()+interval '2 hours' then
    raise exception 'invalid_analysis_reservation';
  end if;
  -- Serializes reservations across instances, including different cache keys.
  perform pg_catalog.pg_advisory_xact_lock(284901,6123);
  select * into cached from public.ai_analysis_cache where cache_key=p_cache_key;
  if found then
    if cached.status='completed' and cached.expires_at>now() then
      return jsonb_build_object('status','cached','result',cached.result,'expiresAt',cached.expires_at);
    end if;
    return jsonb_build_object('status',case when cached.status='running' and cached.created_at>now()-interval '2 minutes' then 'running' else 'failed' end);
  end if;
  day_start=date_trunc('day',now() at time zone 'UTC') at time zone 'UTC';
  if (select count(*) from public.ai_analysis_cache where created_at>=day_start)>=100
    or (select count(*) from public.ai_analysis_cache where created_at>=day_start and user_id=p_user_id)>=20 then
    return jsonb_build_object('status','limited');
  end if;
  insert into public.ai_analysis_cache(cache_key,user_id,status,expires_at)
    values(p_cache_key,p_user_id,'running',p_expires_at) returning claim_id into claim;
  return jsonb_build_object('status','reserved','claimId',claim);
end $$;
revoke all on function public.pipvoria_reserve_ai_analysis(text,uuid,timestamptz) from public,anon,authenticated;
grant execute on function public.pipvoria_reserve_ai_analysis(text,uuid,timestamptz) to service_role;
