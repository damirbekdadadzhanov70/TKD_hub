"""add ref_id column to notifications

Revision ID: d4e5f6a7b8c9
Revises: c3d4e5f6a7b8
Create Date: 2026-02-18 20:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "d4e5f6a7b8c9"
down_revision: str = "c3d4e5f6a7b8"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("notifications", sa.Column("ref_id", sa.String(36), nullable=True))


def downgrade() -> None:
    op.drop_column("notifications", "ref_id")
