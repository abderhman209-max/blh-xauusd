-- Phone notifications: one row per browser push subscription, server-only like the AI cache.
create table public.push_subscriptions (
  endpoint text primary key check (endpoint ~ '^https://' and length(endpoint) <= 1024),
  user_id uuid not null references auth.users(id) on delete cascade,
  p256dh text not null check (p256dh ~ '^[A-Za-z0-9_-]{87}$'),
  auth text not null check (auth ~ '^[A-Za-z0-9_-]{22}$'),
  paid_exempt boolean not null default false,
  created_at timestamptz not null default now()
);
create index push_subscriptions_user on public.push_subscriptions(user_id);
alter table public.push_subscriptions enable row level security;
revoke all on public.push_subscriptions from public, anon, authenticated;
grant select, insert, update, delete on public.push_subscriptions to service_role;

-- VAPID keys and the tick secret are created in Vault outside migrations; only the server role can read them.
create function public.pipvoria_push_secrets()
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  return jsonb_build_object(
    'vapidPublic', (select decrypted_secret from vault.decrypted_secrets where name = 'pipvoria_vapid_public'),
    'vapidPrivate', (select decrypted_secret from vault.decrypted_secrets where name = 'pipvoria_vapid_private'),
    'tick', (select decrypted_secret from vault.decrypted_secrets where name = 'pipvoria_tick_secret'));
end $$;
revoke all on function public.pipvoria_push_secrets() from public, anon, authenticated;
grant execute on function public.pipvoria_push_secrets() to service_role;
