"""Add soft-archive state to units.

Revision ID: 20261114_01
Revises: 1bcfb1d44898
"""
from typing import Sequence

from alembic import op
import sqlalchemy as sa

revision: str = "20261114_01"
down_revision: str | None = "1bcfb1d44898"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "units",
        sa.Column("is_active", sa.Boolean(), server_default=sa.true(), nullable=False),
    )
    op.create_index("ix_units_property_active", "units", ["property_id", "is_active"])


def downgrade() -> None:
    op.drop_index("ix_units_property_active", table_name="units")
    op.drop_column("units", "is_active")
