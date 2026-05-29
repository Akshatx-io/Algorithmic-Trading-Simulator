from datetime import datetime

from sqlalchemy import Column, DateTime, Float, Integer, String
from sqlalchemy.orm import relationship

from app.models.base import Base


class User(Base):
    __tablename__ = "users"

    id              = Column(Integer, primary_key=True, index=True)
    username        = Column(String(64), unique=True, index=True, nullable=False)
    email           = Column(String(255), unique=True, index=True, nullable=True)
    hashed_password = Column(String(255), nullable=False)
    balance         = Column(Float, nullable=False, default=100_000.0)
    created_at      = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at      = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    positions       = relationship("Position",      back_populates="user", cascade="all, delete-orphan")
    trades          = relationship("Trade",         back_populates="user", cascade="all, delete-orphan")
    orders          = relationship("Order",         back_populates="user", cascade="all, delete-orphan")
    equity_history  = relationship("EquityHistory", back_populates="user", cascade="all, delete-orphan")
