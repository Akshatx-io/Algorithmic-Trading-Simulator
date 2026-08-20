"""
Order entity (new in Phase 2.2 — wired up in Phase 2.4 / 3.1 / 3.2).

Carries the full state machine:
    PENDING -> OPEN -> PARTIAL -> FILLED | CANCELLED | REJECTED | EXPIRED
"""

from datetime import datetime
from enum import Enum

from sqlalchemy import Column, DateTime, Float, ForeignKey, Index, Integer, String, Text
from sqlalchemy.orm import relationship

from app.models.base import Base


class OrderStatus(str, Enum):
    PENDING   = "PENDING"
    OPEN      = "OPEN"
    PARTIAL   = "PARTIAL"
    FILLED    = "FILLED"
    CANCELLED = "CANCELLED"
    REJECTED  = "REJECTED"
    EXPIRED   = "EXPIRED"


class OrderType(str, Enum):
    MARKET     = "MARKET"
    LIMIT      = "LIMIT"
    STOP       = "STOP"
    STOP_LIMIT = "STOP_LIMIT"


class OrderSide(str, Enum):
    BUY  = "BUY"
    SELL = "SELL"


class TimeInForce(str, Enum):
    GTC = "GTC"
    IOC = "IOC"
    FOK = "FOK"
    DAY = "DAY"


class Order(Base):
    __tablename__ = "orders"

    # Indexes are declared in __table_args__ below rather than via per-column
    # `index=True`, so the ORM and 0001_baseline agree exactly. The hot lookups
    # are compound ("my open orders", "open orders in a symbol"), and a
    # composite index serves those; three single-column indexes do not.
    __table_args__ = (
        Index("ix_orders_user_status",   "user_id", "status"),
        Index("ix_orders_symbol_status", "symbol",  "status"),
    )

    id               = Column(Integer, primary_key=True, index=True)
    client_order_id  = Column(String(64), nullable=False, unique=True, index=True)
    user_id          = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)

    symbol           = Column(String(16), nullable=False)
    side             = Column(String(8), nullable=False)         # BUY | SELL
    order_type       = Column(String(16), nullable=False)        # MARKET | LIMIT | STOP | STOP_LIMIT
    time_in_force    = Column(String(8), nullable=False, default=TimeInForce.GTC.value)
    status           = Column(String(16), nullable=False, default=OrderStatus.PENDING.value)

    quantity         = Column(Float, nullable=False)
    filled_quantity  = Column(Float, nullable=False, default=0.0)
    limit_price      = Column(Float, nullable=True)
    stop_price       = Column(Float, nullable=True)
    avg_fill_price   = Column(Float, nullable=True)

    rejection_reason = Column(Text, nullable=True)

    created_at       = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
    updated_at       = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    user             = relationship("User",  back_populates="orders")
    trades           = relationship("Trade", back_populates="order")

    @property
    def remaining_quantity(self) -> float:
        return float(self.quantity or 0.0) - float(self.filled_quantity or 0.0)

    @property
    def is_active(self) -> bool:
        return self.status in (OrderStatus.OPEN.value, OrderStatus.PARTIAL.value)

    @property
    def is_terminal(self) -> bool:
        return self.status in (
            OrderStatus.FILLED.value,
            OrderStatus.CANCELLED.value,
            OrderStatus.REJECTED.value,
            OrderStatus.EXPIRED.value,
        )
