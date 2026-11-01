-- Every 5 minutes, ask the production API to replay new candles for open AI plans and send phone notifications.
create extension if not exists pg_cron;
create extension if not exists pg_net;
select cron.schedule('pipvoria-tick', '*/5 * * * *', $$
  select net.http_post(
    url := 'https://blh-xauusd.vercel.app/api?route=cron/tick',
    headers := jsonb_build_object('content-type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'pipvoria_tick_secret')),
    body := '{}'::jsonb,
    timeout_milliseconds := 25000)
$$);
