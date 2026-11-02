-- One automatic AI watch per account: the background tick analyses this market at most hourly and notifies the owner.
create table public.ai_auto_watch (
  user_id uuid primary key references auth.users(id) on delete cascade,
  symbol text not null check (symbol in ('XAU','EUR','BTC','ETH','SOL')),
  interval text not null check (interval in ('5min','15min','30min','1h')),
  paid_exempt boolean not null default false,
  last_run_at timestamptz,
  last_cache_key text check (last_cache_key is null or last_cache_key ~ '^[a-f0-9]{64}$'),
  last_status text check (last_status is null or length(last_status) <= 40),
  created_at timestamptz not null default now()
);
create index ai_auto_watch_due on public.ai_auto_watch(last_run_at nulls first);
alter table public.ai_auto_watch enable row level security;
revoke all on public.ai_auto_watch from public, anon, authenticated;
grant select, insert, update, delete on public.ai_auto_watch to service_role;
