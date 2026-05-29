# import yfinance as yf
# import pandas as pd


# def fetch_stock_data(symbol: str, interval: str = "1m"):

#     try:

#         period_map = {
#             "1m": "7d",
#             "5m": "60d",
#             "15m": "60d",
#             "60m": "730d",
#             "1d": "5y"
#         }

#         period = period_map.get(interval, "60d")

#         data = yf.download(
#             symbol,
#             period=period,
#             interval=interval,
#             auto_adjust=True,
#             progress=False
#         )

#         if data.empty:
#             return None

#         # Flatten MultiIndex columns if present
#         if isinstance(data.columns, pd.MultiIndex):
#             data.columns = data.columns.get_level_values(0)

#         df = data.rename(columns={
#             "Open": "open",
#             "High": "high",
#             "Low": "low",
#             "Close": "close",
#             "Volume": "volume"
#         })

#         df = df[["open", "high", "low", "close", "volume"]]

#         df = df.astype(float)

#         df.dropna(inplace=True)

#         return df

#     except Exception as e:

#         print("Market data error:", e)

#         return None






import yfinance as yf
import pandas as pd
import time
import io
from contextlib import redirect_stderr, redirect_stdout

CACHE = {}
CACHE_TTL = 5  # seconds


def _coerce_single_series(df: pd.DataFrame, col_name: str):
    """
    Normalize potentially duplicated columns into one numeric Series.
    """
    col_data = df[col_name]
    if isinstance(col_data, pd.DataFrame):
        col_data = col_data.iloc[:, 0]
    return pd.to_numeric(col_data, errors="coerce")


def fetch_stock_data(symbol: str, interval: str = "1m"):
    now = time.time()

    # =========================
    # CACHE HIT
    # =========================
    if symbol in CACHE:
        data, ts = CACHE[symbol]
        if now - ts < CACHE_TTL:
            return data

    period_map = {
        "1m": "7d",
        "2m": "60d",
        "5m": "60d",
        "15m": "60d",
        "30m": "60d",
        "60m": "730d",
        "90m": "60d",
        "1d": "5y",
    }
    period = period_map.get(interval, "60d")

    for attempt in range(2):
        try:
            # yfinance can print noisy download failures to stdout/stderr; keep logs controlled.
            with redirect_stdout(io.StringIO()), redirect_stderr(io.StringIO()):
                data = yf.download(
                    symbol,
                    period=period,
                    interval=interval,
                    progress=False,
                    auto_adjust=True,
                    threads=False,
                )

            if data is None or data.empty:
                if attempt == 0:
                    time.sleep(0.2)
                    continue
                return None

            if isinstance(data.columns, pd.MultiIndex):
                data.columns = data.columns.get_level_values(0)

            df = data.rename(columns={
                "Open": "open",
                "High": "high",
                "Low": "low",
                "Close": "close",
                "Volume": "volume"
            })

            required_cols = ["open", "high", "low", "close", "volume"]
            if any(col not in df.columns for col in required_cols):
                if attempt == 0:
                    time.sleep(0.2)
                    continue
                return None

            # Build a canonical single-column OHLCV frame to avoid duplicate-column surprises.
            normalized = pd.DataFrame(index=df.index)
            for col in required_cols:
                normalized[col] = _coerce_single_series(df, col)

            df = normalized.astype(float).dropna()
            if df.empty:
                return None

            # =========================
            # STORE CACHE
            # =========================
            CACHE[symbol] = (df, now)
            return df

        except Exception:
            if attempt == 0:
                time.sleep(0.2)
                continue
            return None

    return None