create policy admin_audit_logs_deny_direct_access
  on public.admin_audit_logs
  for all
  to anon, authenticated
  using (false)
  with check (false);

comment on policy admin_audit_logs_deny_direct_access
  on public.admin_audit_logs is
  'Explicitly denies browser roles; service_role access remains server-only.';
