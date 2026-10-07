# One active login per account

A new accepted Supabase session replaces the previous session for the same user. Different users remain independent. Multiple tabs using the same browser cookies share a session and remain allowed.

The server validates the access token with Supabase before decoding its `sub` and `session_id`. Sign-in, confirmed sign-up and email-link import claim the session through a server-only RPC. Private API routes and refreshes check the current session without claiming it again. Sign-out revokes only its own registry entry and uses the provider's local sign-out scope.

The private registry records provider session creation times. Atomic monotonic claims prevent older imports or concurrent logins finishing late from displacing a newer session. A revoked entry retains its creation cutoff, so signing out does not revive older tokens. The guard also checks the provider session still exists and has not reached `not_after`.

Restrictive RLS policies apply this guard alongside the existing owner policies for analyses/settings, notifications, notification preferences and private profile avatars. Clients have no registry table privileges and cannot execute the claim, release or active-session RPCs. The no-argument RLS helper derives identity only from the validated database JWT context. Server credentials stay in environment variables.

The browser checks every 15 seconds while visible and immediately on becoming visible. Replaced sessions lock the application and clear in-memory account state through the existing expiry event. Network failures do not falsely report another device; the server fails closed when session control is unavailable.

Apply the registry migration before deploying the guarded API, then activate the RLS migration after that deployment is ready. Both migrations were applied to the existing project. The migration filenames use the versions returned by Supabase.

Run `npm test` for mocked API regression coverage. The SQL files under `supabase/tests` exercise the real database helpers and owner policies inside transactions that end with `ROLLBACK`. They require two existing user accounts, create no auth users, send no emails and persist no fixture rows.

This policy distinguishes login sessions, not physical people. Copied cookies carrying the same session identity are not distinguishable as separate logins. Browser timers can pause while hidden or offline; server authorization still rejects replaced sessions.
