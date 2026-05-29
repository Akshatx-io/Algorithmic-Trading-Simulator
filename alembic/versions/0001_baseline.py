"""Phase 2.2 baseline schema.

Revision ID: 0001_baseline
Revises:
Create Date: 2026-05-29

This baseline replaces the prior `001_initial.py` migration (audit 3.2 —
model/migration drift). It is hand-authored to match the ORM exactly and
includes the new `orders` and `idempotency_records` tables.

Going forward, every model change ships its own Alembic revision.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0001_baseline"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # -----------------------------------------------------------------------
    # users
    # -----------------------------------------------------------------------
    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("username", sa.String(length=64), nullable=False, unique=True),
        sa.Column("email", sa.String(length=255), nullable=True, unique=True),
        sa.Column("hashed_password", sa.String(length=255), nullable=False),
        sa.Column("balance", sa.Float(), nullable=False, server_default="100000.0"),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_users_id", "users", ["id"])
    op.create_index("ix_users_username", "users", ["username"], unique=True)
    op.create_index("ix_users_email", "users", ["email"], unique=True)

    # -----------------------------------------------------------------------
    # risk_profiles
    # -----------------------------------------------------------------------
    op.create_table(
        "risk_profiles",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"),
                  nullable=False, unique=True),
        sa.Column("max_position_pct",        sa.Float(), server_default="0.2"),
        sa.Column("max_total_exposure_pct",  sa.Float(), server_default="0.8"),
        sa.Column("max_daily_loss_pct",      sa.Float(), server_default="0.05"),
        sa.Column("daily_loss_limit_pct",    sa.Float(), server_default="0.05"),
        sa.Column("is_trading_blocked",      sa.Integer(), server_default="0"),
    )
    op.create_index("ix_risk_profiles_id", "risk_profiles", ["id"])

    # -----------------------------------------------------------------------
    # orders
    # -----------------------------------------------------------------------
    op.create_table(
        "orders",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("client_order_id", sa.String(length=64), nullable=False, unique=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("symbol", sa.String(length=16), nullable=False),
        sa.Column("side", sa.String(length=8), nullable=False),
        sa.Column("order_type", sa.String(length=16), nullable=False),
        sa.Column("time_in_force", sa.String(length=8), nullable=False, server_default="GTC"),
        sa.Column("status", sa.String(length=16), nullable=False, server_default="PENDING"),
        sa.Column("quantity", sa.Float(), nullable=False),
        sa.Column("filled_quantity", sa.Float(), nullable=False, server_default="0.0"),
        sa.Column("limit_price", sa.Float(), nullable=True),
        sa.Column("stop_price", sa.Float(), nullable=True),
        sa.Column("avg_fill_price", sa.Float(), nullable=True),
        sa.Column("rejection_reason", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_orders_id", "orders", ["id"])
    op.create_index("ix_orders_client_order_id", "orders", ["client_order_id"], unique=True)
    op.create_index("ix_orders_user_status", "orders", ["user_id", "status"])
    op.create_index("ix_orders_symbol_status", "orders", ["symbol", "status"])
    op.create_index("ix_orders_created_at", "orders", ["created_at"])

    # -----------------------------------------------------------------------
    # trades
    # -----------------------------------------------------------------------
    op.create_table(
        "trades",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("order_id", sa.Integer(), sa.ForeignKey("orders.id", ondelete="SET NULL"), nullable=True),
        sa.Column("symbol", sa.String(length=16), nullable=False),
        sa.Column("action", sa.String(length=8), nullable=False),
        sa.Column("quantity", sa.Float(), nullable=False),
        sa.Column("price", sa.Float(), nullable=False),
        sa.Column("fees", sa.Float(), nullable=False, server_default="0.0"),
        sa.Column("realized_pnl", sa.Float(), nullable=True),
        sa.Column("timestamp", sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_trades_id", "trades", ["id"])
    op.create_index("ix_trades_user_id", "trades", ["user_id"])
    op.create_index("ix_trades_order_id", "trades", ["order_id"])
    op.create_index("ix_trades_symbol", "trades", ["symbol"])
    op.create_index("ix_trades_timestamp", "trades", ["timestamp"])

    # -----------------------------------------------------------------------
    # positions
    # -----------------------------------------------------------------------
    op.create_table(
        "positions",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("symbol", sa.String(length=16), nullable=False),
        sa.Column("quantity", sa.Float(), nullable=False, server_default="0.0"),
        sa.Column("avg_price", sa.Float(), nullable=False, server_default="0.0"),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint("user_id", "symbol", name="uq_positions_user_symbol"),
    )
    op.create_index("ix_positions_id", "positions", ["id"])
    op.create_index("ix_positions_user_id", "positions", ["user_id"])
    op.create_index("ix_positions_symbol", "positions", ["symbol"])

    # -----------------------------------------------------------------------
    # equity_history
    # -----------------------------------------------------------------------
    op.create_table(
        "equity_history",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("total_equity", sa.Float(), nullable=False),
        sa.Column("timestamp", sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_equity_history_id", "equity_history", ["id"])
    op.create_index("ix_equity_history_user_time", "equity_history", ["user_id", "timestamp"])

    # -----------------------------------------------------------------------
    # idempotency_records (Phase 2.4 will start writing into this)
    # -----------------------------------------------------------------------
    op.create_table(
        "idempotency_records",
        sa.Column("key", sa.String(length=64), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("request_hash", sa.String(length=64), nullable=False),
        sa.Column("response_body", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("expires_at", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_idempotency_user_id", "idempotency_records", ["user_id"])
    op.create_index("ix_idempotency_expires", "idempotency_records", ["expires_at"])


def downgrade() -> None:
    op.drop_index("ix_idempotency_expires", table_name="idempotency_records")
    op.drop_index("ix_idempotency_user_id", table_name="idempotency_records")
    op.drop_table("idempotency_records")

    op.drop_index("ix_equity_history_user_time", table_name="equity_history")
    op.drop_index("ix_equity_history_id",        table_name="equity_history")
    op.drop_table("equity_history")

    op.drop_index("ix_positions_symbol",  table_name="positions")
    op.drop_index("ix_positions_user_id", table_name="positions")
    op.drop_index("ix_positions_id",      table_name="positions")
    op.drop_table("positions")

    op.drop_index("ix_trades_timestamp", table_name="trades")
    op.drop_index("ix_trades_symbol",    table_name="trades")
    op.drop_index("ix_trades_order_id",  table_name="trades")
    op.drop_index("ix_trades_user_id",   table_name="trades")
    op.drop_index("ix_trades_id",        table_name="trades")
    op.drop_table("trades")

    op.drop_index("ix_orders_created_at",       table_name="orders")
    op.drop_index("ix_orders_symbol_status",    table_name="orders")
    op.drop_index("ix_orders_user_status",      table_name="orders")
    op.drop_index("ix_orders_client_order_id",  table_name="orders")
    op.drop_index("ix_orders_id",               table_name="orders")
    op.drop_table("orders")

    op.drop_index("ix_risk_profiles_id", table_name="risk_profiles")
    op.drop_table("risk_profiles")

    op.drop_index("ix_users_email",    table_name="users")
    op.drop_index("ix_users_username", table_name="users")
    op.drop_index("ix_users_id",       table_name="users")
    op.drop_table("users")
