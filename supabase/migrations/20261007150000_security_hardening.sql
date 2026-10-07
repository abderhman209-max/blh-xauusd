-- Security hardening after the 2026-10-07 audit.

-- 1. The id equal to an account's UUID is reserved for that account's settings
--    document. Without this, anyone knowing a UUID could take that id with a
--    journal entry and block the owner's settings forever.
create or replace function private.analysis_snapshots_reserved_id()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.kind = 'settings' and new.id is distinct from new.user_id then
    raise exception 'reserved_snapshot_id' using errcode = '23514';
  end if;
  if new.kind is distinct from 'settings' and exists (select 1 from auth.users u where u.id = new.id) then
    raise exception 'reserved_snapshot_id' using errcode = '23514';
  end if;
  return new;
end;
$$;
revoke all on function private.analysis_snapshots_reserved_id() from public, anon, authenticated;
drop trigger if exists analysis_snapshots_reserved_id on public.analysis_snapshots;
create trigger analysis_snapshots_reserved_id
  before insert or update of id, kind, user_id on public.analysis_snapshots
  for each row execute function private.analysis_snapshots_reserved_id();

-- 2. Size limits enforced by the database too: a member calling the REST API
--    directly with their own token must not bypass the API's limits.
--    NOT VALID: existing rows are kept, every new or updated row is checked.
alter table public.analysis_snapshots drop constraint if exists analysis_snapshots_kind_allowed;
alter table public.analysis_snapshots add constraint analysis_snapshots_kind_allowed
  check (kind in ('snapshot', 'trade', 'settings')) not valid;
alter table public.analysis_snapshots drop constraint if exists analysis_snapshots_payload_size;
alter table public.analysis_snapshots add constraint analysis_snapshots_payload_size
  check (octet_length(payload::text) <= case when kind = 'settings' then 200000 else 49152 end) not valid;
alter table public.user_notifications drop constraint if exists user_notifications_metadata_size;
alter table public.user_notifications add constraint user_notifications_metadata_size
  check (octet_length(metadata::text) <= 16384) not valid;
