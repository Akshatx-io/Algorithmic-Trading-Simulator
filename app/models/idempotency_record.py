"""
Idempotency record — durable backup for the Redis-backed idempotency store.

Redis is the primary store (sub-ms reads). This table provides a durable
fallback if Redis is unavailable and a forensic trail for the audit log.

Inserted asynchronously by IdempotencyService.store(), never blocks the
mutation path.
"""

from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB

from app.models.base import Base


class IdempotencyRecord(Base):
    __tablename__ = "idempotency_records"

    key           = Column(String(64), primary_key=True)
    user_id       = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    request_hash  = Column(String(64), nullable=False)
    response_body = Column(Text, nullable=False)   # JSON-encoded; JSONB on Postgres if dialect supports it
    created_at    = Column(DateTime, default=datetime.utcnow, nullable=False)
    expires_at    = Column(DateTime, nullable=False, index=True)

    __mapper_args__ = {"eager_defaults": True}
