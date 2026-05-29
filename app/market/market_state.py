# from threading import Lock
# from collections import defaultdict


# class MarketState:
#     """
#     Central in-memory state store for entire trading system.
#     Acts as single source of truth for:
#     - Prices (tick data)
#     - Candles (OHLC)
#     - Signals
#     """

#     def __init__(self):
#         # Thread safety
#         self._lock = Lock()

#         # Latest tick prices: { symbol: float }
#         self.prices = {}

#         # Candles:
#         # {
#         #   symbol: {
#         #       timeframe: [ {open, high, low, close, time}, ... ]
#         #   }
#         # }
#         self.candles = defaultdict(lambda: defaultdict(list))

#         # Signals: { symbol: "BUY"/"SELL"/"HOLD" }

#     # ===============================
#     # SIGNAL STORAGE
#     # ===============================
#         self.signals = {}
    

#     # =========================
#     # PRICE METHODS
#     # =========================
#     def update_price(self, symbol: str, price: float):
#         with self._lock:
#             self.prices[symbol] = price

#     def get_price(self, symbol: str):
#         price = self.prices.get(symbol)

#         if price is None:
#             return None  # explicit

#         return float(price)

#     def get_all_prices(self):
#         return self.prices.copy()

#     # =========================
#     # CANDLE METHODS
#     # =========================
#     def add_candle(self, symbol: str, timeframe: str, candle: dict):
#         """
#         candle format:
#         {
#             "time": int,
#             "open": float,
#             "high": float,
#             "low": float,
#             "close": float
#         }
#         """
#         with self._lock:
#             self.candles[symbol][timeframe].append(candle)

#     def get_candles(self, symbol: str, timeframe: str):
#         return self.candles[symbol][timeframe]

#     def get_latest_candle(self, symbol: str, timeframe: str):
#         candles = self.candles[symbol][timeframe]
#         return candles[-1] if candles else None

#     # =========================
#     # SIGNAL METHODS
#     # =========================
#     def update_signal(self, symbol: str, signal: str):
#         with self._lock:
#             self.signals[symbol] = signal

#     def get_signal(self, symbol: str):
#         # return self.signals.get(symbol)
#          return self.signals.get(symbol, "HOLD")

#     def get_all_signals(self):
#         return self.signals.copy()


# # Global singleton instance
# market_state = MarketState()





from threading import Lock
from collections import defaultdict, deque
from typing import Dict, List, Optional


MAX_CANDLES = 500  # prevent memory leak


class MarketState:
    def __init__(self):
        self._lock = Lock()

        self.prices: Dict[str, float] = {}
        self.price_timestamp: Dict[str, int] = {}

        self.candles = defaultdict(
            lambda: defaultdict(lambda: deque(maxlen=MAX_CANDLES))
        )

        self.signals: Dict[str, str] = {}

    # =========================
    # PRICE METHODS
    # =========================
    def update_price(self, symbol: str, price: float, timestamp: int):
        with self._lock:
            self.prices[symbol] = float(price)
            self.price_timestamp[symbol] = timestamp

    def get_price(self, symbol: str) -> Optional[float]:
        with self._lock:
            return self.prices.get(symbol)

    def get_price_with_time(self, symbol: str):
        with self._lock:
            return (
                self.prices.get(symbol),
                self.price_timestamp.get(symbol),
            )

    def get_all_prices(self):
        with self._lock:
            return dict(self.prices)

    # =========================
    # CANDLE METHODS
    # =========================
    def add_candle(self, symbol: str, timeframe: str, candle: dict):
        with self._lock:
            self.candles[symbol][timeframe].append(candle)

    def get_candles(self, symbol: str, timeframe: str) -> List[dict]:
        with self._lock:
            return list(self.candles[symbol][timeframe])

    def get_latest_candle(self, symbol: str, timeframe: str):
        with self._lock:
            candles = self.candles[symbol][timeframe]
            return candles[-1] if candles else None

    # =========================
# SIGNAL METHODS (ELITE FIX)
# =========================
    def update_signal(self, symbol: str, signal: str):
        """
        Thread-safe signal update.
        Always ensures valid signal string.
        """
        with self._lock:
            if signal not in ("BUY", "SELL", "HOLD"):
                signal = "HOLD"

            self.signals[symbol] = signal


    def get_signal(self, symbol: str):
        with self._lock:
            return self.signals.get(symbol, "HOLD")


    def get_all_signals(self):
        with self._lock:
            return dict(self.signals)


market_state = MarketState()