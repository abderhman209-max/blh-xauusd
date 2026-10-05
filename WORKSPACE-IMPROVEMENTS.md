# Workspace improvements

Authorized scope: all eight audit corrections and ten proposals from the 2026-10-05 audit. Dark mode stays permanent; settings/logout stay in Profile. Publish after verification (the user already authorized merge/push).

## Delivery checklist

- [x] Correct closed-trade win/loss/BE accounting and actual trailing-stop results; regression cases including same-bar priority.
- [x] Entry, TP1/2/3, SL, replacement/cancellation events; de-duplication, alert test, confirmed-only preference and clear browser-open scope.
- [x] Risk validation, per-field errors, configurable contract size and lot step.
- [x] Account-scoped persistent outbox, retry, version checks, explicit conflict resolution.
- [x] closedAt timestamps; timezone-aware daily/weekly summaries with wins/losses/BE, TP hits, net and drawdown; separate backtest vs journal.
- [x] Confirm logout success; local locked-pending marker prevents automatic re-entry after failure; retry UI.
- [x] Remove mislabeled PAXG fallback; verify supplier intervals; visible source/age/error badge and prevent stale signal saves.
- [x] Profile keyboard focus and restoration.
- [x] Demonstration chart with candles and ENTRY/SL/TP1–3 only, timeframe and fullscreen controls.
- [x] Multi-timeframe browser watcher (1m/5m/15m/30m/1h).
- [ ] Optional browser-closed server monitor: requires hosting configuration and Push subscription infrastructure; not enabled or represented as active.
- [x] Settings by account/market/timeframe, remote sync, personal profiles, import/export and undo.
- [x] Mobile login form before presentation, compact account panel.
- [x] Position cards with TP1–3, opening time, strategy, risk/progress and filters.
- [x] CSV and printable PDF journal reports with filters and timezone.
- [x] Consistent dark identity and functional level colors.
- [x] Stop hidden animations; memoize analysis independent of zoom/resize; functional tests.

## Constraints and decisions

- Current connected Supabase project is the unrelated restaurant project. Do not change that database. Store user workspace settings in authenticated user's Supabase Auth metadata through the existing server API; no schema migration needed for settings.
- Supabase changelog and RLS documentation checked on 2026-10-05. Authorization remains based on server-validated sessions and app_metadata roles, never user_metadata.
- Production lives at https://blh-xauusd.vercel.app, repository abderhman209-max/blh-xauusd. GitHub connector can push/merge; connected Vercel account could not access the hosting owner's scope during the previous turn.
- New fixes must preserve journal data and explicitly handle conflicts; no destructive migration.

## Verification plan

Pure domain tests: lifecycle outcomes, active TP hits excluded from win denominator, same-bar order, risk bounds/lot rounding, timezone/DST ranges, unknown results, newest local edits, alerts dedupe/confirmed status, settings validation.

API tests with fake provider/Supabase responses: authentication and ownership, stale-version conflict, idempotent create, closedAt validation, profile settings limits, correct supplier symbols/intervals, logout response.

Browser fixture tests (no real user data): routes, Profile keyboard, invalid risk, offline edit/retry/conflict, daily/weekly reports, demo/fullscreen, watcher, profiles/import/export/undo, Arabic/mobile, logout failure/reload/retry, errors and freshness badges.

Publish: compare remote files, create/attach PR, check preview status, merge exact tested head, check production deployment and public login assets.

## Verified delivery

25 domain/API tests and 20 browser assertions pass. Additional browser checks cover five timeframe requests, fullscreen timeframe switching, Arabic/mobile overflow, and failed logout/reload/retry. See WORKSPACE-GUIDE.md for exact statistics semantics and remaining optional server configuration.
