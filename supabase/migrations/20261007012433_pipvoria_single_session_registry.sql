-- Keep one accepted Supabase session per account. Never expose this registry to clients.
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated, service_role;

create table private.pipvoria_account_sessions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  session_id uuid not null,
  session_created_at timestamptz not null,
  revoked boolean not null default false,
  claimed_at timestamptz not null default now()
);
alter table private.pipvoria_account_sessions enable row level security;
revoke all on private.pipvoria_account_sessions from public, anon, authenticated, service_role;

create function private.pipvoria_claim_session(p_user_id uuid, p_session_id uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  candidate_created_at timestamptz;
  accepted boolean;
begin
  select s.created_at into candidate_created_at from auth.sessions s
    where s.id = p_session_id and s.user_id = p_user_id
      and (s.not_after is null or s.not_after > now());
  if candidate_created_at is null then return false; end if;
  insert into private.pipvoria_account_sessions as current_session
    (user_id, session_id, session_created_at)
    values (p_user_id, p_session_id, candidate_created_at)
  on conflict (user_id) do update set
    session_id = excluded.session_id,
    session_created_at = excluded.session_created_at,
    revoked = false,
    claimed_at = now()
  where (excluded.session_created_at, excluded.session_id) >
        (current_session.session_created_at, current_session.session_id)
     or (excluded.session_id = current_session.session_id and not current_session.revoked)
  returning true into accepted;
  return coalesce(accepted, false);
end;
$$;

create function private.pipvoria_session_active(p_user_id uuid, p_session_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from private.pipvoria_account_sessions c
    join auth.sessions s on s.id = c.session_id and s.user_id = c.user_id
    where c.user_id = p_user_id and c.session_id = p_session_id and not c.revoked
      and (s.not_after is null or s.not_after > now())
  );
$$;

create function private.pipvoria_release_session(p_user_id uuid, p_session_id uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
declare released boolean;
begin
  -- Preserve the creation cutoff so an old token cannot claim the account again.
  update private.pipvoria_account_sessions set revoked = true
    where user_id = p_user_id and session_id = p_session_id and not revoked
    returning true into released;
  return coalesce(released, false);
end;
$$;

create function private.pipvoria_session_is_current()
returns boolean language plpgsql stable security definer set search_path = '' as $$
declare claimed_session text := auth.jwt()->>'session_id';
begin
  if claimed_session is null or claimed_session !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return false;
  end if;
  return private.pipvoria_session_active(auth.uid(), claimed_session::uuid);
end;
$$;

revoke all on function private.pipvoria_claim_session(uuid, uuid),
  private.pipvoria_session_active(uuid, uuid), private.pipvoria_release_session(uuid, uuid),
  private.pipvoria_session_is_current() from public, anon, authenticated, service_role;
grant execute on function private.pipvoria_claim_session(uuid, uuid),
  private.pipvoria_session_active(uuid, uuid), private.pipvoria_release_session(uuid, uuid) to service_role;
grant execute on function private.pipvoria_session_is_current() to authenticated, service_role;

create function public.pipvoria_claim_session(p_user_id uuid, p_session_id uuid)
returns boolean language sql security invoker set search_path = '' as $$
  select private.pipvoria_claim_session(p_user_id, p_session_id);
$$;
create function public.pipvoria_session_active(p_user_id uuid, p_session_id uuid)
returns boolean language sql stable security invoker set search_path = '' as $$
  select private.pipvoria_session_active(p_user_id, p_session_id);
$$;
create function public.pipvoria_release_session(p_user_id uuid, p_session_id uuid)
returns boolean language sql security invoker set search_path = '' as $$
  select private.pipvoria_release_session(p_user_id, p_session_id);
$$;
revoke all on function public.pipvoria_claim_session(uuid, uuid),
  public.pipvoria_session_active(uuid, uuid), public.pipvoria_release_session(uuid, uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.pipvoria_claim_session(uuid, uuid),
  public.pipvoria_session_active(uuid, uuid), public.pipvoria_release_session(uuid, uuid) to service_role;

-- Adopt each account's newest existing session without exposing or copying tokens.
insert into private.pipvoria_account_sessions as current_session
  (user_id, session_id, session_created_at)
select distinct on (s.user_id) s.user_id, s.id, s.created_at
  from auth.sessions s
  where s.created_at is not null and (s.not_after is null or s.not_after > now())
  order by s.user_id, s.created_at desc, s.id desc
on conflict (user_id) do update set
  session_id = excluded.session_id, session_created_at = excluded.session_created_at,
  revoked = false, claimed_at = now()
where (excluded.session_created_at, excluded.session_id) >
      (current_session.session_created_at, current_session.session_id);
