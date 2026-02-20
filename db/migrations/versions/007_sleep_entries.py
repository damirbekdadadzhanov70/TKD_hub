"""Add sleep_entries table.

Revision ID: 007_sleep_entries
Revises: 006_weight_entries
Create Date: 2026-02-21
"""

import sqlalchemy as sa
from alembic import op

revision = "007_sleep_entries"
down_revision = "006_weight_entries"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "sleep_entries",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("athlete_id", sa.Uuid(), sa.ForeignKey("athletes.id", ondelete="CASCADE"), nullable=False),
        sa.Column("date", sa.Date(), nullable=False),
        sa.Column("sleep_hours", sa.Numeric(4, 2), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint("athlete_id", "date", name="uq_sleep_athlete_date"),
    )
    op.create_index("ix_sleep_entries_athlete_id", "sleep_entries", ["athlete_id"])


def downgrade() -> None:
    op.drop_index("ix_sleep_entries_athlete_id", table_name="sleep_entries")
    op.drop_table("sleep_entries")
