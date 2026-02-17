"""add active_role and role_request_data

Revision ID: 0e70cb4947f8
Revises: a1b2c3d4e5f6
Create Date: 2026-02-17 21:20:19.644248

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0e70cb4947f8"
down_revision: str | None = "a1b2c3d4e5f6"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("users", sa.Column("active_role", sa.String(length=20), nullable=True))
    op.add_column("role_requests", sa.Column("data", sa.JSON(), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "active_role")
    op.drop_column("role_requests", "data")
