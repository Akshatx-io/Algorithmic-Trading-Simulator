# from sqlalchemy.orm import Session
# from decimal import Decimal
# from app.models.position import Position
# from app.models.trade import Trade
# from app.market.market_state import market_state
# from app.market.fetch_stock_data import fetch_stock_data
# from app.core.logger import logger


# def get_execution_price(symbol: str):
#     try:
#         # ⚡ PRIMARY: in-memory price (FAST)
#         price = market_state.get_price(symbol)

#         if price:
#             return Decimal(str(price))

#         # ⚡ FALLBACK: QUICK FAIL (no blocking)
#         logger.warning(f"[FAST FALLBACK] No live price for {symbol}")

#         return None  # ❌ DO NOT CALL fetch_stock_data here

#     except Exception as e:
#         logger.error(f"[PRICE ERROR] {symbol}: {str(e)}")
#         return None


# def execute_trade(db: Session, user, symbol: str, action: str, quantity: float):

#     try:
#         price = get_execution_price(symbol)

#         if price is None:
#             return {
#                 "status": "error",
#                 "message": f"Live price not available for {symbol}. Try again in a moment."
#             }

#         quantity = Decimal(str(quantity))
#         total_value = price * quantity

#         position = db.query(Position).filter(
#             Position.user_id == user.id,
#             Position.symbol == symbol
#         ).first()

#         # ================= BUY =================
#         if action == "BUY":

#             if user.balance < float(total_value):
#                 raise Exception("Insufficient balance")

#             user.balance -= float(total_value)

#             if position:
#                 new_qty = Decimal(str(position.quantity)) + quantity

#                 new_avg = (
#                     (Decimal(str(position.average_price)) * Decimal(str(position.quantity))) +
#                     (price * quantity)
#                 ) / new_qty

#                 position.quantity = float(new_qty)
#                 position.average_price = float(new_avg)

#             else:
#                 position = Position(
#                     user_id=user.id,
#                     symbol=symbol,
#                     quantity=float(quantity),
#                     average_price=float(price)
#                 )
#                 db.add(position)

#         # ================= SELL =================
#         elif action == "SELL":

#             if not position or position.quantity < float(quantity):
#                 raise Exception("Not enough shares")

#             user.balance += float(total_value)

#             position.quantity -= float(quantity)

#             if position.quantity == 0:
#                 db.delete(position)

#         else:
#             raise Exception("Invalid action")

#         # ================= RECORD TRADE =================
#         trade = Trade(
#             user_id=user.id,
#             symbol=symbol,
#             action=action,
#             quantity=float(quantity),
#             price=float(price)
#         )

#         db.add(trade)
#         db.commit()

#         return {
#             "status": "success",
#             "symbol": symbol,
#             "action": action,
#             "quantity": float(quantity),
#             "price": float(price),
#             "total_value": float(total_value),
#             "balance": user.balance
#         }

#     except Exception as e:
#         db.rollback()
#         logger.error(f"[TRADE ERROR]: {str(e)}")

#         return {
#             "status": "error",
#             "message": str(e)
#         }










from sqlalchemy.orm import Session
from app.models.position import Position
from app.models.trade import Trade
from app.models.user import User
from app.market.market_state import market_state
from app.core.logger import logger

def execute_trade(db: Session, user_id: int, request):

    symbol = request.symbol.upper()
    action = request.action.upper()
    quantity = request.quantity

    # ============================
    # FETCH USER (LOCK ROW)
    # ============================
    user = db.query(User).filter(User.id == user_id).with_for_update().first()

    if not user:
        return {"success": False, "error": "User not found"}

    # ============================
    # VALIDATE PRICE
    # ============================
    price = market_state.get_price(symbol)

    if price is None or price <= 0:
        return {"success": False, "error": "Invalid market price"}

    price = float(price)

    total_value = price * quantity

    # ============================
    # BUY LOGIC
    # ============================
    if action == "BUY":

        if user.balance < total_value:
            return {"success": False, "error": "Insufficient balance"}

        user.balance -= total_value

        position = db.query(Position).filter(
            Position.user_id == user_id,
            Position.symbol == symbol
        ).first()

        if position:
            new_qty = position.quantity + quantity
            position.avg_price = (
                (position.quantity * position.avg_price) +
                (quantity * price)
            ) / new_qty
            position.quantity = new_qty
        else:
            position = Position(
                user_id=user_id,
                symbol=symbol,
                quantity=quantity,
                avg_price=price,
            )
            db.add(position)

        realized_pnl = None

    # ============================
    # SELL LOGIC
    # ============================
    else:

        position = db.query(Position).filter(
            Position.user_id == user_id,
            Position.symbol == symbol
        ).first()

        if not position or position.quantity < quantity:
            return {"success": False, "error": "Not enough shares"}

        realized_pnl = (price - position.avg_price) * quantity

        position.quantity -= quantity
        user.balance += total_value

        if position.quantity == 0:
            db.delete(position)

    # ============================
    # RECORD TRADE
    # ============================
    trade = Trade(
        user_id=user_id,
        symbol=symbol,
        action=action,
        quantity=quantity,
        price=price,
        realized_pnl=realized_pnl
    )

    db.add(trade)

    # ============================
    # COMMIT (ATOMIC)
    # ============================
    db.commit()
    # Refresh to populate DB-generated fields (id, timestamp) for the response.
    db.refresh(trade)

    logger.info(f"Trade executed: {symbol} {action} {quantity}")

    return {
        "success": True,
        "id": trade.id,
        "symbol": trade.symbol,
        "action": trade.action,
        "quantity": trade.quantity,
        "price": trade.price,
        "timestamp": trade.timestamp,
        "status": "FILLED",
        "realized_pnl": trade.realized_pnl,
        "balance": user.balance,
    }