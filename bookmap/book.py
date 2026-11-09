"""Order-book aggregation for the Pipvoria Bookmap, independent of the data feed so it can be tested offline.

Databento MBP-10 records carry the top 10 levels on each side after every event, plus trades (action "T").
Frames are emitted at a fixed cadence: the resting liquidity at that moment and the trades since the last frame.
"""
from __future__ import annotations

from collections import deque
from dataclasses import dataclass, field

PRICE_SCALE = 1_000_000_000
UNDEF_PRICE = 9_223_372_036_854_775_807


def to_price(raw: int) -> float | None:
    return None if raw == UNDEF_PRICE or raw <= 0 else round(raw / PRICE_SCALE, 6)


@dataclass
class Book:
    """Latest top-of-book depth and the trades accumulated for the next frame."""

    bids: list[tuple[float, int]] = field(default_factory=list)
    asks: list[tuple[float, int]] = field(default_factory=list)
    trades: dict[tuple[float, str], int] = field(default_factory=dict)
    last: float | None = None
    instrument_id: int | None = None
    updated_ns: int = 0

    def apply(self, *, levels, action: str, side: str, price: int, size: int, ts_event: int, instrument_id: int) -> None:
        """Apply one MBP-10 record. ``levels`` is a sequence of (bid_px, bid_sz, ask_px, ask_sz) raw tuples."""
        if self.instrument_id is not None and instrument_id != self.instrument_id:
            # The continuous symbol rolled to a new contract: drop the old book.
            self.bids, self.asks, self.trades = [], [], {}
        self.instrument_id = instrument_id
        bids, asks = [], []
        for bid_px, bid_sz, ask_px, ask_sz in levels:
            bp, ap = to_price(bid_px), to_price(ask_px)
            if bp is not None and bid_sz > 0:
                bids.append((bp, int(bid_sz)))
            if ap is not None and ask_sz > 0:
                asks.append((ap, int(ask_sz)))
        self.bids, self.asks = bids, asks
        if action == "T":
            px = to_price(price)
            if px is not None and size > 0:
                # Databento reports the aggressor side for trades: B = buyer lifted the offer, A = seller hit the bid.
                aggressor = "buy" if side == "B" else "sell" if side == "A" else "none"
                self.trades[(px, aggressor)] = self.trades.get((px, aggressor), 0) + int(size)
                self.last = px
        self.updated_ns = ts_event

    def frame(self, now_ms: int) -> dict | None:
        """A frame for ``now_ms``; None until the first record. Trades are reset after each frame."""
        if not self.bids and not self.asks:
            return None
        trades = [[px, sz, side] for (px, side), sz in sorted(self.trades.items())]
        self.trades = {}
        return {
            "t": now_ms,
            "bids": [[px, sz] for px, sz in self.bids],
            "asks": [[px, sz] for px, sz in self.asks],
            "trades": trades,
            "last": self.last,
        }


class FrameBuffer:
    """Rolling history so a page opening mid-session sees the last minutes at once."""

    def __init__(self, maxlen: int):
        self.frames: deque[dict] = deque(maxlen=maxlen)

    def push(self, frame: dict | None) -> dict | None:
        if frame is not None:
            self.frames.append(frame)
        return frame

    def since(self, t_ms: int = 0) -> list[dict]:
        return [f for f in self.frames if f["t"] > t_ms]
