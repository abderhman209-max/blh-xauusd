-- The tick can now include one model call (up to 45 s): give pg_net two minutes before it gives up waiting.
select cron.schedule('pipvoria-tick', '*/5 * * * *', $$
  select net.http_post(
    url := 'https://blh-xauusd.vercel.app/api?route=cron/tick',
    headers := jsonb_build_object('content-type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'pipvoria_tick_secret')),
    body := '{}'::jsonb,
    timeout_milliseconds := 120000)
$$);
