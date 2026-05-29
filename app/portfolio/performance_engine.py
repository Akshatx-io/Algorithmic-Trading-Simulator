from sqlalchemy.orm import Session
from sqlalchemy import func
import numpy as np

from app.models.trade import Trade
from app.models.equity_history import EquityHistory
from app.portfolio.equity_engine import get_equity_curve
from app.core.logger import logger


EPS = 1e-9  # numerical stability


# ===============================
# PERFORMANCE ENGINE (ELITE)
# ===============================
def calculate_performance_metrics(db: Session, user_id: int):
    """
    Full production-grade performance engine:
    - user-isolated
    - numerically stable
    - crash-proof
    - handles all edge cases
    """

    try:
        # ===============================
        # FETCH USER TRADES
        # ===============================
        trades = db.query(Trade)\
            .filter(Trade.user_id == user_id)\
            .order_by(Trade.timestamp.asc())\
            .all()

        if not trades:
            return _empty_metrics()

        wins = 0
        losses = 0
        profit = 0.0
        loss = 0.0

        positions = {}

        # ===============================
        # TRADE PROCESSING
        # ===============================
        for trade in trades:
            symbol = trade.symbol

            if symbol not in positions:
                positions[symbol] = {
                    "quantity": 0.0,
                    "avg_price": 0.0
                }

            pos = positions[symbol]

            # -------------------------------
            # BUY
            # -------------------------------
            if trade.action == "BUY":
                total_cost = (
                    pos["avg_price"] * pos["quantity"]
                ) + (trade.price * trade.quantity)

                pos["quantity"] += trade.quantity

                if pos["quantity"] > 0:
                    pos["avg_price"] = total_cost / pos["quantity"]

            # -------------------------------
            # SELL
            # -------------------------------
            elif trade.action == "SELL":
                if pos["quantity"] <= 0:
                    continue

                sell_qty = min(trade.quantity, pos["quantity"])

                pnl = (trade.price - pos["avg_price"]) * sell_qty

                if pnl > 0:
                    wins += 1
                    profit += pnl
                else:
                    losses += 1
                    loss += abs(pnl)

                pos["quantity"] -= sell_qty

        total_trades = wins + losses

        win_rate = (
            (wins / max(total_trades, 1)) * 100
        )

        profit_factor = (
            profit / max(loss, EPS)
        )

        avg_profit = (
            profit / max(wins, 1)
        )

        avg_loss = (
            loss / max(losses, 1)
        )

        # ===============================
        # EQUITY CURVE
        # ===============================
        equity_curve = get_equity_curve(db, user_id) or []

        # ===============================
        # TOTAL RETURN
        # ===============================
        if len(equity_curve) >= 2:
            initial = equity_curve[0]["equity"]
            final = equity_curve[-1]["equity"]

            total_return = (
                (final - initial) / max(initial, EPS)
            ) * 100
        else:
            total_return = 0.0

        # ===============================
        # MAX DRAWDOWN
        # ===============================
        max_drawdown = 0.0

        if equity_curve:
            peak = equity_curve[0]["equity"]

            for point in equity_curve:
                equity = point["equity"]

                if equity > peak:
                    peak = equity

                drawdown = (
                    (peak - equity) / max(peak, EPS)
                )

                max_drawdown = max(max_drawdown, drawdown)

        # ===============================
        # VOLATILITY + SHARPE
        # ===============================
        sharpe_ratio = 0.0
        volatility = 0.0

        if len(equity_curve) >= 2:
            equity = np.array(
                [p["equity"] for p in equity_curve],
                dtype=float
            )

            returns = np.diff(equity) / np.maximum(equity[:-1], EPS)

            if len(returns) > 1:
                volatility = float(np.std(returns))

                if volatility > 0:
                    sharpe_ratio = float(
                        np.mean(returns) / volatility
                    )

        return {
            "total_return": float(total_return),
            "win_rate": float(win_rate),
            "total_trades": int(total_trades),
            "profit_factor": float(profit_factor),
            "max_drawdown": float(max_drawdown),
            "avg_profit": float(avg_profit),
            "avg_loss": float(avg_loss),
            "volatility": float(volatility),
            "sharpe_ratio": float(sharpe_ratio),
        }

    except Exception as e:
        logger.error(f"[PERFORMANCE ENGINE ERROR]: {str(e)}")
        return _empty_metrics()


# ===============================
# EMPTY METRICS (SAFE FALLBACK)
# ===============================
def _empty_metrics():
    return {
        "total_return": 0.0,
        "win_rate": 0.0,
        "total_trades": 0,
        "profit_factor": 0.0,
        "max_drawdown": 0.0,
        "avg_profit": 0.0,
        "avg_loss": 0.0,
        "volatility": 0.0,
        "sharpe_ratio": 0.0,
    }