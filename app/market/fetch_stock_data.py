"""
Market data provider.

This platform is a *simulator*, so by default it serves a deterministic,
time-based synthetic market that runs 24/7 — independent of exchange hours,
network access, or third-party rate limits. This eliminates the price flicker
and cross-contaminated quotes that occur when a live provider (yfinance) is
unreliable (closed market, 429/403 throttling).

Design (synthetic mode)
-----------------------
Price is a pure function of (symbol, wall-clock time):

    price(symbol, t) = base(symbol) * (1 + smooth_noise(symbol, t))

Because it's a pure function of time, *every* caller (price engine, /market,
/candles, PnL engine, signal engine) computing at the same instant gets the
*same* value — so quotes never disagree or jump between unrelated numbers.
The noise is a sum of sine waves at different frequencies, giving smooth,
realistic intraday drift with a bounded amplitude (~2%).

Set `settings.use_synthetic_market = False` to prefer the live yfinance
provider, which still falls back to synthetic on any failure.
"""

from __future__ import annotations

import hashlib
import io
import math
import time
from contextlib import redirect_stderr, redirect_stdout

import pandas as pd

from app.core.config import settings

# ---------------------------------------------------------------------------
# Synthetic provider
# ---------------------------------------------------------------------------

# Realistic-ish anchor prices. Unknown symbols get a deterministic base.
BASE_PRICES = {
    # Plausible recent levels (simulated anchors — not live quotes).
    "AAPL": 228.0, "MSFT": 440.0, "NVDA": 135.0, "TSLA": 340.0, "AMZN": 220.0,
    "GOOGL": 195.0, "META": 720.0, "NFLX": 900.0, "AMD": 165.0, "INTC": 23.0,
    "UBER": 90.0,
}

_BUCKET_SECONDS = {
    "1m": 60, "2m": 120, "5m": 300, "15m": 900,
    "30m": 1800, "60m": 3600, "90m": 5400, "1d": 86400,
}

_HISTORY_BARS = 200


def _seed(symbol: str) -> int:
    return int(hashlib.md5(symbol.upper().encode()).hexdigest(), 16)


def _base_price(symbol: str) -> float:
    sym = symbol.upper()
    if sym in BASE_PRICES:
        return BASE_PRICES[sym]
    # Deterministic base in a sensible range for unknown symbols.
    return 40.0 + (_seed(sym) % 46000) / 100.0  # ~$40–$500


def _smooth_noise(symbol: str, t: float) -> float:
    """Bounded smooth multi-sine noise in roughly [-0.02, 0.02]."""
    phase = (_seed(symbol) % 100000) / 100000.0 * math.tau
    slow = math.sin(t / 900.0 + phase) * 0.012        # ~15-min swing
    mid = math.sin(t / 180.0 + phase * 1.7) * 0.006   # ~3-min swing
    fast = math.sin(t / 37.0 + phase * 2.3) * 0.0025  # ~37-sec ripple
    return slow + mid + fast


def price_at(symbol: str, t: float | None = None) -> float:
    """Deterministic spot price for `symbol` at unix time `t` (default now)."""
    if t is None:
        t = time.time()
    price = _base_price(symbol) * (1.0 + _smooth_noise(symbol, t))
    return round(max(price, 0.01), 2)


def _bar_jitter(symbol: str, bar_time: int) -> float:
    """Deterministic per-bar value in [0, 1) for stable high/low wicks."""
    h = hashlib.md5(f"{symbol.upper()}:{bar_time}".encode()).hexdigest()
    return (int(h[:8], 16) % 10000) / 10000.0


def _synthetic_df(symbol: str, interval: str) -> pd.DataFrame:
    bucket = _BUCKET_SECONDS.get(interval, 60)
    now = int(time.time())
    # Align the most recent bar to the bucket boundary.
    last_bar = (now // bucket) * bucket
    times = [last_bar - (_HISTORY_BARS - 1 - i) * bucket for i in range(_HISTORY_BARS)]

    closes = [price_at(symbol, t) for t in times]
    opens = [closes[0]] + closes[:-1]

    rows = []
    for i, t in enumerate(times):
        o = opens[i]
        c = closes[i]
        hi_base = max(o, c)
        lo_base = min(o, c)
        j1 = _bar_jitter(symbol, t)
        j2 = _bar_jitter(symbol, t + 1)
        high = hi_base * (1.0 + 0.0015 + 0.004 * j1)
        low = lo_base * (1.0 - 0.0015 - 0.004 * j2)
        volume = 50_000 + int(_bar_jitter(symbol, t + 2) * 950_000)
        rows.append((o, high, low, c, float(volume)))

    df = pd.DataFrame(
        rows,
        columns=["open", "high", "low", "close", "volume"],
        index=pd.to_datetime(times, unit="s"),
    )
    return df.astype(float)


# ---------------------------------------------------------------------------
# Live provider (yfinance) — used only when synthetic mode is disabled
# ---------------------------------------------------------------------------

_CACHE: dict = {}
_CACHE_TTL = 5  # seconds


def _coerce_single_series(df: pd.DataFrame, col_name: str):
    col_data = df[col_name]
    if isinstance(col_data, pd.DataFrame):
        col_data = col_data.iloc[:, 0]
    return pd.to_numeric(col_data, errors="coerce")


def _yfinance_df(symbol: str, interval: str):
    import yfinance as yf  # local import: optional in synthetic mode

    period_map = {
        "1m": "7d", "2m": "60d", "5m": "60d", "15m": "60d",
        "30m": "60d", "60m": "730d", "90m": "60d", "1d": "5y",
    }
    period = period_map.get(interval, "60d")

    cache_key = (symbol.upper(), interval)
    now = time.time()
    if cache_key in _CACHE:
        data, ts = _CACHE[cache_key]
        if now - ts < _CACHE_TTL:
            return data

    for attempt in range(2):
        try:
            with redirect_stdout(io.StringIO()), redirect_stderr(io.StringIO()):
                data = yf.download(
                    symbol, period=period, interval=interval,
                    progress=False, auto_adjust=True, threads=False,
                )
            if data is None or data.empty:
                if attempt == 0:
                    time.sleep(0.2)
                    continue
                return None
            if isinstance(data.columns, pd.MultiIndex):
                data.columns = data.columns.get_level_values(0)
            df = data.rename(columns={
                "Open": "open", "High": "high", "Low": "low",
                "Close": "close", "Volume": "volume",
            })
            required = ["open", "high", "low", "close", "volume"]
            if any(c not in df.columns for c in required):
                if attempt == 0:
                    time.sleep(0.2)
                    continue
                return None
            normalized = pd.DataFrame(index=df.index)
            for col in required:
                normalized[col] = _coerce_single_series(df, col)
            df = normalized.astype(float).dropna()
            if df.empty:
                return None
            _CACHE[cache_key] = (df, now)
            return df
        except Exception:
            if attempt == 0:
                time.sleep(0.2)
                continue
            return None
    return None


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def fetch_stock_data(symbol: str, interval: str = "1m"):
    """
    Return an OHLCV DataFrame (columns: open/high/low/close/volume).

    Synthetic by default (deterministic, no flicker, 24/7). When
    `use_synthetic_market` is False, prefer yfinance and fall back to
    synthetic on any failure so the app always has data.
    """
    if getattr(settings, "use_synthetic_market", True):
        return _synthetic_df(symbol, interval)

    live = _yfinance_df(symbol, interval)
    if live is not None and not live.empty:
        return live
    return _synthetic_df(symbol, interval)
