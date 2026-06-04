"""
Market Regime Detection System.

Classifies each bar of a price series into one of three latent market regimes
— **Bull**, **Bear**, or **Sideways** — using unsupervised K-Means clustering
over a small set of interpretable technical features.

Pipeline
--------
1. Feature engineering (compute_features):
   - log returns
   - rolling realized volatility (annualized)
   - trend strength = (EMA_fast - EMA_slow) / EMA_slow
   - momentum via RSI(14), centered to [-1, 1]
2. Standardize features (z-score) and fit K-Means (k=3, fixed seed → fully
   deterministic and reproducible).
3. Map anonymous clusters to named regimes by ordering clusters on their mean
   trend strength: highest → Bull, lowest → Bear, middle → Sideways.

Everything downstream of the synthetic/live price feed is pure and
deterministic, so the same inputs always yield the same regime map (no flicker,
testable).
"""

from __future__ import annotations

from typing import Dict, List

import numpy as np
import pandas as pd

from app.core.logger import get_logger
from app.market.fetch_stock_data import fetch_stock_data

logger = get_logger("regime")

REGIME_LABELS = ["Bull", "Bear", "Sideways"]

# Feature-engineering windows (in bars).
_EMA_FAST = 12
_EMA_SLOW = 26
_VOL_WINDOW = 14
_RSI_WINDOW = 14
_MIN_BARS = 40  # need enough history for stable features


# ---------------------------------------------------------------------------
# Feature engineering
# ---------------------------------------------------------------------------
def _rsi(close: pd.Series, window: int = _RSI_WINDOW) -> pd.Series:
    delta = close.diff()
    gain = delta.clip(lower=0.0)
    loss = -delta.clip(upper=0.0)
    avg_gain = gain.rolling(window).mean()
    avg_loss = loss.rolling(window).mean()
    rs = avg_gain / avg_loss.replace(0.0, np.nan)
    rsi = 100.0 - (100.0 / (1.0 + rs))
    # Where avg_loss == 0 (pure gains) RSI is 100; where no data, NaN.
    rsi = rsi.fillna(100.0).where(avg_loss.notna() | avg_gain.notna())
    return rsi


def compute_features(df: pd.DataFrame) -> pd.DataFrame:
    """Build the regime feature frame from an OHLCV DataFrame."""
    close = pd.to_numeric(df["close"], errors="coerce")
    out = pd.DataFrame(index=df.index)
    out["close"] = close
    out["ret"] = np.log(close / close.shift(1))
    out["volatility"] = out["ret"].rolling(_VOL_WINDOW).std() * np.sqrt(252.0)
    ema_fast = close.ewm(span=_EMA_FAST, adjust=False).mean()
    ema_slow = close.ewm(span=_EMA_SLOW, adjust=False).mean()
    out["trend"] = (ema_fast - ema_slow) / ema_slow.replace(0.0, np.nan)
    out["rsi"] = _rsi(close)
    out["momentum"] = (out["rsi"] - 50.0) / 50.0  # centered RSI in ~[-1, 1]
    return out.dropna()


# ---------------------------------------------------------------------------
# Clustering
# ---------------------------------------------------------------------------
def detect_regimes(features: pd.DataFrame, seed: int = 42) -> pd.Series:
    """
    Cluster bars into 3 regimes and return a Series of regime-name labels
    aligned to `features.index`.
    """
    cols = ["trend", "volatility", "momentum"]
    X = features[cols].to_numpy(dtype=float)

    # Standardize (z-score); guard zero-variance columns.
    mu = X.mean(axis=0)
    sigma = X.std(axis=0)
    sigma[sigma == 0] = 1.0
    Xz = (X - mu) / sigma

    n = len(Xz)
    k = 3 if n >= 3 else 1

    try:
        from sklearn.cluster import KMeans

        km = KMeans(n_clusters=k, n_init=10, random_state=seed)
        raw = km.fit_predict(Xz)
    except Exception:
        logger.exception("[regime] sklearn KMeans unavailable; using numpy fallback")
        raw = _numpy_kmeans(Xz, k=k, seed=seed)

    # Map clusters → regime names by mean trend (Bull highest, Bear lowest).
    trend = features["trend"].to_numpy(dtype=float)
    cluster_trend = {c: float(trend[raw == c].mean()) for c in np.unique(raw)}
    ordered = sorted(cluster_trend, key=lambda c: cluster_trend[c], reverse=True)

    mapping: Dict[int, str] = {}
    if len(ordered) == 3:
        mapping = {ordered[0]: "Bull", ordered[1]: "Sideways", ordered[2]: "Bear"}
    elif len(ordered) == 2:
        mapping = {ordered[0]: "Bull", ordered[1]: "Bear"}
    else:
        mapping = {ordered[0]: "Sideways"}

    labels = pd.Series([mapping[c] for c in raw], index=features.index, name="regime")
    return labels


def _numpy_kmeans(X: np.ndarray, k: int, seed: int, iters: int = 50) -> np.ndarray:
    """Deterministic Lloyd's K-Means (numpy-only fallback)."""
    rng = np.random.default_rng(seed)
    n = len(X)
    if n == 0:
        return np.array([], dtype=int)
    # k-means++ style seeding (deterministic via rng).
    centers = [X[rng.integers(n)]]
    for _ in range(1, k):
        d2 = np.min([np.sum((X - c) ** 2, axis=1) for c in centers], axis=0)
        probs = d2 / (d2.sum() or 1.0)
        centers.append(X[rng.choice(n, p=probs)])
    C = np.array(centers)
    labels = np.zeros(n, dtype=int)
    for _ in range(iters):
        dists = np.linalg.norm(X[:, None, :] - C[None, :, :], axis=2)
        new = dists.argmin(axis=1)
        if np.array_equal(new, labels):
            break
        labels = new
        for c in range(k):
            pts = X[labels == c]
            if len(pts):
                C[c] = pts.mean(axis=0)
    return labels


# ---------------------------------------------------------------------------
# Orchestration
# ---------------------------------------------------------------------------
def _transition_matrix(labels: List[str]) -> Dict[str, Dict[str, float]]:
    counts = {a: {b: 0 for b in REGIME_LABELS} for a in REGIME_LABELS}
    for a, b in zip(labels[:-1], labels[1:]):
        if a in counts and b in counts[a]:
            counts[a][b] += 1
    matrix: Dict[str, Dict[str, float]] = {}
    for a in REGIME_LABELS:
        row_total = sum(counts[a].values())
        matrix[a] = {
            b: (counts[a][b] / row_total if row_total else 0.0) for b in REGIME_LABELS
        }
    return matrix


def analyze_regime(symbol: str, interval: str = "1d") -> dict:
    """
    Full regime analysis for `symbol`. Returns a JSON-serializable dict:
      { symbol, interval, status, points:[{time, close, regime}], summary{...} }
    """
    symbol = symbol.upper()
    df = fetch_stock_data(symbol, interval=interval)
    if df is None or df.empty or len(df) < _MIN_BARS:
        return {
            "symbol": symbol,
            "interval": interval,
            "status": "insufficient_data",
            "points": [],
            "summary": {},
        }

    feats = compute_features(df)
    if len(feats) < _MIN_BARS:
        return {
            "symbol": symbol,
            "interval": interval,
            "status": "insufficient_data",
            "points": [],
            "summary": {},
        }

    labels = detect_regimes(feats)

    times = [int(pd.Timestamp(ts).timestamp()) for ts in feats.index]
    closes = feats["close"].astype(float).tolist()
    vols = feats["volatility"].astype(float).tolist()
    label_list = labels.tolist()

    points = [
        {"time": t, "close": round(c, 2), "regime": r}
        for t, c, r in zip(times, closes, label_list)
    ]

    n = len(label_list)
    distribution = {
        lbl: round(100.0 * label_list.count(lbl) / n, 2) for lbl in REGIME_LABELS
    }
    # Mean annualized volatility per regime (risk profile of each regime).
    regime_vol = {}
    for lbl in REGIME_LABELS:
        vs = [v for v, r in zip(vols, label_list) if r == lbl]
        regime_vol[lbl] = round(float(np.mean(vs)) * 100.0, 2) if vs else 0.0

    current = label_list[-1]
    # Run length of the current regime (how long we've been in it).
    run = 0
    for r in reversed(label_list):
        if r == current:
            run += 1
        else:
            break

    return {
        "symbol": symbol,
        "interval": interval,
        "status": "success",
        "points": points,
        "summary": {
            "current_regime": current,
            "current_run": run,
            "n_bars": n,
            "distribution": distribution,
            "regime_volatility": regime_vol,
            "transitions": _transition_matrix(label_list),
            "last_close": round(closes[-1], 2),
        },
    }
