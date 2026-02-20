"""Add weight_entries table.

Revision ID: 006_weight_entries
Revises: 005_csv_results_support
Create Date: 2026-02-21
"""

import sqlalchemy as sa
from alembic import op

revision = "006_weight_entries"
down_revision = "005_csv_results_support"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "weight_entries",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("athlete_id", sa.Uuid(), sa.ForeignKey("athletes.id", ondelete="CASCADE"), nullable=False),
        sa.Column("date", sa.Date(), nullable=False),
        sa.Column("weight_kg", sa.Numeric(5, 2), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint("athlete_id", "date", name="uq_weight_athlete_date"),
    )
    op.create_index("ix_weight_entries_athlete_id", "weight_entries", ["athlete_id"])


def downgrade() -> None:
    op.drop_index("ix_weight_entries_athlete_id", table_name="weight_entries")
    op.drop_table("weight_entries")
