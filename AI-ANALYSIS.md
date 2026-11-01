# Pipvoria market analysis

The terminal can request a real OpenAI Responses analysis for XAU/USD or EUR/USD. A single `gpt-6-luna` call compares the selected interval with 15-minute and hourly candles. The structure, liquidity, context and invalidation sections are interpretations from that call, not separate agents or an internal chain of thought. Streamed stages describe actual server operations.

The server sends at most 100 closed OHLC candles per interval, their source, timestamps and calculated EMA/ATR context. It sends no customer identity, email, account balance or position history. XAU uses the existing Twelve Data feed with the existing Yahoo fallback; EUR uses the existing market provider. These feeds can be delayed. News and order-book feeds are not connected. The model does not learn continuously or execute broker orders.

Each validated scenario includes an entry, protective stop, three progressive targets, an entry trigger and exit rules. The compact terminal panel shows the decision, numeric levels and expiry; long commentary is omitted. Entry conditions remain available in a collapsed disclosure. A `wait` decision can include a conditional scenario that is explicitly unconfirmed. It never becomes active merely because a live price crosses a level. If the model cannot form a coherent scenario, the terminal shows `ATTENDRE` and empty level cards. TP3 is the proposed final profit-taking level, not a recorded execution or actual exit price.

## Access and consumption

Account approval and a valid subscription are checked on the server before every generation. The verified super-admin subscription exemption still applies. The API key remains server-side in the Production Secret `OPENAI_API_KEY`; the dedicated key permits Responses access only. Preview deployments require their own explicit configuration.

Apply `supabase/migrations/20261019210000_pipvoria_ai_analysis.sql` to the same database used by the production application before deploying. Its cache and reservation RPC are available only to `service_role`. RLS and explicit grants deny direct browser access. A transaction advisory lock prevents parallel instances from overshooting the generation limits.

Limits are 20 generated analyses per account and 100 globally per UTC day, including failed attempts. A completed result for identical market data can be shared without another model call. A failed reservation is not automatically retried for the same packet. One request allows at most 2,500 output tokens, times out after 45 seconds and has no provider retry. These controls limit usage; they are not a dollar-denominated billing cap. Monitor billing in the OpenAI project.

Following new candles is opt-in and runs only while the trader view is visible. Changing market, interval, login or entitlement cancels the displayed request. Closing the page cancels its stream. The server may already have incurred usage before cancellation.

## Market hours and conditional scenarios

Gold and EUR/USD analyses are refused with `analysis_market_closed` from Friday 21:00 to Sunday 22:00 UTC, before any reservation or model call. The same error is returned when the last six candles of the analysed period are less than a fifth as wide as usual: a frozen feed, a holiday or a provider still emitting flat weekend candles. BTC trades continuously and only gets the frozen-feed check.

A firm decision (`buy`/`sell`) is expected when the latest closed candles already confirm the move; its entry is near the last close. A `wait` scenario has a single verifiable trigger: one close of the analysed period beyond `triggerLevel` (above for a buy, below for a sell); the trigger must stay on the protective side of the stop. Such a plan carries `activeUntil`, 12 candles after the analysis. The terminal shows it until then and watches the closed candles. A close beyond the trigger turns it into « ACHAT/VENTE ACTIVÉE » with one alert; a stop touched first shows « SCÉNARIO ANNULÉ » and hides its levels. Auto-follow does not replace a scenario that is still waiting for its trigger. The track record replays the same rule. The v4 cache identity excludes plans without a trigger level.

## Output checks

Insufficient, malformed, interrupted recent or stale market data prevents a model call. Older session gaps are disclosed in the market packet. A plan expires at the next primary candle close, including when that close happens during inference. Expired levels are hidden in the terminal.

Structured output must reference supplied candle timestamps. The model chooses direction, entry, stop and targets; the server does the arithmetic. The entry must stay within two ATR of the latest close and the stop must be on the protective side, otherwise the output fails closed. The server then clamps the stop distance to 0.3–5 ATR and each target to its band (TP1 1–3R, TP2 1.5–4R, TP3 2–5R, each farther than the previous one), rounds stop and targets away from the entry so the ratios still hold after rounding, and recomputes the R ratios. When it changes a model level, the plan carries `adjusted: true` and an extra « Niveaux · contrôle serveur » check is shown. Trigger and exit instructions must be present. The v3 cache identity excludes results validated by the older rules. Invalid, incomplete or refused model output fails closed. These checks validate consistency, not predictive accuracy or profitability. Spread, fees and slippage are not included. The model can return `wait` without levels.

## Bot track record

Terminal → **Performance de l’agent IA** shows how the stored plans of the last 90 days actually played out, shared across all accounts. `GET /api?route=analysis/stats` (paid access) reads completed cache rows that carry a plan. For each market and period that still has open plans, it fetches the latest candles once, without any model call. It replays them with `lib/ai-outcomes.js` and saves the progress in `ai_analysis_cache.outcome`, so later checks continue where the last one stopped.

Replay rules: the entry fills when a closed candle trades through the entry price within 12 candles after the analysis; otherwise the plan is `not_triggered`. One third closes at each TP and the stop is fixed. When the stop and a target fall in the same candle, the stop counts first; on the entry candle only the stop can close the trade. A trade still open after 200 candles closes at that candle's close. When the provider history no longer reaches back to the last check, the plan is `unknown` and excluded from the rates. Results are theoretical: no spread, fees or slippage, and a conditional scenario's textual trigger is approximated by the entry touch.

Apply `supabase/migrations/20261101090000_pipvoria_ai_plan_outcomes.sql` before deploying. Until it is applied, analyses keep working and only the statistics panel reports itself unavailable.

## Verification

`npm run build` checks syntax/assets and runs the full suite. Tests cover closed-candle packets, stale data, references and numeric bounds, the Responses request and refusal paths, streamed results, cache reuse, persistent quotas, database permissions, approval/subscription checks and account changes during streaming.

`node tests/browser-fixture.mjs public --ai-preview --billing-preview` serves an explicitly synthetic UI fixture. Its simulated response verifies rendering only; a production analysis is needed to verify the real provider connection.
