-- One private support conversation per account. Server-derived identities only.
create table public.support_threads (
  user_id uuid primary key references auth.users(id) on delete cascade,
  user_name text not null default '' check (char_length(user_name) <= 80),
  created_at timestamptz not null default now(),
  last_message_at timestamptz not null default now(),
  last_message_seq bigint not null default 0,
  last_sender_role text not null default 'customer' check (last_sender_role in ('customer','admin')),
  last_message_preview text not null default '' check (char_length(last_message_preview) <= 180)
);
create index support_threads_recent_idx on public.support_threads(last_message_at desc, user_id);

create table public.support_messages (
  id uuid primary key,
  seq bigint generated always as identity unique,
  user_id uuid not null references public.support_threads(user_id) on delete cascade,
  sender_id uuid references auth.users(id) on delete set null,
  sender_role text not null check (sender_role in ('customer','admin')),
  body text not null check (char_length(btrim(body)) between 1 and 2000),
  created_at timestamptz not null default clock_timestamp()
);
create index support_messages_history_idx on public.support_messages(user_id, seq desc);
create index support_messages_rate_idx on public.support_messages(user_id, sender_role, created_at desc);
create index support_messages_sender_idx on public.support_messages(sender_id);

alter table public.support_threads enable row level security;
alter table public.support_messages enable row level security;
revoke all on public.support_threads, public.support_messages from public, anon, authenticated;
grant select on public.support_threads, public.support_messages to authenticated;
grant all on public.support_threads, public.support_messages to service_role;
revoke all on sequence public.support_messages_seq_seq from public, anon, authenticated;
grant usage, select on sequence public.support_messages_seq_seq to service_role;
create policy support_threads_owner_read on public.support_threads for select to authenticated
  using (user_id = (select auth.uid()) and (select private.pipvoria_session_is_current()));
create policy support_messages_owner_read on public.support_messages for select to authenticated
  using (user_id = (select auth.uid()) and (select private.pipvoria_session_is_current()));

-- Only the server's service role can call this invoker function. The API checks
-- the latest Supabase user/app_metadata before deriving sender_role and IDs.
-- Serializing on the thread makes retry deduplication and throttling atomic.
create function public.pipvoria_support_send(
  p_user_id uuid, p_sender_id uuid, p_session_id uuid, p_id uuid,
  p_sender_role text, p_body text, p_user_name text
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  existing public.support_messages%rowtype;
  saved public.support_messages%rowtype;
begin
  if p_sender_role not in ('customer','admin') or p_sender_role is null
    or p_user_id is null or p_sender_id is null or p_id is null
    or (p_sender_role = 'customer' and p_sender_id <> p_user_id)
    or p_body is null or char_length(btrim(p_body)) not between 1 and 2000
    or p_user_name is null or char_length(p_user_name) > 80 then
    raise exception 'invalid_support_message';
  end if;
  if not private.pipvoria_session_active(p_sender_id, p_session_id) then
    raise exception 'session_replaced';
  end if;
  -- Replies cannot create a conversation on behalf of an unrelated user.
  if p_sender_role = 'customer' then
    insert into public.support_threads(user_id, user_name)
      values (p_user_id, p_user_name) on conflict (user_id) do nothing;
  end if;
  perform 1 from public.support_threads where user_id = p_user_id for update;
  if not found then raise exception 'support_thread_not_found'; end if;
  select * into existing from public.support_messages where id = p_id;
  if found then
    if existing.user_id = p_user_id and existing.sender_id = p_sender_id
      and existing.sender_role = p_sender_role and existing.body = btrim(p_body) then
      return to_jsonb(existing);
    end if;
    raise exception 'support_message_conflict';
  end if;
  if (select count(*) from public.support_messages
      where user_id = p_user_id and sender_role = p_sender_role
      and created_at > clock_timestamp() - interval '1 minute') >= 10 then
    raise exception 'support_rate_limit';
  end if;
  insert into public.support_messages(id, user_id, sender_id, sender_role, body)
    values (p_id, p_user_id, p_sender_id, p_sender_role, btrim(p_body)) returning * into saved;
  update public.support_threads set
    user_name = case when p_sender_role = 'customer' then p_user_name else user_name end,
    last_message_at = saved.created_at, last_message_seq = saved.seq,
    last_sender_role = saved.sender_role, last_message_preview = left(saved.body,180)
    where user_id = p_user_id;
  return to_jsonb(saved);
end;
$$;
revoke all on function public.pipvoria_support_send(uuid,uuid,uuid,uuid,text,text,text) from public, anon, authenticated;
grant execute on function public.pipvoria_support_send(uuid,uuid,uuid,uuid,text,text,text) to service_role;
