from datetime import datetime

from sqlalchemy import Column, DateTime, Float, ForeignKey, Integer, String
from sqlalchemy.orm import relationship

from app.models.base import Base


class Trade(Base):
    __tablename__ = "trades"

    id           = Column(Integer, primary_key=True, index=True)
    user_id      = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    order_id     = Column(Integer, ForeignKey("orders.id", ondelete="SET NULL"), nullable=True, index=True)

    symbol       = Column(String(16), nullable=False, index=True)
    action       = Column(String(8), nullable=False)              # BUY | SELL
    quantity     = Column(Float, nullable=False)
    price        = Column(Float, nullable=False)
    fees         = Column(Float, nullable=False, default=0.0)
    realized_pnl = Column(Float, nullable=True)
    timestamp    = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)

    user         = relationship("User",  back_populates="trades")
    order        = relationship("Order", back_populates="trades")
