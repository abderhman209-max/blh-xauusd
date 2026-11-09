# Pipvoria Bookmap feed

A small always-on service: it keeps one Databento Live session on CME Globex (MBP-10, gold futures `GC.v.0`). Every 500 ms it turns the book into a frame (10 levels per side, plus the trades since the last frame) and serves the frames over SSE. Only the Vercel API calls it, with `x-bookmap-secret`; browsers never see this host or the Databento key. The terminal shows the Bookmap to the super admin only, because Databento's Standard CME licence covers personal use, not display to subscribers.

## Requirements

- A Databento account with a **CME live plan** (Standard). Without it, the session is refused and the terminal shows the error.
- A host that keeps a process running (Railway, Fly.io, Render, a VPS). Vercel functions cannot hold the TCP session.

## Deploy on Railway

1. railway.app → New Project → Deploy from GitHub repo → `blh-xauusd`.
2. Service → Settings → **Root Directory** `bookmap` (the Dockerfile is detected).
3. Variables:
   - `DATABENTO_API_KEY` = your Databento key
   - `BOOKMAP_SECRET` = a long random string (the same value goes into Vercel)
4. Settings → Networking → **Generate Domain**, then check `https://<domain>/health` → `{"ok": true, ...}`.
5. Vercel → blh-xauusd → Settings → Environment Variables (Production):
   - `BOOKMAP_URL` = `https://<domain>`
   - `BOOKMAP_SECRET` = the same string

   Then redeploy.

Optional: `BOOKMAP_SYMBOL` (default `GC.v.0`; `MGC.v.0` for micro gold), `BOOKMAP_FRAME_MS` (500), `BOOKMAP_HISTORY_S` (1800).

## Endpoints

- `GET /health`: public, `{ok, connected}`.
- `GET /history?since=<ms>`: secret, JSON frames.
- `GET /stream?since=<ms>`: secret, SSE frames, with `status` events every 15 s.

Frame: `{t, bids: [[price, size]...], asks: [[price, size]...], trades: [[price, size, "buy"|"sell"]...], last}`. In `trades`, `buy` means a buyer lifted the offer and `sell` means a seller hit the bid.

## Tests

```
pip install -r requirements.txt
python -m unittest test_book
```
