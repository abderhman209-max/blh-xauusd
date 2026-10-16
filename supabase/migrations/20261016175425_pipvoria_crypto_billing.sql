-- Only the server's service role can create orders or grant paid time.
create table public.payment_orders (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  amount_minor integer not null check(amount_minor > 0),
  currency text not null check(currency = 'USD'),
  duration_days integer not null check(duration_days between 1 and 366),
  status text not null default 'creating' check(status in ('creating','pending','paid')),
  checkout_url text,
  provider_transaction_id text unique,
  created_at timestamptz not null default now(),
  paid_at timestamptz,
  check ((status = 'paid') = (paid_at is not null and provider_transaction_id is not null))
);
create index payment_orders_user_created on public.payment_orders(user_id,created_at desc);
create table public.payment_subscriptions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  paid_until timestamptz not null
);
alter table public.payment_orders enable row level security;
alter table public.payment_subscriptions enable row level security;
revoke all on public.payment_orders,public.payment_subscriptions from public,anon,authenticated;
grant select,insert,update on public.payment_orders,public.payment_subscriptions to service_role;

create function public.pipvoria_confirm_payment(p_order_id uuid,p_transaction_id text,p_amount_minor integer,p_currency text)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare o public.payment_orders; until_date timestamptz;
begin
  select * into o from public.payment_orders where id=p_order_id for update;
  if not found or p_transaction_id is null or length(trim(p_transaction_id))=0 or length(p_transaction_id)>200
    or p_amount_minor is null or p_amount_minor < o.amount_minor or p_currency is distinct from o.currency then
    return jsonb_build_object('confirmed',false);
  end if;
  if o.status='paid' then
    return jsonb_build_object('confirmed',o.provider_transaction_id=p_transaction_id);
  end if;
  -- Unique transaction ID prevents a provider transaction from paying two orders.
  update public.payment_orders set status='paid',paid_at=now(),provider_transaction_id=p_transaction_id where id=o.id;
  insert into public.payment_subscriptions(user_id,paid_until)
    values(o.user_id,now()+make_interval(days=>o.duration_days))
    on conflict(user_id) do update set paid_until=greatest(public.payment_subscriptions.paid_until,now())+make_interval(days=>o.duration_days)
    returning paid_until into until_date;
  return jsonb_build_object('confirmed',true,'paidUntil',until_date);
end;
$$;
revoke all on function public.pipvoria_confirm_payment(uuid,text,integer,text) from public,anon,authenticated;
grant execute on function public.pipvoria_confirm_payment(uuid,text,integer,text) to service_role;
