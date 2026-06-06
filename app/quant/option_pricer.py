"""
Monte Carlo Option Pricing Simulator.

Prices European call/put options by simulating thousands of terminal
underlying prices under Geometric Brownian Motion (risk-neutral measure) and
discounting the average payoff. A closed-form Black-Scholes price + Greeks are
computed alongside as an analytical benchmark, so the user can see the MC
estimate converge to theory (with a 95% confidence interval).

GBM (risk-neutral):
    S_T = S0 · exp((r − ½σ²)T + σ√T · Z),   Z ~ N(0, 1)

MC price:
    call = e^(−rT) · mean(max(S_T − K, 0))
    put  = e^(−rT) · mean(max(K − S_T, 0))

Deterministic (seeded) so the same inputs always yield the same result.
"""

from __future__ import annotations

import math
from typing import List

import numpy as np

from app.core.logger import get_logger

logger = get_logger("option_pricer")

_MAX_PATHS = 100_000
_MAX_SAMPLE_PATHS = 120    # full price-path lines drawn on the client
_PATH_STEPS = 80           # time steps per drawn path (smooth curves)
_HIST_BINS = 40


# ---------------------------------------------------------------------------
# Black-Scholes closed form (analytical benchmark)
# ---------------------------------------------------------------------------
def _norm_cdf(x: float) -> float:
    return 0.5 * (1.0 + math.erf(x / math.sqrt(2.0)))


def _norm_pdf(x: float) -> float:
    return math.exp(-0.5 * x * x) / math.sqrt(2.0 * math.pi)


def black_scholes(S: float, K: float, T: float, r: float, sigma: float, kind: str) -> dict:
    kind = kind.lower()
    if T <= 0 or sigma <= 0:
        intrinsic = max(S - K, 0.0) if kind == "call" else max(K - S, 0.0)
        return {"price": intrinsic, "delta": 0.0, "gamma": 0.0, "vega": 0.0, "theta": 0.0, "rho": 0.0}

    d1 = (math.log(S / K) + (r + 0.5 * sigma * sigma) * T) / (sigma * math.sqrt(T))
    d2 = d1 - sigma * math.sqrt(T)
    disc = math.exp(-r * T)

    if kind == "call":
        price = S * _norm_cdf(d1) - K * disc * _norm_cdf(d2)
        delta = _norm_cdf(d1)
        rho = K * T * disc * _norm_cdf(d2) / 100.0
        theta = (-(S * _norm_pdf(d1) * sigma) / (2 * math.sqrt(T)) - r * K * disc * _norm_cdf(d2)) / 365.0
    else:
        price = K * disc * _norm_cdf(-d2) - S * _norm_cdf(-d1)
        delta = _norm_cdf(d1) - 1.0
        rho = -K * T * disc * _norm_cdf(-d2) / 100.0
        theta = (-(S * _norm_pdf(d1) * sigma) / (2 * math.sqrt(T)) + r * K * disc * _norm_cdf(-d2)) / 365.0

    gamma = _norm_pdf(d1) / (S * sigma * math.sqrt(T))
    vega = S * _norm_pdf(d1) * math.sqrt(T) / 100.0  # per 1% vol move
    return {
        "price": float(price),
        "delta": float(delta),
        "gamma": float(gamma),
        "vega": float(vega),
        "theta": float(theta),
        "rho": float(rho),
    }


# ---------------------------------------------------------------------------
# Monte Carlo simulation
# ---------------------------------------------------------------------------
def _sample_paths(S: float, r: float, sigma: float, T: float, n: int, steps: int, rng) -> List[dict]:
    """Generate a handful of full GBM price paths for visualization."""
    dt = T / steps
    drift = (r - 0.5 * sigma * sigma) * dt
    vol_step = sigma * math.sqrt(dt)
    shocks = rng.standard_normal((n, steps))
    log_paths = np.cumsum(drift + vol_step * shocks, axis=1)
    prices = S * np.exp(log_paths)
    prices = np.hstack([np.full((n, 1), S), prices])  # prepend S0
    out = []
    for i in range(n):
        out.append({"id": i, "values": [round(float(p), 2) for p in prices[i]]})
    return out


def price_option(
    S: float,
    K: float,
    T: float,
    r: float,
    sigma: float,
    kind: str = "call",
    n_paths: int = 20000,
    seed: int = 42,
) -> dict:
    """Monte-Carlo price an option and return MC + Black-Scholes + diagnostics."""
    kind = kind.lower()
    if kind not in ("call", "put"):
        return {"status": "invalid_kind"}
    if S <= 0 or K <= 0 or T <= 0 or sigma <= 0:
        return {"status": "invalid_params"}

    n = int(max(1000, min(n_paths, _MAX_PATHS)))
    rng = np.random.default_rng(seed)

    # Terminal prices under risk-neutral GBM.
    Z = rng.standard_normal(n)
    drift = (r - 0.5 * sigma * sigma) * T
    diffusion = sigma * math.sqrt(T) * Z
    ST = S * np.exp(drift + diffusion)

    disc = math.exp(-r * T)
    payoffs = np.maximum(ST - K, 0.0) if kind == "call" else np.maximum(K - ST, 0.0)
    discounted = disc * payoffs

    mc_price = float(discounted.mean())
    std_err = float(discounted.std(ddof=1) / math.sqrt(n))
    ci95 = 1.96 * std_err

    bs = black_scholes(S, K, T, r, sigma, kind)

    # Terminal-price histogram (distribution of S_T).
    counts, edges = np.histogram(ST, bins=_HIST_BINS)
    hist = [
        {"price": round(float((edges[i] + edges[i + 1]) / 2), 2), "count": int(counts[i])}
        for i in range(len(counts))
    ]

    # A few full sample paths for the "fan" chart.
    sample_rng = np.random.default_rng(seed + 1)
    paths = _sample_paths(S, r, sigma, T, _MAX_SAMPLE_PATHS, _PATH_STEPS, sample_rng)
    time_axis = [round(T * i / _PATH_STEPS, 4) for i in range(_PATH_STEPS + 1)]

    prob_itm = float(np.mean(payoffs > 0) * 100.0)

    return {
        "status": "success",
        "inputs": {
            "S": S, "K": K, "T": T, "r": r, "sigma": sigma,
            "kind": kind, "n_paths": n,
        },
        "mc": {
            "price": round(mc_price, 4),
            "std_error": round(std_err, 4),
            "ci_low": round(mc_price - ci95, 4),
            "ci_high": round(mc_price + ci95, 4),
        },
        "black_scholes": {k: round(v, 4) for k, v in bs.items()},
        "greeks": {
            "delta": round(bs["delta"], 4),
            "gamma": round(bs["gamma"], 4),
            "vega": round(bs["vega"], 4),
            "theta": round(bs["theta"], 4),
            "rho": round(bs["rho"], 4),
        },
        "prob_itm": round(prob_itm, 2),
        "mean_terminal": round(float(ST.mean()), 2),
        "time_axis": time_axis,
        "paths": paths,
        "histogram": hist,
        "strike": K,
    }
