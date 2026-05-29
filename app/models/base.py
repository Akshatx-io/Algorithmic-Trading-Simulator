"""Single declarative Base for all ORM models.

Audit fix 5.1 — the previous setup defined Base inside database.py *after*
referencing it in create_tables(), which worked only by lazy evaluation.
Splitting Base into its own module breaks that ordering hazard.
"""

from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    """All ORM models inherit from this."""
