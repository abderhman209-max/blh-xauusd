-- Restrictive policies add a session check to the existing owner policies.
create policy pipvoria_registry_deny_direct_access on private.pipvoria_account_sessions
  for all to anon, authenticated using (false) with check (false);
create policy pipvoria_current_session on public.analysis_snapshots
  as restrictive for all to authenticated
  using ((select private.pipvoria_session_is_current()))
  with check ((select private.pipvoria_session_is_current()));
create policy pipvoria_current_session on public.user_notifications
  as restrictive for all to authenticated
  using ((select private.pipvoria_session_is_current()))
  with check ((select private.pipvoria_session_is_current()));
create policy pipvoria_current_session on public.notification_preferences
  as restrictive for all to authenticated
  using ((select private.pipvoria_session_is_current()))
  with check ((select private.pipvoria_session_is_current()));
create policy pipvoria_avatar_current_session on storage.objects
  as restrictive for all to authenticated
  using (bucket_id <> 'profile-avatars' or (select private.pipvoria_session_is_current()))
  with check (bucket_id <> 'profile-avatars' or (select private.pipvoria_session_is_current()));

-- Catch sessions issued during the server deployment without reviving revoked sessions.
insert into private.pipvoria_account_sessions as current_session
  (user_id, session_id, session_created_at)
select distinct on (s.user_id) s.user_id, s.id, s.created_at
  from auth.sessions s
  where s.created_at is not null and (s.not_after is null or s.not_after > now())
  order by s.user_id, s.created_at desc, s.id desc
on conflict (user_id) do update set
  session_id = excluded.session_id, session_created_at = excluded.session_created_at,
  revoked = false, claimed_at = now()
where (excluded.session_created_at, excluded.session_id) >
      (current_session.session_created_at, current_session.session_id);
