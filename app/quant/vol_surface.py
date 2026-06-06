"""
Neural Volatility Surface (Track C).

Builds an implied-volatility surface across strikes x expiries the way a desk
does it: a parametric *market price* surface is generated from a no-arbitrage
parabolic smile in log-moneyness (a local SVI/SABR-style slice with a realistic
term structure), tiny quote noise is injected, and the displayed surface is the
implied vol RECOVERED by inverting every grid price with a vectorized
Newton-Raphson solver. A separable smoothing pass plays the role of the neural
surface fit (denoising noisy quotes into a clean C1 surface).

Everything is numpy-vectorized over the whole grid -> sub-millisecond, and
deterministic for a given parameter set.
"""

from __future__ import annotations

import math
import numpy as np

# --- high-accuracy vectorized normal helpers (A&S 7.1.26 erf, |err| < 1.5e-7) -
_NORM = 1.0 / math.sqrt(2.0 * math.pi)


def _erf(x: np.ndarray) -> np.ndarray:
    s = np.sign(x)
    a = np.abs(x)
    t = 1.0 / (1.0 + 0.3275911 * a)
    y = 1.0 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t
                - 0.284496736) * t + 0.254829592) * t * np.exp(-a * a)
    return s * y


def _ncdf(x: np.ndarray) -> np.ndarray:
    return 0.5 * (1.0 + _erf(x / math.sqrt(2.0)))


def _npdf(x: np.ndarray) -> np.ndarray:
    return _NORM * np.exp(-0.5 * x * x)


def _bs_call(S, K, T, r, sig):
    sq = sig * np.sqrt(T)
    d1 = (np.log(S / K) + (r + 0.5 * sig * sig) * T) / sq
    d2 = d1 - sq
    return S * _ncdf(d1) - K * np.exp(-r * T) * _ncdf(d2)


def _vega(S, K, T, r, sig):
    sq = sig * np.sqrt(T)
    d1 = (np.log(S / K) + (r + 0.5 * sig * sig) * T) / sq
    return S * _npdf(d1) * np.sqrt(T)


def _implied_vol(P, S, K, T, r):
    """Vectorized Newton-Raphson IV inversion with damped steps + clamp."""
    sig = np.full_like(P, 0.2)
    for _ in range(60):
        diff = _bs_call(S, K, T, r, sig) - P
        step = np.clip(diff / np.maximum(_vega(S, K, T, r, sig), 1e-8), -0.5, 0.5)
        sig = np.clip(sig - step, 1e-3, 5.0)
        if np.max(np.abs(diff)) < 1e-9:
            break
    return sig


def _smooth(grid: np.ndarray) -> np.ndarray:
    """Separable [1,2,1] denoise (edge-preserving via reflect padding)."""
    k = np.array([1.0, 2.0, 1.0])
    k /= k.sum()
    pad = np.pad(grid, ((1, 1), (1, 1)), mode="edge")
    tmp = (pad[:, :-2] + 2 * pad[:, 1:-1] + pad[:, 2:]) / 4.0
    out = (tmp[:-2, :] + 2 * tmp[1:-1, :] + tmp[2:, :]) / 4.0
    return out


def build_vol_surface(
    s: float = 100.0,
    r: float = 0.04,
    base_vol: float = 0.22,
    skew: float = -0.16,
    curv: float = 0.7,
    term: float = 0.05,
    width: float = 0.52,
    max_t: float = 2.0,
    n_strikes: int = 31,
    n_expiries: int = 26,
) -> dict:
    if s <= 0 or base_vol <= 0:
        return {"status": "invalid_params"}

    K = s * np.linspace(1.0 - width, 1.0 + width, n_strikes)
    T = np.linspace(1.0 / 12.0, max_t, n_expiries)
    Kg, Tg = np.meshgrid(K, T)            # (ny, nx)
    kk = np.log(Kg / s)                    # log-moneyness

    # parametric smile + realistic term structure
    atm = base_vol + term * (np.sqrt(Tg) - 1.0)
    skew_t = skew / (1.0 + 1.5 * Tg)       # skew flattens with maturity
    curv_t = curv / (1.0 + 2.0 * Tg)       # smile convexity decays
    true_iv = np.clip(atm + skew_t * kk + curv_t * kk * kk, 0.03, 2.5)

    # synthesize market prices, inject quote noise, then re-imply
    price = _bs_call(s, Kg, Tg, r, true_iv)
    rng = np.random.default_rng(7)
    price = price * (1.0 + rng.normal(0.0, 0.0042, price.shape))
    intrinsic = np.maximum(s - Kg * np.exp(-r * Tg), 0.0)
    price = np.clip(price, intrinsic + 1e-6, s - 1e-6)

    implied = _implied_vol(price, s, Kg, Tg, r)
    implied = _smooth(implied)             # neural fit (denoise)

    iv_pct = np.round(implied * 100.0, 3)
    zmin = float(iv_pct.min())
    zmax = float(iv_pct.max())

    # ATM term structure (interp each expiry at K = S)
    atm_term = []
    for j in range(n_expiries):
        iv_atm = float(np.interp(s, K, implied[j])) * 100.0
        atm_term.append({"t": round(float(T[j]), 3), "iv": round(iv_atm, 3)})

    # 1Y 90/110 skew proxy
    j1 = int(np.argmin(np.abs(T - 1.0)))
    iv_low = float(np.interp(0.90 * s, K, implied[j1])) * 100.0
    iv_high = float(np.interp(1.10 * s, K, implied[j1])) * 100.0

    return {
        "status": "success",
        "spot": round(float(s), 2),
        "r": round(float(r), 4),
        "strikes": [round(float(x), 2) for x in K],
        "moneyness": [round(float(x / s) * 100.0, 1) for x in K],
        "expiries": [round(float(x), 3) for x in T],
        "iv": iv_pct.tolist(),
        "zmin": zmin,
        "zmax": zmax,
        "atm_vol": round(float(np.interp(s, K, implied[j1])) * 100.0, 2),
        "min_iv": zmin,
        "max_iv": zmax,
        "skew_1y": round(iv_low - iv_high, 2),
        "atm_term": atm_term,
    }
