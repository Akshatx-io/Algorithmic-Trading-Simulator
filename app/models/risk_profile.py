from sqlalchemy import Column, Float, ForeignKey, Integer

from app.models.base import Base


class RiskProfile(Base):
    __tablename__ = "risk_profiles"

    id                      = Column(Integer, primary_key=True, index=True)
    user_id                 = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False)

    max_position_pct        = Column(Float, default=0.20)
    max_total_exposure_pct  = Column(Float, default=0.80)
    max_daily_loss_pct      = Column(Float, default=0.05)
    daily_loss_limit_pct    = Column(Float, default=0.05)
    is_trading_blocked      = Column(Integer, default=0)
