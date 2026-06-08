"""
Quant Lab invariant tests.

These assert the *mathematical* properties each engine must satisfy — the
guarantees that make the modules trustworthy — rather than snapshotting exact
numbers. All engines are deterministic (seeded) and dependency-light, so these
run fast and offline.
"""

from __future__ import annotations

import math

import numpy as np
import pytest

from app.quant.backtester import run_backtest
from app.quant.option_pricer import price_option
from app.quant.return_predictor import predict_returns
from app.quant.sentiment import analyze_sentiment
from app.quant.vol_surface import (
    _bs_call,
    _implied_vol,
    build_vol_forecast,
    build_vol_surface,
)

pytestmark = pytest.mark.unit


# --------------------------------------------------------------------------- #
# Option pricer
# --------------------------------------------------------------------------- #
def test_option_mc_brackets_black_scholes():
    d = price_option(100, 100, 1.0, 0.05, 0.2, kind="call", n_paths=40000)
    assert d["status"] == "success"
    bs = d["black_scholes"]["price"]
    assert d["mc"]["ci_low"] <= bs <= d["mc"]["ci_high"]  # MC CI must contain BS


def test_option_greeks_finite_and_bounded():
    d = price_option(100, 95, 0.5, 0.03, 0.25, kind="call")
    g = d["greeks"]
    assert all(math.isfinite(v) for v in g.values())
    assert 0.0 <= g["delta"] <= 1.0          # call delta in [0,1]
    assert g["gamma"] >= 0.0
    assert 0.0 <= d["prob_itm"] <= 100.0


def test_put_call_parity_holds():
    S, K, T, r = 100, 100, 1.0, 0.05
    call = price_option(S, K, T, r, 0.2, kind="call")["black_scholes"]["price"]
    put = price_option(S, K, T, r, 0.2, kind="put")["black_scholes"]["price"]
    parity = call - put - (S - K * math.exp(-r * T))
    assert abs(parity) < 1e-2   # exact in theory; API rounds BS prices to 4 dp


# --------------------------------------------------------------------------- #
# Volatility surface + IV solver
# --------------------------------------------------------------------------- #
def test_iv_solver_roundtrips_to_machine_precision():
    S, r = 100.0, 0.04
    K = np.array([80.0, 100.0, 125.0])
    T = np.array([0.25, 1.0, 2.0])
    Kg, Tg = np.meshgrid(K, T)
    true_iv = np.full(Kg.shape, 0.27)
    price = _bs_call(S, Kg, Tg, r, true_iv)
    recovered = _implied_vol(price, S, Kg, Tg, r)
    assert np.max(np.abs(recovered - true_iv)) < 1e-6


def test_vol_surface_shape_and_ordering():
    d = build_vol_surface()
    assert d["status"] == "success"
    iv = d["iv"]
    assert len(iv) == len(d["expiries"])
    assert all(len(row) == len(d["strikes"]) for row in iv)
    assert d["zmin"] < d["zmax"]
    assert d["atm_vol"] > 0


def test_vol_forecast_band_and_grid():
    d = build_vol_forecast(horizon=5)
    assert d["status"] == "success"
    assert len(d["current_iv"]) == len(d["forecast_iv"])
    assert d["band"] >= 0
    assert len(d["level_path"]) == d["horizon"] + 1
    for row in d["atm_term"]:
        assert row["lo"] <= row["forecast"] <= row["hi"]


# --------------------------------------------------------------------------- #
# Backtester
# --------------------------------------------------------------------------- #
def test_backtest_metrics_sane_and_deterministic():
    a = run_backtest("AAPL", "sma", years=2)
    b = run_backtest("AAPL", "sma", years=2)
    assert a["status"] == "success"
    assert a["metrics"] == b["metrics"]               # deterministic
    m = a["metrics"]
    assert m["max_drawdown"] <= 0
    assert 0 <= m["win_rate"] <= 100
    assert math.isfinite(m["sharpe"]) and math.isfinite(m["total_return"])
    assert len(a["series"]) > 0 and a["benchmark"]["total_return"] is not None


# --------------------------------------------------------------------------- #
# Return predictor
# --------------------------------------------------------------------------- #
def test_predictor_metrics_and_mc_bands_ordered():
    d = predict_returns("AAPL", years=3, n_estimators=30, max_depth=5, mc_sims=120)
    assert d["status"] == "success"
    m = d["metrics"]
    assert math.isfinite(m["r2"]) and math.isfinite(m["ic"])
    assert 0 <= m["directional_acc"] <= 100
    assert d["next_day"]["direction"] in ("UP", "DOWN")
    imp = sum(f["importance"] for f in d["importances"])
    assert 0 < imp <= 101                              # ~100% (rounding tolerant)
    for row in d["mc_bands"]:
        assert row["p5"] <= row["p50"] <= row["p95"]   # percentile ordering


# --------------------------------------------------------------------------- #
# Sentiment + event study
# --------------------------------------------------------------------------- #
def test_sentiment_polarity_direction():
    pos = analyze_sentiment("AAPL", "Record revenue, strong demand, raised guidance and robust margins.")
    neg = analyze_sentiment("AAPL", "Revenue missed badly, weak demand, lowered guidance amid litigation risk.")
    assert pos["sentiment"]["score"] > 0 and pos["sentiment"]["label"] == "Positive"
    assert neg["sentiment"]["score"] < 0 and neg["sentiment"]["label"] == "Negative"


def test_event_study_consistency():
    d = analyze_sentiment("AAPL")
    es = d["event_study"]
    n = len(es["window"])
    assert len(es["caar_positive"]) == n == len(es["caar_negative"]) == len(es["caar_neutral"])
    assert -1.0 <= es["signal"]["ic"] <= 1.0
    assert math.isfinite(es["signal"]["t_stat"])
    s = d["sentiment"]
    assert s["pos_sentences"] + s["neu_sentences"] + s["neg_sentences"] == s["n_sentences"]
