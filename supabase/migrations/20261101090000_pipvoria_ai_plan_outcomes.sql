-- Track record of AI plans: the server replays closed candles after each plan and stores the outcome.
-- Server-only like the cache itself; existing grants (service_role select/update) already cover the column.
alter table public.ai_analysis_cache add column outcome jsonb
  check (outcome is null or (jsonb_typeof(outcome)='object' and outcome->>'state' in ('waiting','open','closed','not_triggered','unknown')));
create index ai_analysis_cache_completed on public.ai_analysis_cache(created_at desc) where status='completed';
