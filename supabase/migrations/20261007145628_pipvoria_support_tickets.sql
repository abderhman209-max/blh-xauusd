-- Additive ticket workspace. Existing conversations remain available during rollout.
-- Hold concurrent legacy writes until the backfill and mirroring trigger are committed.
lock table public.support_threads,public.support_messages in share row exclusive mode;
create table public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  number bigint generated always as identity unique,
  user_id uuid not null references auth.users(id) on delete cascade,
  legacy_user_id uuid unique references public.support_threads(user_id) on delete cascade,
  user_name text not null default '' check(char_length(user_name)<=80),
  subject text not null check(char_length(btrim(subject)) between 3 and 100),
  status text not null default 'open' check(status in ('open','in_progress','resolved')),
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  last_message_at timestamptz not null default clock_timestamp(),
  last_sender_role text not null default 'customer' check(last_sender_role in ('customer','admin')),
  last_message_preview text not null default '' check(char_length(last_message_preview)<=180)
);
create index support_tickets_owner_recent_idx on public.support_tickets(user_id,last_message_at desc,id);
create index support_tickets_recent_idx on public.support_tickets(last_message_at desc,id);
create table public.support_ticket_messages (
  id uuid primary key,
  seq bigint generated always as identity unique,
  ticket_id uuid not null references public.support_tickets(id) on delete cascade,
  sender_id uuid references auth.users(id) on delete set null,
  sender_role text not null check(sender_role in ('customer','admin')),
  body text not null check(char_length(btrim(body)) between 1 and 2000),
  created_at timestamptz not null default clock_timestamp()
);
create index support_ticket_messages_history_idx on public.support_ticket_messages(ticket_id,seq desc);
create index support_ticket_messages_rate_idx on public.support_ticket_messages(sender_id,created_at desc);
alter table public.support_tickets enable row level security;
alter table public.support_ticket_messages enable row level security;
revoke all on public.support_tickets,public.support_ticket_messages from public,anon,authenticated;
grant select on public.support_tickets,public.support_ticket_messages to authenticated;
grant all on public.support_tickets,public.support_ticket_messages to service_role;
revoke all on sequence public.support_tickets_number_seq,public.support_ticket_messages_seq_seq from public,anon,authenticated;
grant usage,select on sequence public.support_tickets_number_seq,public.support_ticket_messages_seq_seq to service_role;
create policy support_tickets_owner_read on public.support_tickets for select to authenticated
  using(user_id=(select auth.uid()) and (select private.pipvoria_session_is_current()));
create policy support_ticket_messages_owner_read on public.support_ticket_messages for select to authenticated
  using(ticket_id in(select id from public.support_tickets where user_id=(select auth.uid()))
    and (select private.pipvoria_session_is_current()));

-- Import one ticket for each previous conversation; preserve original timestamps and IDs.
insert into public.support_tickets(user_id,legacy_user_id,user_name,subject,created_at,updated_at,last_message_at,last_sender_role,last_message_preview)
select user_id,user_id,user_name,'Conversation initiale',created_at,last_message_at,last_message_at,last_sender_role,last_message_preview
from public.support_threads order by created_at,user_id;
insert into public.support_ticket_messages(id,ticket_id,sender_id,sender_role,body,created_at)
select m.id,t.id,m.sender_id,m.sender_role,m.body,m.created_at from public.support_messages m
join public.support_tickets t on t.legacy_user_id=m.user_id order by m.seq;

-- Mirror writes from an old, already-open browser to its imported conversation.
create function private.pipvoria_support_legacy_ticket() returns trigger
language plpgsql security definer set search_path='' as $$
declare tid uuid;
begin
  insert into public.support_tickets(user_id,legacy_user_id,user_name,subject)
    select new.user_id,new.user_id,user_name,'Conversation initiale' from public.support_threads where user_id=new.user_id
    on conflict(legacy_user_id) do nothing;
  select id into tid from public.support_tickets where legacy_user_id=new.user_id for update;
  insert into public.support_ticket_messages(id,ticket_id,sender_id,sender_role,body,created_at)
    values(new.id,tid,new.sender_id,new.sender_role,new.body,new.created_at) on conflict(id) do nothing;
  update public.support_tickets set last_message_at=new.created_at,updated_at=clock_timestamp(),
    last_sender_role=new.sender_role,last_message_preview=left(new.body,180),
    status=case when new.sender_role='customer' then 'open' else 'in_progress' end where id=tid;
  return new;
end $$;
revoke all on function private.pipvoria_support_legacy_ticket() from public,anon,authenticated,service_role;
create trigger support_legacy_ticket after insert on public.support_messages
  for each row execute function private.pipvoria_support_legacy_ticket();

-- Server-only operation. Identity and administrator role are checked against current storage.
create function public.pipvoria_ticket_send(p_ticket_id uuid,p_message_id uuid,p_sender_id uuid,p_session_id uuid,
  p_admin boolean,p_subject text,p_body text,p_user_name text,p_create boolean)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare ticket public.support_tickets%rowtype; saved public.support_ticket_messages%rowtype;
  previous public.support_ticket_messages%rowtype;
begin
  if p_ticket_id is null or p_message_id is null or p_sender_id is null or p_admin is null or p_create is null
    or p_body is null or char_length(btrim(p_body)) not between 1 and 2000
    or p_body ~ '[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]'
    or p_user_name is null or char_length(p_user_name)>80
    or (p_create and (p_admin or p_subject is null or char_length(btrim(p_subject)) not between 3 and 100
      or p_subject ~ '[\x00-\x1f\x7f]')) then raise exception 'invalid_support_message'; end if;
  if not private.pipvoria_session_active(p_sender_id,p_session_id) then raise exception 'session_replaced'; end if;
  if p_admin and not private.pipvoria_ticket_admin(p_sender_id)
    then raise exception 'support_forbidden'; end if;
  -- Serialize all sends from one account, including creates and retries across tickets.
  perform pg_advisory_xact_lock(hashtextextended(p_sender_id::text,0));
  select * into ticket from public.support_tickets where id=p_ticket_id for update;
  if found then
    if not p_admin and ticket.user_id<>p_sender_id then raise exception 'support_thread_not_found'; end if;
    if p_create and ticket.subject<>btrim(p_subject) then raise exception 'support_message_conflict'; end if;
  elsif not p_create then raise exception 'support_thread_not_found'; end if;
  select * into previous from public.support_ticket_messages where id=p_message_id;
  if found then
    if previous.ticket_id=p_ticket_id and previous.sender_id=p_sender_id and previous.body=btrim(p_body)
      and previous.sender_role=(case when p_admin then 'admin' else 'customer' end) then
      return jsonb_build_object('ticket',to_jsonb(ticket),'message',to_jsonb(previous));
    end if;
    raise exception 'support_message_conflict';
  end if;
  if (select count(*) from public.support_ticket_messages where sender_id=p_sender_id
    and created_at>clock_timestamp()-interval '1 minute')>=10 then raise exception 'support_rate_limit'; end if;
  if p_create then
    if ticket.id is not null then raise exception 'support_message_conflict'; end if;
    if (select count(*) from public.support_tickets where user_id=p_sender_id
      and created_at>clock_timestamp()-interval '1 minute')>=3 then raise exception 'support_rate_limit'; end if;
    insert into public.support_tickets(id,user_id,user_name,subject) values(p_ticket_id,p_sender_id,p_user_name,btrim(p_subject)) returning * into ticket;
  end if;
  insert into public.support_ticket_messages(id,ticket_id,sender_id,sender_role,body)
    values(p_message_id,p_ticket_id,p_sender_id,case when p_admin then 'admin' else 'customer' end,btrim(p_body)) returning * into saved;
  update public.support_tickets set updated_at=clock_timestamp(),last_message_at=saved.created_at,
    last_sender_role=saved.sender_role,last_message_preview=left(saved.body,180),
    status=case when p_admin then 'in_progress' else 'open' end where id=p_ticket_id returning * into ticket;
  return jsonb_build_object('ticket',to_jsonb(ticket),'message',to_jsonb(saved));
end $$;
-- auth.users is private; use a narrow helper rather than granting the service role extra table access.
create function private.pipvoria_ticket_admin(p_sender_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select exists(select 1 from auth.users where id=p_sender_id and raw_app_meta_data->>'role'='super_admin');
$$;
revoke all on function private.pipvoria_ticket_admin(uuid) from public,anon,authenticated;
grant execute on function private.pipvoria_ticket_admin(uuid) to service_role;
-- Status edits use the version shown in the UI so a newer reply is never silently closed.
create function public.pipvoria_ticket_status(p_ticket_id uuid,p_sender_id uuid,p_session_id uuid,p_admin boolean,
  p_status text,p_updated_at timestamptz) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare ticket public.support_tickets%rowtype;
begin
  if not private.pipvoria_session_active(p_sender_id,p_session_id) then raise exception 'session_replaced'; end if;
  if p_admin is null or p_status is null or p_updated_at is null or p_status not in ('open','in_progress','resolved')
    or (not p_admin and p_status='in_progress') then raise exception 'invalid_support_status'; end if;
  if p_admin and not private.pipvoria_ticket_admin(p_sender_id) then raise exception 'support_forbidden'; end if;
  select * into ticket from public.support_tickets where id=p_ticket_id for update;
  if not found or (not p_admin and ticket.user_id<>p_sender_id) then raise exception 'support_thread_not_found'; end if;
  if ticket.updated_at<>p_updated_at then raise exception 'support_ticket_conflict'; end if;
  update public.support_tickets set status=p_status,updated_at=clock_timestamp() where id=p_ticket_id returning * into ticket;
  return to_jsonb(ticket);
end $$;
revoke all on function public.pipvoria_ticket_send(uuid,uuid,uuid,uuid,boolean,text,text,text,boolean),
  public.pipvoria_ticket_status(uuid,uuid,uuid,boolean,text,timestamptz) from public,anon,authenticated;
grant execute on function public.pipvoria_ticket_send(uuid,uuid,uuid,uuid,boolean,text,text,text,boolean),
  public.pipvoria_ticket_status(uuid,uuid,uuid,boolean,text,timestamptz) to service_role;
