from datetime import datetime

from sqlalchemy import Column, DateTime, Float, ForeignKey, Index, Integer
from sqlalchemy.orm import relationship

from app.models.base import Base


class EquityHistory(Base):
    __tablename__ = "equity_history"

    # The equity curve is always read as "one user's points, in time order", so
    # a composite (user_id, timestamp) index serves the query; two independent
    # single-column indexes force the planner to pick one and filter the rest.
    # Declared here so the ORM matches 0001_baseline exactly.
    __table_args__ = (
        Index("ix_equity_history_user_time", "user_id", "timestamp"),
    )

    id            = Column(Integer, primary_key=True, index=True)
    user_id       = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    total_equity  = Column(Float, nullable=False)
    timestamp     = Column(DateTime, default=datetime.utcnow, nullable=False)

    user          = relationship("User", back_populates="equity_history")
