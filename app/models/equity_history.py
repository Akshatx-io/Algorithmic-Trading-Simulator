from datetime import datetime

from sqlalchemy import Column, DateTime, Float, ForeignKey, Integer
from sqlalchemy.orm import relationship

from app.models.base import Base


class EquityHistory(Base):
    __tablename__ = "equity_history"

    id            = Column(Integer, primary_key=True, index=True)
    user_id       = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    total_equity  = Column(Float, nullable=False)
    timestamp     = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)

    user          = relationship("User", back_populates="equity_history")
