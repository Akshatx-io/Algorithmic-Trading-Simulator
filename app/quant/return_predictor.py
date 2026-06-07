"""
Stock Return Predictor (Track C).

Pipeline mirrors a classic ML+quant workflow:
  1. Build features from price/volume history (lagged returns, MA ratios, rolling
     volatility, RSI, volume z-score, momentum).
  2. Train a Random Forest regressor to predict next-day return (time-ordered
     split, so the test set is strictly out-of-sample - no leakage).
  3. Backtest a long/short strategy (sign of predicted return) vs buy-and-hold.
  4. Evaluate robustness with Monte Carlo bootstrap resampling of the strategy's
     daily returns (a distribution of equity paths, not a single curve).

The Random Forest is implemented from scratch in numpy (bagging + random feature
subsets + variance-reduction CART splits) so the module is dependency-free,
deterministic, and fast.
"""

from __future__ import annotations

import hashlib
import numpy as np

TRADING_DAYS = 252
_BASE = {
    "AAPL": 225, "MSFT": 438, "NVDA": 136, "AMZN": 222, "GOOGL": 196,
    "META": 710, "TSLA": 339, "NFLX": 888, "AMD": 163, "INTC": 23, "UBER": 88,
}
_FEATURES = ["ret_1", "ret_2", "ret_3", "ret_5", "ma5", "ma10", "ma20",
             "roc10", "vol10", "vol20", "rsi14", "volz10"]


def _seed(symbol: str) -> int:
    return int(hashlib.md5(symbol.upper().encode()).hexdigest()[:8], 16)


def _synth(symbol: str, n: int):
    rng = np.random.default_rng(_seed(symbol))
    base = _BASE.get(symbol.upper(), 50 + _seed(symbol) % 400)
    mu = rng.uniform(-0.01, 0.13) / TRADING_DAYS
    vol = rng.uniform(0.16, 0.42) / np.sqrt(TRADING_DAYS)
    eps = rng.normal(0, vol, n)
    r = np.zeros(n)
    for i in range(1, n):
        r[i] = 0.12 * r[i - 1] + (mu - 0.5 * vol * vol) + eps[i]
    close = base * np.exp(np.cumsum(r))
    vols = rng.lognormal(mean=15.0, sigma=0.4, size=n)
    return np.round(close, 4), vols


def _sma(x, w):
    c = np.cumsum(np.insert(x, 0, 0.0))
    out = np.full_like(x, np.nan, dtype=float)
    out[w - 1:] = (c[w:] - c[:-w]) / w
    return out


def _rsi(x, period=14):
    delta = np.diff(x, prepend=x[0])
    gain = np.where(delta > 0, delta, 0.0)
    loss = np.where(delta < 0, -delta, 0.0)
    ag = np.zeros_like(x); al = np.zeros_like(x)
    ag[period] = gain[1:period + 1].mean(); al[period] = loss[1:period + 1].mean()
    for i in range(period + 1, len(x)):
        ag[i] = (ag[i - 1] * (period - 1) + gain[i]) / period
        al[i] = (al[i - 1] * (period - 1) + loss[i]) / period
    rs = ag / np.where(al == 0, 1e-9, al)
    out = 100 - 100 / (1 + rs); out[:period] = 50.0
    return out


def _rolling_std(x, w):
    out = np.full_like(x, np.nan, dtype=float)
    for i in range(w, len(x)):
        out[i] = x[i - w + 1:i + 1].std()
    return out


def _build_features(close, vols):
    n = len(close)
    ret = np.zeros(n); ret[1:] = close[1:] / close[:-1] - 1.0
    f = {
        "ret_1": np.roll(ret, 1), "ret_2": np.roll(ret, 2),
        "ret_3": np.roll(ret, 3), "ret_5": np.roll(ret, 5),
        "ma5": close / _sma(close, 5) - 1.0,
        "ma10": close / _sma(close, 10) - 1.0,
        "ma20": close / _sma(close, 20) - 1.0,
        "roc10": np.concatenate([np.zeros(10), close[10:] / close[:-10] - 1.0]),
        "vol10": _rolling_std(ret, 10),
        "vol20": _rolling_std(ret, 20),
        "rsi14": (_rsi(close, 14) - 50.0) / 50.0,
        "volz10": (vols - _sma(vols, 10)) / (_rolling_std(vols, 10) + 1e-9),
    }
    X = np.column_stack([f[k] for k in _FEATURES])
    y = np.concatenate([ret[1:], [0.0]])
    valid = ~np.isnan(X).any(axis=1)
    valid[-1] = False
    return X, y, ret, valid


def _best_split(X, y, idx, feats, min_leaf):
    yv = y[idx]
    parent = float(((yv - yv.mean()) ** 2).sum())
    best_gain, bf, bt = 0.0, None, None
    for f in feats:
        xv = X[idx, f]
        order = np.argsort(xv, kind="mergesort")
        xs = xv[order]; ys = yv[order]
        n = len(ys)
        csum = np.cumsum(ys); csum2 = np.cumsum(ys * ys)
        tot, tot2 = csum[-1], csum2[-1]
        ln = np.arange(1, n); rn = n - ln
        ls = csum[:-1]; rs = tot - ls
        sse_l = csum2[:-1] - ls * ls / ln
        sse_r = (tot2 - csum2[:-1]) - rs * rs / rn
        sse = sse_l + sse_r
        bad = (xs[1:] == xs[:-1]) | (ln < min_leaf) | (rn < min_leaf)
        sse = np.where(bad, np.inf, sse)
        k = int(np.argmin(sse))
        if np.isfinite(sse[k]):
            gain = parent - sse[k]
            if gain > best_gain:
                best_gain, bf, bt = gain, int(f), float((xs[k] + xs[k + 1]) / 2)
    return bf, bt, best_gain


def _fit_tree(X, y, idx, depth, rng, imp, max_depth, min_split, min_leaf, mf):
    yv = y[idx]
    if depth >= max_depth or len(idx) < min_split or yv.var() < 1e-12:
        return {"v": float(yv.mean())}
    feats = rng.choice(X.shape[1], size=mf, replace=False)
    bf, bt, gain = _best_split(X, y, idx, feats, min_leaf)
    if bf is None or gain <= 0:
        return {"v": float(yv.mean())}
    imp[bf] += gain
    mask = X[idx, bf] <= bt
    li, ri = idx[mask], idx[~mask]
    if len(li) < min_leaf or len(ri) < min_leaf:
        return {"v": float(yv.mean())}
    return {
        "f": bf, "t": bt,
        "L": _fit_tree(X, y, li, depth + 1, rng, imp, max_depth, min_split, min_leaf, mf),
        "R": _fit_tree(X, y, ri, depth + 1, rng, imp, max_depth, min_split, min_leaf, mf),
    }


def _pred_tree(node, row):
    while "v" not in node:
        node = node["L"] if row[node["f"]] <= node["t"] else node["R"]
    return node["v"]


class RandomForest:
    def __init__(self, n_estimators=80, max_depth=6, min_split=10, min_leaf=5, seed=42):
        self.n = n_estimators; self.md = max_depth
        self.ms = min_split; self.ml = min_leaf; self.seed = seed
        self.trees = []; self.importances = None

    def fit(self, X, y):
        rng = np.random.default_rng(self.seed)
        N, P = X.shape
        mf = max(1, P // 3)
        imp = np.zeros(P)
        self.trees = []
        for _ in range(self.n):
            boot = rng.integers(0, N, N)
            self.trees.append(_fit_tree(X, y, boot, 0, rng, imp, self.md, self.ms, self.ml, mf))
        s = imp.sum()
        self.importances = imp / s if s > 0 else imp
        return self

    def predict(self, X):
        out = np.zeros(len(X))
        for r in range(len(X)):
            out[r] = np.mean([_pred_tree(t, X[r]) for t in self.trees])
        return out

    def predict_sign_agreement(self, row):
        preds = np.array([_pred_tree(t, row) for t in self.trees])
        mean = preds.mean()
        agree = np.mean(np.sign(preds) == np.sign(mean)) if mean != 0 else 0.5
        return mean, float(agree)


def _sharpe(r):
    sd = np.std(r)
    return float(np.mean(r) / sd * np.sqrt(TRADING_DAYS)) if sd > 0 else 0.0


def _max_dd(equity):
    peak = np.maximum.accumulate(equity)
    return float((equity / peak - 1.0).min())


def predict_returns(symbol="AAPL", years=4, n_estimators=80, max_depth=6,
                    cost_bps=2.0, mc_sims=400) -> dict:
    n = int(max(2, min(years, 8)) * TRADING_DAYS)
    close, vols = _synth(symbol, n)
    X, y, ret, valid = _build_features(close, vols)
    Xv, yv = X[valid], y[valid]
    vidx = np.where(valid)[0]

    split = int(len(Xv) * 0.7)
    Xtr, ytr = Xv[:split], yv[:split]
    Xte, yte = Xv[split:], yv[split:]

    rf = RandomForest(n_estimators=n_estimators, max_depth=max_depth, seed=_seed(symbol) % 9999)
    rf.fit(Xtr, ytr)
    pred = rf.predict(Xte)

    sse = float(((yte - pred) ** 2).sum())
    sst = float(((yte - yte.mean()) ** 2).sum()) or 1e-12
    r2 = 1.0 - sse / sst
    rmse = float(np.sqrt(np.mean((yte - pred) ** 2)))
    mae = float(np.mean(np.abs(yte - pred)))
    dir_acc = float(np.mean(np.sign(pred) == np.sign(yte)) * 100.0)
    ic = float(np.corrcoef(pred, yte)[0, 1]) if np.std(pred) > 0 else 0.0

    pos = np.sign(pred); pos[pos == 0] = 1.0
    cost = (cost_bps / 1e4) * np.abs(np.diff(pos, prepend=pos[0]))
    strat_r = pos * yte - cost
    eq = np.cumprod(1.0 + strat_r)
    bench = np.cumprod(1.0 + yte)

    strat_metrics = {
        "total_return": round((eq[-1] - 1) * 100, 2),
        "sharpe": round(_sharpe(strat_r), 2),
        "max_drawdown": round(_max_dd(eq) * 100, 2),
        "win_rate": round(float(np.mean(strat_r > 0) * 100), 1),
        "alpha": round((eq[-1] - bench[-1]) * 100, 2),
    }
    bench_metrics = {
        "total_return": round((bench[-1] - 1) * 100, 2),
        "sharpe": round(_sharpe(yte), 2),
        "max_drawdown": round(_max_dd(bench) * 100, 2),
    }

    rng = np.random.default_rng(7)
    L = len(strat_r)
    sims = int(max(50, min(mc_sims, 1000)))
    paths = np.empty((sims, L))
    for s in range(sims):
        paths[s] = np.cumprod(1.0 + strat_r[rng.integers(0, L, L)])
    terminal = paths[:, -1]
    p5 = np.percentile(paths, 5, axis=0)
    p50 = np.percentile(paths, 50, axis=0)
    p95 = np.percentile(paths, 95, axis=0)
    prob_profit = round(float(np.mean(terminal > 1.0) * 100), 1)

    step = max(1, L // 160)
    di = list(range(0, L, step))
    if di[-1] != L - 1:
        di.append(L - 1)
    equity_series = [{"i": int(k), "strategy": round(float(eq[k]), 4), "benchmark": round(float(bench[k]), 4)} for k in di]
    mc_bands = [{"i": int(k), "p5": round(float(p5[k]), 4), "p50": round(float(p50[k]), 4), "p95": round(float(p95[k]), 4)} for k in di]
    fan = [[round(float(paths[s, k]), 4) for k in di] for s in range(min(40, sims))]

    ssz = min(len(pred), 160)
    sidx = np.linspace(0, len(pred) - 1, ssz).astype(int)
    scatter = [{"actual": round(float(yte[i] * 100), 3), "pred": round(float(pred[i] * 100), 3)} for i in sidx]

    tr = (terminal - 1.0) * 100.0
    counts, edges = np.histogram(tr, bins=28)
    hist = [{"ret": round(float((edges[i] + edges[i + 1]) / 2), 2), "count": int(counts[i])} for i in range(len(counts))]

    importances = sorted(
        [{"feature": _FEATURES[i], "importance": round(float(rf.importances[i] * 100), 2)} for i in range(len(_FEATURES))],
        key=lambda d: d["importance"], reverse=True,
    )

    last_row = X[vidx[-1]]
    nd_mean, nd_agree = rf.predict_sign_agreement(last_row)
    next_day = {
        "pred_return": round(float(nd_mean * 100), 3),
        "direction": "UP" if nd_mean >= 0 else "DOWN",
        "confidence": round(nd_agree * 100, 1),
    }

    return {
        "status": "success",
        "symbol": symbol.upper(),
        "model": f"RandomForest({n_estimators} trees, depth {max_depth})",
        "metrics": {
            "r2": round(r2, 4), "rmse": round(rmse * 100, 3), "mae": round(mae * 100, 3),
            "directional_acc": round(dir_acc, 1), "ic": round(ic, 3),
            "n_train": int(split), "n_test": int(len(Xte)),
        },
        "strategy": strat_metrics,
        "benchmark": bench_metrics,
        "next_day": next_day,
        "importances": importances,
        "equity": equity_series,
        "mc_bands": mc_bands,
        "mc_fan": fan,
        "mc": {"prob_profit": prob_profit,
               "median_return": round(float((np.median(terminal) - 1) * 100), 2),
               "p5_return": round(float((np.percentile(terminal, 5) - 1) * 100), 2),
               "p95_return": round(float((np.percentile(terminal, 95) - 1) * 100), 2),
               "sims": sims},
        "terminal_hist": hist,
        "scatter": scatter,
    }
