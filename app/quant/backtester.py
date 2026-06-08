"""
Strategy Backtester (Track C).

A vectorized, lookahead-safe event backtester over deterministic synthetic daily
history. Supports several classic rule-based strategies (SMA/EMA crossover, RSI
mean-reversion, time-series momentum, Bollinger reversion), realistic transaction
costs, and a full institutional metric suite benchmarked against buy-and-hold.

Design guarantees:
- No lookahead: signals are shifted one bar before they trade.
- Deterministic: prices seeded by symbol, so a backtest is fully reproducible.
- Long/flat (no leverage) - equity can never go negative.
"""

from __future__ import annotations

import hashlib
from datetime import datetime, timedelta

import numpy as np

TRADING_DAYS = 252
_BASE_PRICES = {
    "AAPL": 225,
    "MSFT": 438,
    "NVDA": 136,
    "AMZN": 222,
    "GOOGL": 196,
    "META": 710,
    "TSLA": 339,
    "NFLX": 888,
    "AMD": 163,
    "INTC": 23,
    "UBER": 88,
}


def _seed(symbol: str) -> int:
    return int(hashlib.md5(symbol.upper().encode()).hexdigest()[:8], 16)


def _synth_prices(symbol: str, n: int) -> np.ndarray:
    """Deterministic GBM daily close path for a symbol."""
    rng = np.random.default_rng(_seed(symbol))
    base = _BASE_PRICES.get(symbol.upper(), 50 + (_seed(symbol) % 400))
    mu = rng.uniform(-0.02, 0.12) / TRADING_DAYS  # annual drift -> daily
    vol = rng.uniform(0.16, 0.40) / np.sqrt(TRADING_DAYS)  # annual vol -> daily
    shocks = rng.normal(mu - 0.5 * vol * vol, vol, n)
    # add a couple of mild regime waves for realism
    t = np.linspace(0, 6 * np.pi, n)
    drift_wave = 0.0004 * np.sin(t) + 0.0003 * np.sin(0.37 * t)
    path = base * np.exp(np.cumsum(shocks + drift_wave))
    return np.round(path, 2)


def _sma(x, w):
    w = max(1, int(w))
    c = np.cumsum(np.insert(x, 0, 0.0))
    out = np.full_like(x, np.nan, dtype=float)
    out[w - 1 :] = (c[w:] - c[:-w]) / w
    return out


def _ema(x, w):
    w = max(1, int(w))
    a = 2.0 / (w + 1.0)
    out = np.empty_like(x, dtype=float)
    out[0] = x[0]
    for i in range(1, len(x)):
        out[i] = a * x[i] + (1 - a) * out[i - 1]
    return out


def _rsi(x, period=14):
    period = max(2, int(period))
    delta = np.diff(x, prepend=x[0])
    gain = np.where(delta > 0, delta, 0.0)
    loss = np.where(delta < 0, -delta, 0.0)
    ag = np.zeros_like(x, dtype=float)
    al = np.zeros_like(x, dtype=float)
    ag[period] = gain[1 : period + 1].mean()
    al[period] = loss[1 : period + 1].mean()
    for i in range(period + 1, len(x)):
        ag[i] = (ag[i - 1] * (period - 1) + gain[i]) / period
        al[i] = (al[i - 1] * (period - 1) + loss[i]) / period
    rs = ag / np.where(al == 0, 1e-9, al)
    rsi = 100.0 - 100.0 / (1.0 + rs)
    rsi[:period] = 50.0
    return rsi


def _signal(strategy, price, p):
    n = len(price)
    sig = np.zeros(n)
    if strategy == "sma":
        f, s = _sma(price, p["fast"]), _sma(price, p["slow"])
        sig = np.where(f > s, 1.0, 0.0)
    elif strategy == "ema":
        f, s = _ema(price, p["fast"]), _ema(price, p["slow"])
        sig = np.where(f > s, 1.0, 0.0)
    elif strategy == "momentum":
        lb = max(1, int(p["slow"]))
        roc = np.full(n, 0.0)
        roc[lb:] = price[lb:] / price[:-lb] - 1.0
        trend = _sma(price, p["slow"])
        sig = np.where((roc > 0) & (price > trend), 1.0, 0.0)
    elif strategy == "rsi":
        rsi = _rsi(price, p["rsi_period"])
        pos = 0.0
        for i in range(n):
            if pos == 0.0 and rsi[i] < p["rsi_buy"]:
                pos = 1.0
            elif pos == 1.0 and rsi[i] > p["rsi_sell"]:
                pos = 0.0
            sig[i] = pos
    elif strategy == "bollinger":
        w = max(2, int(p["slow"]))
        mid = _sma(price, w)
        sd = np.full(n, np.nan)
        for i in range(w - 1, n):
            sd[i] = price[i - w + 1 : i + 1].std()
        lower = mid - 2.0 * sd
        pos = 0.0
        for i in range(n):
            if not np.isnan(lower[i]):
                if pos == 0.0 and price[i] < lower[i]:
                    pos = 1.0
                elif pos == 1.0 and price[i] > mid[i]:
                    pos = 0.0
            sig[i] = pos
    return np.nan_to_num(sig)


def _metrics(daily_ret, equity):
    n = len(daily_ret)
    years = max(n / TRADING_DAYS, 1e-9)
    total = equity[-1] / equity[0] - 1.0
    cagr = (equity[-1] / equity[0]) ** (1.0 / years) - 1.0
    vol = float(np.std(daily_ret) * np.sqrt(TRADING_DAYS))
    mean = float(np.mean(daily_ret))
    sharpe = (mean / np.std(daily_ret) * np.sqrt(TRADING_DAYS)) if np.std(daily_ret) > 0 else 0.0
    downside = daily_ret[daily_ret < 0]
    dstd = float(np.std(downside)) if downside.size else 0.0
    sortino = (mean / dstd * np.sqrt(TRADING_DAYS)) if dstd > 0 else 0.0
    peak = np.maximum.accumulate(equity)
    dd = equity / peak - 1.0
    max_dd = float(dd.min())
    calmar = (cagr / abs(max_dd)) if max_dd < 0 else 0.0
    return {
        "total_return": round(total * 100, 2),
        "cagr": round(cagr * 100, 2),
        "vol": round(vol * 100, 2),
        "sharpe": round(float(sharpe), 2),
        "sortino": round(float(sortino), 2),
        "max_drawdown": round(max_dd * 100, 2),
        "calmar": round(float(calmar), 2),
    }, dd


def run_backtest(
    symbol="AAPL",
    strategy="sma",
    fast=20,
    slow=50,
    rsi_period=14,
    rsi_buy=30,
    rsi_sell=55,
    cost_bps=5.0,
    years=3,
    initial=100000.0,
) -> dict:
    strategy = strategy.lower()
    if strategy not in ("sma", "ema", "rsi", "momentum", "bollinger"):
        return {"status": "invalid_strategy"}
    n = int(max(120, min(years, 10)) * TRADING_DAYS) if years >= 1 else int(years * TRADING_DAYS)
    n = int(max(150, min(n, 2520)))
    price = _synth_prices(symbol, n)

    p = {
        "fast": fast,
        "slow": slow,
        "rsi_period": rsi_period,
        "rsi_buy": rsi_buy,
        "rsi_sell": rsi_sell,
    }
    raw_sig = _signal(strategy, price, p)

    ret = np.zeros(n)
    ret[1:] = price[1:] / price[:-1] - 1.0
    pos = np.zeros(n)
    pos[1:] = raw_sig[:-1]  # trade on next bar (no lookahead)
    cost = (cost_bps / 1e4) * np.abs(np.diff(pos, prepend=0.0))
    net = pos * ret - cost
    equity = initial * np.cumprod(1.0 + net)
    bench = initial * (price / price[0])

    strat_m, dd = _metrics(net, equity)
    bench_ret = np.zeros(n)
    bench_ret[1:] = ret[1:]
    bench_m, _ = _metrics(bench_ret, bench)

    # trade extraction (long/flat) for win rate + profit factor
    trades, wins, gross_win, gross_loss, entry = [], 0, 0.0, 0.0, None
    end = datetime.utcnow().date()
    dates = [(end - timedelta(days=(n - 1 - i))).isoformat() for i in range(n)]
    signals = []
    for i in range(1, n):
        if pos[i] == 1.0 and pos[i - 1] == 0.0:
            entry = i
            signals.append({"date": dates[i], "type": "buy", "price": float(price[i])})
        elif pos[i] == 0.0 and pos[i - 1] == 1.0 and entry is not None:
            tr = price[i] / price[entry] - 1.0
            trades.append(tr)
            if tr > 0:
                wins += 1
                gross_win += tr
            else:
                gross_loss += -tr
            signals.append({"date": dates[i], "type": "sell", "price": float(price[i])})
            entry = None
    n_tr = len(trades)
    win_rate = round(100.0 * wins / n_tr, 1) if n_tr else 0.0
    profit_factor = (
        round(gross_win / gross_loss, 2)
        if gross_loss > 0
        else (round(gross_win, 2) if gross_win else 0.0)
    )

    strat_m.update(
        {
            "win_rate": win_rate,
            "trades": n_tr,
            "profit_factor": profit_factor,
            "exposure": round(float(pos.mean()) * 100, 1),
            "alpha": round(strat_m["total_return"] - bench_m["total_return"], 2),
        }
    )

    # downsample series to <= ~520 points for a light payload
    step = max(1, n // 520)
    idx = list(range(0, n, step))
    if idx[-1] != n - 1:
        idx.append(n - 1)
    series = [
        {
            "date": dates[i],
            "equity": round(float(equity[i]), 2),
            "benchmark": round(float(bench[i]), 2),
            "price": round(float(price[i]), 2),
            "drawdown": round(float(dd[i]) * 100, 2),
        }
        for i in idx
    ]

    return {
        "status": "success",
        "symbol": symbol.upper(),
        "strategy": strategy,
        "initial": initial,
        "params": p,
        "series": series,
        "signals": signals[-40:],  # cap marker count
        "metrics": strat_m,
        "benchmark": bench_m,
    }
