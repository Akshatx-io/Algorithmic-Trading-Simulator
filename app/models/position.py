"""
Position — current holdings per (user, symbol).

Audit fix 3.2: column renamed from `average_price` to `avg_price` to match
the canonical schema. All consumers updated in the same commit.
"""

from datetime import datetime

from sqlalchemy import Column, DateTime, Float, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import relationship

from app.models.base import Base


class Position(Base):
    __tablename__ = "positions"
    __table_args__ = (UniqueConstraint("user_id", "symbol", name="uq_positions_user_symbol"),)

    id          = Column(Integer, primary_key=True, index=True)
    user_id     = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    symbol      = Column(String(16), nullable=False, index=True)
    quantity    = Column(Float, nullable=False, default=0.0)
    avg_price   = Column(Float, nullable=False, default=0.0)
    created_at  = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at  = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    user        = relationship("User", back_populates="positions")

    @property
    def cost_basis(self) -> float:
        """Materialized at read time. Storage column added in Phase 2.4."""
        return float(self.quantity or 0.0) * float(self.avg_price or 0.0)
