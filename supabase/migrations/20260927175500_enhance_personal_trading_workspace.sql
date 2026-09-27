alter table public.analysis_snapshots
  add column if not exists kind text not null default 'snapshot',
  add column if not exists updated_at timestamptz not null default now();

drop policy if exists "Members update their own analyses" on public.analysis_snapshots;
create policy "Members update their own analyses"
on public.analysis_snapshots
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

grant select, insert, update, delete on table public.analysis_snapshots to authenticated;
revoke all on table public.analysis_snapshots from anon;

create table if not exists public.notification_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade default auth.uid(),
  new_signal boolean not null default true,
  entry_zone boolean not null default true,
  target_hit boolean not null default true,
  stop_loss boolean not null default true,
  signal_updates boolean not null default true,
  browser_notifications boolean not null default false,
  quiet_start time,
  quiet_end time,
  updated_at timestamptz not null default now()
);

alter table public.notification_preferences enable row level security;

drop policy if exists "Members read their notification preferences" on public.notification_preferences;
create policy "Members read their notification preferences"
on public.notification_preferences for select to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Members create their notification preferences" on public.notification_preferences;
create policy "Members create their notification preferences"
on public.notification_preferences for insert to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "Members update their notification preferences" on public.notification_preferences;
create policy "Members update their notification preferences"
on public.notification_preferences for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Members delete their notification preferences" on public.notification_preferences;
create policy "Members delete their notification preferences"
on public.notification_preferences for delete to authenticated
using ((select auth.uid()) = user_id);

grant select, insert, update, delete on table public.notification_preferences to authenticated;
revoke all on table public.notification_preferences from anon;

create table if not exists public.user_notifications (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  created_at timestamptz not null default now(),
  kind text not null default 'signal',
  title text not null check (char_length(title) between 1 and 120),
  body text not null check (char_length(body) between 1 and 500),
  signal_key text not null check (char_length(signal_key) between 1 and 180),
  is_read boolean not null default false,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  unique (user_id, signal_key)
);

alter table public.user_notifications enable row level security;

drop policy if exists "Members read their own notifications" on public.user_notifications;
create policy "Members read their own notifications"
on public.user_notifications for select to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Members create their own notifications" on public.user_notifications;
create policy "Members create their own notifications"
on public.user_notifications for insert to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "Members update their own notifications" on public.user_notifications;
create policy "Members update their own notifications"
on public.user_notifications for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Members delete their own notifications" on public.user_notifications;
create policy "Members delete their own notifications"
on public.user_notifications for delete to authenticated
using ((select auth.uid()) = user_id);

grant select, insert, update, delete on table public.user_notifications to authenticated;
revoke all on table public.user_notifications from anon;

create index if not exists analysis_snapshots_user_created_idx
  on public.analysis_snapshots (user_id, created_at desc);

create index if not exists user_notifications_user_created_idx
  on public.user_notifications (user_id, created_at desc);
