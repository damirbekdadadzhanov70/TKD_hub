"""rename belt to sport_rank in athletes table

Revision ID: a1b2c3d4e5f6
Revises: e9f5b3c28f06
Create Date: 2026-02-15 12:00:00.000000

"""

from collections.abc import Sequence

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "a1b2c3d4e5f6"
down_revision: str = "e9f5b3c28f06"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.alter_column("athletes", "belt", new_column_name="sport_rank")


def downgrade() -> None:
    op.alter_column("athletes", "sport_rank", new_column_name="belt")
