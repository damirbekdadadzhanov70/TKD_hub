"""add tournament_interests

Revision ID: 945d8e2d1284
Revises: 47eb030a4bd7
Create Date: 2026-02-12 19:07:15.611971

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "945d8e2d1284"
down_revision: str | None = "47eb030a4bd7"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "tournament_interests",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("tournament_id", sa.Uuid(), nullable=False),
        sa.Column("athlete_id", sa.Uuid(), nullable=False),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["athlete_id"], ["athletes.id"], name="fk_ti_athlete_id"),
        sa.ForeignKeyConstraint(["tournament_id"], ["tournaments.id"], name="fk_ti_tournament_id"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("tournament_id", "athlete_id"),
    )


def downgrade() -> None:
    op.drop_table("tournament_interests")
