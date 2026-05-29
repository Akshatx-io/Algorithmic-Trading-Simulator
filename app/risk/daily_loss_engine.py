# from datetime import datetime, date, timedelta
# from sqlalchemy.orm import Session
# from sqlalchemy import func

# from app.models.trade import Trade
# from app.core.logger import logger


# # ===============================
# # CONFIG
# # ===============================
# MAX_DAILY_LOSS = 5000  # adjust based on capital


# # ===============================
# # HELPER
# # ===============================
# def get_today_trades(db: Session):
#     today = date.today()

#     return db.query(Trade).filter(
#         Trade.timestamp >= datetime.combine(today, datetime.min.time())
#     ).all()


# # ===============================
# # CORE FUNCTION
# # ===============================
# def calculate_daily_pnl(db: Session, user_id: int) -> float:
#     """
#     Calculates realized PnL for today
#     """

#     trades = get_today_trades(db)

#     if not trades:
#         return 0.0

#     pnl = 0.0
#     positions = {}

#     for trade in trades:
#         symbol = trade.symbol

#         if symbol not in positions:
#             positions[symbol] = {
#                 "quantity": 0,
#                 "avg_price": 0
#             }

#         pos = positions[symbol]

#         if trade.action == "BUY":
#             total_cost = (pos["avg_price"] * pos["quantity"]) + (trade.price * trade.quantity)
#             pos["quantity"] += trade.quantity
#             pos["avg_price"] = total_cost / pos["quantity"]

#         elif trade.action == "SELL":
#             if pos["quantity"] > 0:
#                 realized = (trade.price - pos["avg_price"]) * trade.quantity
#                 pnl += realized
#                 pos["quantity"] -= trade.quantity

#     return pnl


# # ===============================
# # CHECK FUNCTION
# # ===============================
# def check_daily_loss_limit(db: Session) -> bool:
#     """
#     Returns False if daily loss exceeded
#     """

#     try:
#         pnl = calculate_daily_pnl(db)

#         logger.info(f"Today's PnL: {pnl}")

#         if pnl < -MAX_DAILY_LOSS:
#             logger.warning("Daily loss limit exceeded")
#             return False

#         return True

#     except Exception as e:
#         logger.error(f"Daily loss engine error: {str(e)}")
#         return False












from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.models.trade import Trade
from app.core.logger import logger


MAX_DAILY_LOSS = 5000


def calculate_daily_pnl(db: Session, user_id: int) -> float:
    try:
        today_start = datetime.utcnow().replace(
            hour=0, minute=0, second=0, microsecond=0
        )

        pnl = db.query(
            func.sum(Trade.realized_pnl)
        ).filter(
            Trade.user_id == user_id,
            Trade.timestamp >= today_start
        ).scalar()

        return float(pnl or 0.0)

    except Exception as e:
        logger.error(f"[PNL ERROR]: {str(e)}")
        return 0.0


def check_daily_loss_limit(db: Session, user_id: int) -> bool:
    try:
        pnl = calculate_daily_pnl(db, user_id)

        logger.info(f"[PNL] User {user_id}: {pnl}")

        if pnl < -MAX_DAILY_LOSS:
            logger.warning(f"[RISK] Daily loss exceeded for user {user_id}")
            return False

        return True

    except Exception as e:
        logger.error(f"[DAILY LOSS ERROR]: {str(e)}")
        return False