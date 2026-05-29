"""DEPRECATED — replaced by 0001_baseline.py.

The original 001_initial migration was authored against an earlier version
of the ORM and disagreed with the live models (audit 3.2). It has been
superseded by 0001_baseline.py.

This file is a no-op stub kept only to avoid breaking any environment that
already recorded `001_initial` in its `alembic_version` table. On such an
environment, run:

    alembic stamp 0001_baseline

…to skip past this revision cleanly.

Schedule for deletion on next `scripts/cleanup_local.sh` run.
"""

revision = "001_initial"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:  # pragma: no cover - intentional no-op
    pass


def downgrade() -> None:  # pragma: no cover - intentional no-op
    pass
