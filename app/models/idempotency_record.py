"""
Idempotency record — durable backup for the Redis-backed idempotency store.

Redis is the primary store (sub-ms reads). This table provides a durable
fallback if Redis is unavailable and a forensic trail for the audit log.

Inserted asynchronously by IdempotencyService.store(), never blocks the
mutation path.
"""

from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, Index, Integer, String, Text

from app.models.base import Base


class IdempotencyRecord(Base):
    __tablename__ = "idempotency_records"

    # Same columns as 0001_baseline, but named explicitly: SQLAlchemy's
    # `index=True` would auto-name these ix_idempotency_records_* while the
    # migration creates ix_idempotency_*, which reads as schema drift on every
    # autogenerate run.
    __table_args__ = (
        Index("ix_idempotency_user_id", "user_id"),
        Index("ix_idempotency_expires", "expires_at"),
    )

    key           = Column(String(64), primary_key=True)
    user_id       = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    request_hash  = Column(String(64), nullable=False)
    response_body = Column(Text, nullable=False)   # JSON-encoded; JSONB on Postgres if dialect supports it
    created_at    = Column(DateTime, default=datetime.utcnow, nullable=False)
    expires_at    = Column(DateTime, nullable=False)

    __mapper_args__ = {"eager_defaults": True}
