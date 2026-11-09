import unittest
from book import Book, FrameBuffer, PRICE_SCALE, UNDEF_PRICE

px = lambda p: int(round(p * PRICE_SCALE))
LEVELS = [(px(4000.0 - i / 10), 5 + i, px(4000.1 + i / 10), 3 + i) for i in range(10)]


class BookTest(unittest.TestCase):
    def test_frame_has_depth_and_aggregated_trades_then_resets_trades(self):
        book = Book()
        self.assertIsNone(book.frame(1))
        book.apply(levels=LEVELS, action="A", side="B", price=px(4000.0), size=1, ts_event=1, instrument_id=7)
        book.apply(levels=LEVELS, action="T", side="B", price=px(4000.1), size=2, ts_event=2, instrument_id=7)
        book.apply(levels=LEVELS, action="T", side="B", price=px(4000.1), size=3, ts_event=3, instrument_id=7)
        book.apply(levels=LEVELS, action="T", side="A", price=px(4000.0), size=1, ts_event=4, instrument_id=7)
        frame = book.frame(1000)
        self.assertEqual(frame["bids"][0], [4000.0, 5])
        self.assertEqual(frame["asks"][0], [4000.1, 3])
        self.assertEqual(len(frame["bids"]), 10)
        self.assertEqual(frame["trades"], [[4000.0, 1, "sell"], [4000.1, 5, "buy"]])
        self.assertEqual(frame["last"], 4000.0)
        self.assertEqual(book.frame(1500)["trades"], [])

    def test_empty_levels_and_undefined_prices_are_skipped(self):
        book = Book()
        levels = [(px(4000.0), 5, UNDEF_PRICE, 0)] + [(UNDEF_PRICE, 0, UNDEF_PRICE, 0)] * 9
        book.apply(levels=levels, action="A", side="B", price=px(4000.0), size=1, ts_event=1, instrument_id=7)
        frame = book.frame(1)
        self.assertEqual(frame["bids"], [[4000.0, 5]])
        self.assertEqual(frame["asks"], [])

    def test_a_contract_roll_drops_pending_trades(self):
        book = Book()
        book.apply(levels=LEVELS, action="T", side="B", price=px(4000.1), size=2, ts_event=1, instrument_id=7)
        book.apply(levels=LEVELS, action="A", side="B", price=px(4000.0), size=1, ts_event=2, instrument_id=8)
        self.assertEqual(book.frame(1)["trades"], [])

    def test_buffer_keeps_the_latest_frames(self):
        buffer = FrameBuffer(3)
        for t in range(5):
            buffer.push({"t": t})
        buffer.push(None)
        self.assertEqual([f["t"] for f in buffer.since()], [2, 3, 4])
        self.assertEqual([f["t"] for f in buffer.since(3)], [4])


if __name__ == "__main__":
    unittest.main()
