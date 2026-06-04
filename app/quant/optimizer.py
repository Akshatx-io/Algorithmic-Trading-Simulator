"""
Smart Portfolio Optimizer — Monte-Carlo efficient frontier.

Generates thousands of random long-only portfolios over a basket of symbols,
computes each portfolio's annualized expected return, volatility, and Sharpe
ratio from the historical return covariance, and surfaces the two canonical
optima:

  * Max-Sharpe portfolio  — best risk-adjusted return (tangency portfolio).
  * Min-Volatility portfolio — lowest risk on the frontier.

Math
----
Given per-asset daily returns r:
  mu  = mean(r) * 252                      (annualized expected returns)
  Sig = cov(r) * 252                       (annualized covariance)
For weights w (w >= 0, sum w = 1):
  ret  = w . mu
  vol  = sqrt(w^T Sig w)
  shp  = (ret - rf) / vol

Fully vectorized over N portfolios and seeded → deterministic & reproducible.
"""

from __future__ import annotations

from typing import Dict, List

import numpy as np
import pandas as pd

from app.core.logger import get_logger
from app.market.fetch_stock_data import fetch_stock_data

logger = get_logger("optimizer")

TRADING_DAYS = 252
DEFAULT_RISK_FREE = 0.02
_MIN_OVERLAP = 30          # need at least this many aligned return rows
_MAX_FRONTIER_POINTS = 4000  # cap scatter payload sent to the client


def _returns_frame(symbols: List[str], interval: str) -> pd.DataFrame:
    """Build an aligned daily-returns DataFrame across the requested symbols."""
    closes: Dict[str, pd.Series] = {}
    for sym in symbols:
        df = fetch_stock_data(sym, interval=interval)
        if df is None or df.empty or "close" not in df.columns:
            continue
        closes[sym] = pd.to_numeric(df["close"], errors="coerce")
    if len(closes) < 2:
        return pd.DataFrame()
    prices = pd.DataFrame(closes).sort_index()
    returns = prices.pct_change().dropna(how="any")
    return returns


def optimize_portfolio(
    symbols: List[str],
    interval: str = "1d",
    n_portfolios: int = 6000,
    risk_free: float = DEFAULT_RISK_FREE,
    seed: int = 42,
) -> dict:
    """Run the Monte-Carlo optimization and return a JSON-serializable result."""
    symbols = [s.upper().strip() for s in symbols if s and s.strip()]
    symbols = list(dict.fromkeys(symbols))  # de-dupe, preserve order
    if len(symbols) < 2:
        return {"status": "need_two_symbols", "symbols": symbols}

    returns = _returns_frame(symbols, interval)
    if returns.empty or len(returns) < _MIN_OVERLAP or returns.shape[1] < 2:
        return {"status": "insufficient_data", "symbols": symbols}

    used = list(returns.columns)
    mu = returns.mean().to_numpy() * TRADING_DAYS
    sig = returns.cov().to_numpy() * TRADING_DAYS
    k = len(used)

    n = int(max(500, min(n_portfolios, 20000)))
    rng = np.random.default_rng(seed)

    # Random long-only weights: uniform simplex via normalize (allows
    # concentrated allocations, matching real optimizer output).
    W = rng.random((n, k))
    W /= W.sum(axis=1, keepdims=True)

    rets = W @ mu
    # Portfolio variance for each row: sum((W @ Sig) * W, axis=1)
    vols = np.sqrt(np.einsum("ij,jk,ik->i", W, sig, W))
    vols = np.where(vols <= 0, np.nan, vols)
    sharpe = (rets - risk_free) / vols

    max_i = int(np.nanargmax(sharpe))
    min_i = int(np.nanargmin(vols))

    def _portfolio(idx: int) -> dict:
        w = W[idx]
        return {
            "return": round(float(rets[idx]) * 100, 2),       # % annualized
            "volatility": round(float(vols[idx]) * 100, 2),   # % annualized
            "sharpe": round(float(sharpe[idx]), 3),
            "weights": {
                used[j]: round(float(w[j]) * 100, 2) for j in range(k)
            },
        }

    # Downsample the cloud for the client while always keeping both optima.
    if n > _MAX_FRONTIER_POINTS:
        sample_idx = rng.choice(n, size=_MAX_FRONTIER_POINTS, replace=False)
        sample_idx = np.unique(np.append(sample_idx, [max_i, min_i]))
    else:
        sample_idx = np.arange(n)

    frontier = [
        {
            "vol": round(float(vols[i]) * 100, 3),
            "ret": round(float(rets[i]) * 100, 3),
            "sharpe": round(float(sharpe[i]), 3),
        }
        for i in sample_idx
        if np.isfinite(vols[i])
    ]

    return {
        "status": "success",
        "symbols": used,
        "interval": interval,
        "n_portfolios": n,
        "risk_free": risk_free,
        "frontier": frontier,
        "max_sharpe": _portfolio(max_i),
        "min_vol": _portfolio(min_i),
    }
