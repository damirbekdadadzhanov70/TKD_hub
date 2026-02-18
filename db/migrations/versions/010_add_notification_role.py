"""add role column to notifications

Revision ID: c3d4e5f6a7b8
Revises: b2c3d4e5f6a7
Create Date: 2026-02-18 18:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "c3d4e5f6a7b8"
down_revision: str = "b2c3d4e5f6a7"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("notifications", sa.Column("role", sa.String(20), nullable=True))
    op.create_index("ix_notifications_role", "notifications", ["role"])


def downgrade() -> None:
    op.drop_index("ix_notifications_role")
    op.drop_column("notifications", "role")
