-- pg_net keeps its functions in the net schema; register the extension outside public as Supabase recommends.
drop extension if exists pg_net;
create extension pg_net with schema extensions;
