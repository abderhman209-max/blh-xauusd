"""Pipvoria Bookmap feed: Databento Live (CME Globex, MBP-10) aggregated into frames and served over SSE.

Runs as one always-on process (Railway, Fly.io or a small VPS). Only the Vercel API talks to it, with the
shared BOOKMAP_SECRET header; browsers never see this host or the Databento key.

Environment:
  DATABENTO_API_KEY  Databento key with a CME live plan (required)
  BOOKMAP_SECRET     shared secret, same value as in Vercel (required)
  BOOKMAP_SYMBOL     continuous symbol, default GC.v.0 (front gold future by volume)
  BOOKMAP_FRAME_MS   frame cadence in ms, default 500
  BOOKMAP_HISTORY_S  history kept in memory in seconds, default 1800
  PORT               HTTP port, default 8080
"""
from __future__ import annotations

import asyncio
import hmac
import json
import logging
import os
import time

import databento as db
from aiohttp import web

from book import Book, FrameBuffer

log = logging.getLogger("bookmap")
SYMBOL = os.environ.get("BOOKMAP_SYMBOL", "GC.v.0")
FRAME_MS = max(200, int(os.environ.get("BOOKMAP_FRAME_MS", "500")))
HISTORY = FrameBuffer(int(os.environ.get("BOOKMAP_HISTORY_S", "1800")) * 1000 // FRAME_MS)
STATE = {"connected": False, "last_record": 0.0, "error": None, "symbol": SYMBOL, "contract": None}
SUBSCRIBERS: set[asyncio.Queue] = set()


def char(value) -> str:
    """Databento returns enum members or plain characters depending on the record source."""
    return str(getattr(value, "value", value))


def authorized(request: web.Request) -> bool:
    secret = os.environ.get("BOOKMAP_SECRET", "")
    return bool(secret) and hmac.compare_digest(request.headers.get("x-bookmap-secret", ""), secret)


async def feed(book: Book) -> None:
    """Keep one Databento Live session open, reconnecting with a backoff when it drops."""
    delay = 1
    while True:
        client = None
        try:
            client = db.Live(key=os.environ["DATABENTO_API_KEY"], reconnect_policy=db.ReconnectPolicy.RECONNECT)
            client.subscribe(dataset="GLBX.MDP3", schema="mbp-10", stype_in="continuous", symbols=[SYMBOL])
            STATE.update(connected=True, error=None)
            delay = 1
            async for record in client:
                if isinstance(record, db.SymbolMappingMsg):
                    STATE["contract"] = getattr(record, "stype_out_symbol", None)
                elif isinstance(record, db.ErrorMsg):
                    STATE["error"] = str(getattr(record, "err", "error"))[:200]
                elif isinstance(record, db.MBP10Msg):
                    levels = [(lv.bid_px, lv.bid_sz, lv.ask_px, lv.ask_sz) for lv in record.levels]
                    book.apply(levels=levels, action=char(record.action), side=char(record.side), price=record.price,
                               size=record.size, ts_event=record.ts_event, instrument_id=record.instrument_id)
                    STATE["last_record"] = time.time()
        except Exception as error:  # noqa: BLE001 - any feed failure must lead to a reconnect, never a crash
            STATE.update(connected=False, error=type(error).__name__)
            log.warning("feed error %s; reconnecting in %ss", type(error).__name__, delay)
        finally:
            if client is not None:
                try:
                    client.terminate()
                except Exception:  # noqa: BLE001
                    pass
        STATE["connected"] = False
        await asyncio.sleep(delay)
        delay = min(delay * 2, 60)


async def framer(book: Book) -> None:
    while True:
        await asyncio.sleep(FRAME_MS / 1000)
        frame = HISTORY.push(book.frame(int(time.time() * 1000)))
        if frame is None:
            continue
        for queue in list(SUBSCRIBERS):
            if queue.full():
                SUBSCRIBERS.discard(queue)  # a reader that cannot keep up reconnects and gets history again
            else:
                queue.put_nowait(frame)


def status() -> dict:
    age = time.time() - STATE["last_record"] if STATE["last_record"] else None
    return {**STATE, "last_record_age_s": None if age is None else round(age, 1), "frame_ms": FRAME_MS}


async def health(_request: web.Request) -> web.Response:
    return web.json_response({"ok": True, "connected": STATE["connected"]})


async def history(request: web.Request) -> web.Response:
    if not authorized(request):
        raise web.HTTPNotFound()
    since = int(request.query.get("since", "0") or 0)
    return web.json_response({"status": status(), "frames": HISTORY.since(since)})


async def stream(request: web.Request) -> web.StreamResponse:
    if not authorized(request):
        raise web.HTTPNotFound()
    response = web.StreamResponse(headers={"content-type": "text/event-stream", "cache-control": "no-store"})
    await response.prepare(request)
    queue: asyncio.Queue = asyncio.Queue(maxsize=600)
    SUBSCRIBERS.add(queue)
    try:
        await response.write(b"retry: 1500\n\n")
        await response.write(("event: status\ndata: " + json.dumps(status()) + "\n\n").encode())
        for frame in HISTORY.since(int(request.query.get("since", "0") or 0)):
            await response.write(("data: " + json.dumps(frame, separators=(",", ":")) + "\n\n").encode())
        while True:
            try:
                frame = await asyncio.wait_for(queue.get(), timeout=15)
                await response.write(("data: " + json.dumps(frame, separators=(",", ":")) + "\n\n").encode())
            except asyncio.TimeoutError:
                await response.write(("event: status\ndata: " + json.dumps(status()) + "\n\n").encode())
    except (ConnectionResetError, asyncio.CancelledError):
        pass
    finally:
        SUBSCRIBERS.discard(queue)
    return response


async def start_background(app: web.Application) -> None:
    book = Book()
    app["tasks"] = [asyncio.create_task(feed(book)), asyncio.create_task(framer(book))]


def main() -> None:
    logging.basicConfig(level=logging.INFO)
    if not os.environ.get("DATABENTO_API_KEY") or not os.environ.get("BOOKMAP_SECRET"):
        raise SystemExit("DATABENTO_API_KEY and BOOKMAP_SECRET are required")
    app = web.Application()
    app.add_routes([web.get("/health", health), web.get("/history", history), web.get("/stream", stream)])
    app.on_startup.append(start_background)
    web.run_app(app, port=int(os.environ.get("PORT", "8080")))


if __name__ == "__main__":
    main()
