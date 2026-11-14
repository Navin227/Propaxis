"""Add an optional floor number to units.

Revision ID: 20261114_02
Revises: 20261114_01
"""
from typing import Sequence

from alembic import op
import sqlalchemy as sa

revision: str = "20261114_02"
down_revision: str | None = "20261114_01"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("units", sa.Column("floor", sa.Integer(), nullable=True))
    op.create_check_constraint(
        "ck_units_floor_nonnegative",
        "units",
        "floor IS NULL OR floor >= 0",
    )


def downgrade() -> None:
    op.drop_constraint("ck_units_floor_nonnegative", "units", type_="check")
    op.drop_column("units", "floor")
