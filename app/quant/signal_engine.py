"""
🚀 ULTIMATE ELITE SIGNAL ENGINE — FINAL EXTENDED VERSION

✔ FULL SYSTEM INTEGRATION
✔ NO FEATURE LOSS
✔ EXTENDED + HARDENED + OBSERVABLE
✔ ZERO CRASH GUARANTEE
✔ STREAMING SAFE
✔ FRONTEND + API + WS COMPATIBLE
"""

import asyncio
import numpy as np
import pandas as pd
from typing import Dict, Optional, Tuple
from dataclasses import dataclass
from datetime import datetime
import threading
import time
from concurrent.futures import ThreadPoolExecutor, as_completed

from app.quant.factors.trend_factor import trend_factor
from app.quant.factors.mean_reversion_factor import mean_reversion_factor
from app.quant.factors.momentum_factor import momentum_factor
from app.quant.factors.volatility_factor import volatility_factor
from app.ml.predictor import predict_return
from app.market.fetch_stock_data import fetch_stock_data
from app.market.market_state import market_state
from app.core.logger import get_logger
from app.core.config import settings

logger = get_logger("signal_engine")

# ===============================
# DATA STRUCTURE
# ===============================
@dataclass
class SignalResult:
    symbol: str
    signal: str
    confidence: float
    scores: Dict[str, float]
    factors: Dict[str, float]
    risk_metrics: Dict[str, float]
    timestamp: datetime

    def to_dict(self) -> Dict:
        return {
            "symbol": self.symbol,
            "signal": self.signal,
            "confidence": round(self.confidence, 2),
            "scores": {k: round(v, 4) for k, v in self.scores.items()},
            "factors": {k: round(v, 4) for k, v in self.factors.items()},
            "risk_metrics": {k: round(v, 4) for k, v in self.risk_metrics.items()},
            "timestamp": self.timestamp.isoformat()
        }


# ===============================
# ENGINE
# ===============================
class SignalEngine:

    def __init__(self):
        self.cache: Dict[str, SignalResult] = {}
        self.cache_ttl = 30
        self._lock = threading.RLock()
        self._running = False

        self.executor = ThreadPoolExecutor(max_workers=8)

        self.symbols = [
            "AAPL","MSFT","GOOGL","TSLA","NVDA",
            "AMZN","META","NFLX","AMD","INTC"
        ]

    # ===========================
    # SAFE UTILS
    # ===========================
    def _safe(self, v):
        try:

            if isinstance(v, pd.Series):
                return float(v.iloc[-1]) if not v.empty else 0.0

            if isinstance(v, (list, tuple, np.ndarray)):
                return float(v[-1]) if len(v) > 0 else 0.0

            if hasattr(v, "item"):
                return float(v.item())

            return float(v)

        except Exception as e:
            logger.error(f"[SAFE ERROR]: {e} | value={v}")
            return 0.0

    def _close_series(self, df: pd.DataFrame) -> pd.Series:
        close_data = df["close"]
        if isinstance(close_data, pd.DataFrame):
            close_data = close_data.iloc[:, 0]
        return pd.to_numeric(close_data, errors="coerce").dropna()

    # ===========================
    # DATA FETCH (COMPATIBLE)
    # ===========================
    def _fetch(self, symbol):
        try:
            return fetch_stock_data(symbol)
        except Exception as e:
            logger.error(f"[FETCH ERROR] {symbol}: {e}")
            return None


    # ===========================
    # FACTORS
    # ===========================
    def _compute_factors(self, df):
        try:
            return {
                "trend": self._safe(trend_factor(df)),
                "mean_reversion": self._safe(mean_reversion_factor(df)),
                "momentum": self._safe(momentum_factor(df)),
                "volatility": self._safe(volatility_factor(df))
            }
        except Exception as e:
            logger.error(f"[FACTOR ERROR]: {e}")
            return {
                "trend": 0,
                "mean_reversion": 0,
                "momentum": 0,
                "volatility": 0
            }

    # ===========================
    # RISK
    # ===========================
    def _compute_risk(self, df):
        try:
            close = self._close_series(df)
            returns = close.pct_change().dropna()

            if len(returns) < 10:
                return {"sharpe_ratio":0,"max_drawdown":0,"volatility":0,"beta":1}

            std = float(returns.std())
            sharpe = (float(returns.mean()) / std) * np.sqrt(252) if std > 0 else 0
            cum = (1+returns).cumprod()
            dd = (cum - cum.cummax()) / cum.cummax()

            return {
                "sharpe_ratio": self._safe(sharpe),
                "max_drawdown": self._safe(dd.min()),
                "volatility": self._safe(std * np.sqrt(252)),
                "beta": 1.0
            }
        except Exception as e:
            logger.error(f"[RISK ERROR]: {e}")
            return {"sharpe_ratio":0,"max_drawdown":0,"volatility":0,"beta":1}

    # ===========================
    # ML
    # ===========================
    def _ml(self, df):
        try:
            return self._safe(predict_return(df))
        except Exception as e:
            logger.error(f"[ML ERROR]: {e}")
            return 0.0

    # ===========================
    # COMBINE LOGIC
    # ===========================
    def _combine(self, f, ml, r):

        factor_score = (
            0.25*f["trend"] +
            0.20*f["mean_reversion"] +
            0.30*f["momentum"]
        )

        final_score = 0.6*factor_score + 0.4*ml

        risk_penalty = min(r["volatility"] * 0.1, 0.2)
        adjusted_score = final_score * (1 - risk_penalty)

        try:
            agreement = 1 - float(np.std(list(f.values())))
        except Exception:
            agreement = 0.5

        agreement = max(0.0, min(agreement, 1.0))
        confidence = max(0.0, min(abs(adjusted_score) * 100 * agreement, 100.0))

        if adjusted_score > 0.08:
            signal = "BUY"
        elif adjusted_score < -0.08:
            signal = "SELL"
        else:
            signal = "HOLD"

        scores = {
            "factor_score": factor_score,
            "ml_prediction": ml,
            "adjusted_score": adjusted_score,
            "risk_penalty": risk_penalty,
            "agreement": agreement
        }

        return signal, confidence, scores
    

    # ===========================
    # CORE SAFE COMPUTATION (NEW)
    # ===========================
    def _compute(self, symbol):
        """
        🔥 CENTRALIZED SAFE PIPELINE
        Ensures:
        - valid dataframe
        - clean columns
        - no NaNs
        - safe factor computation
        """

        try:
            df = self._fetch(symbol)

            # ===============================
            # HARD VALIDATION
            # ===============================
            if df is None or df.empty:
                logger.warning(f"[EMPTY DF] {symbol}")
                return self._fallback(symbol)

            # normalize columns- removes dataframe mutation issues and ensures consistent access
            df = df.copy()
            df.columns = [c.lower() for c in df.columns]

            if "close" not in df.columns:
                logger.warning(f"[NO CLOSE COLUMN] {symbol}")
                return self._fallback(symbol)

            # remove NaNs
            df = df.dropna()

            if len(df) < 20:
                logger.warning(f"[INSUFFICIENT DATA] {symbol}")
                return self._fallback(symbol)

            # ===============================
            # FACTORS
            # ===============================
            f = self._compute_factors(df)
            f = {k: self._safe(v) for k, v in f.items()}

            # ===============================
            # RISK
            # ===============================
            r = self._compute_risk(df)

            # ===============================
            # ML
            # ===============================
            ml = self._ml(df)

            # ===============================
            # COMBINE
            # ===============================
            signal, confidence, scores = self._combine(f, ml, r)

            # ===============================
            # DEBUG VISIBILITY
            # ===============================
            logger.info(
                f"[COMPUTE] {symbol} | {signal} | score={scores['adjusted_score']:.4f} | conf={confidence:.2f}"
            )

            return SignalResult(
                symbol=symbol,
                signal=signal,
                confidence=confidence,
                scores=scores,
                factors=f,
                risk_metrics=r,
                timestamp=datetime.utcnow()
            )

        except Exception as e:
            logger.error(f"[COMPUTE ERROR] {symbol}: {e}")
            return self._fallback(symbol)



    # ===========================
    # CORE GENERATION
    # ===========================
    def generate(self, symbol, force=False):

        with self._lock:
            cached = self.cache.get(symbol)
            if cached and not force:
                if (datetime.utcnow() - cached.timestamp).seconds < self.cache_ttl:
                    return cached

        # 🔥 USE SAFE PIPELINE ✅ OUTSIDE LOCK
        result = self._compute(symbol)

        with self._lock:
            self.cache[symbol] = result

        # 🔥 CRITICAL: push to WS layer
        market_state.update_signal(symbol, result.signal)

        return result

    # ===========================
    # FALLBACK
    # ===========================
    def _fallback(self, symbol):
        return SignalResult(
            symbol=symbol,
            signal="HOLD",
            confidence=0,
            scores={"fallback":1},
            factors={"trend":0,"momentum":0,"mean_reversion":0,"volatility":0},
            risk_metrics={"sharpe_ratio":0,"max_drawdown":0,"volatility":0,"beta":1},
            timestamp=datetime.utcnow()
        )

    # ===========================
    # PUBLIC API
    # ===========================
    def get(self, symbol):
        return self.generate(symbol).to_dict()

    def get_all(self):
        return {s: self.get(s) for s in self.symbols}

    def refresh(self, symbol):
        return self.generate(symbol, force=True).to_dict()

    # ===========================
    # CACHE CLEANUP
    # ===========================
    def cleanup_cache(self):
        with self._lock:
            now = datetime.utcnow()
            self.cache = {
                k: v for k, v in self.cache.items()
            if (now - v.timestamp).seconds < self.cache_ttl
            }

    # ===========================
    # BACKGROUND LOOP
    # ===========================
    def _loop(self):

        interval = getattr(settings, "signal_update_interval",
                        getattr(settings, "model_update_interval", 10))
            

        while self._running:

            futures = []

            for s in self.symbols:
                futures.append(self.executor.submit(self.generate, s))

            for f in futures:
                try:
                    f.result()
                except Exception as e:
                    logger.error(f"[BG ERROR]: {e}")

            self.cleanup_cache()
            time.sleep(interval)


    def start(self):
        if self._running:
            return
        if getattr(self.executor, "_shutdown", False):
            self.executor = ThreadPoolExecutor(max_workers=8)
        self._running = True
        threading.Thread(target=self._loop, daemon=True).start()
        logger.info("Signal engine started")

    def stop(self):
        self._running = False
        try:
            self.executor.shutdown(wait=False, cancel_futures=True)
        except Exception:
            pass
        logger.info("Signal engine stopped")


# ===============================
# GLOBAL INSTANCE
# ===============================
signal_engine = SignalEngine()


# ===============================
# BACKWARD COMPATIBILITY
# ===============================
async def start_signal_engine():
    """
    Async-compatible engine entrypoint for lifespan task orchestration.
    """
    signal_engine.start()
    try:
        while signal_engine._running:
            await asyncio.sleep(1)
    finally:
        signal_engine.stop()

def get_signal(symbol):
    return signal_engine.get(symbol)

def generate_signal(symbol):
    return signal_engine.get(symbol)

def get_all_signals():
    return signal_engine.get_all()