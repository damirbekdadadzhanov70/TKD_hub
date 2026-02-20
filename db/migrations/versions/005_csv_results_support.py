"""Add CSV results support to tournament_results.

Revision ID: 005_csv_results_support
Revises: 004_tournament_files
Create Date: 2026-02-20

Makes athlete_id nullable, adds raw_full_name and raw_weight_category columns,
replaces unique constraint for CSV-based result deduplication.
"""

import sqlalchemy as sa
from alembic import op

revision = "005_csv_results_support"
down_revision = "004_tournament_files"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Make athlete_id nullable
    op.alter_column("tournament_results", "athlete_id", existing_type=sa.Uuid(), nullable=True)

    # Add raw CSV columns
    op.add_column("tournament_results", sa.Column("raw_full_name", sa.String(255), nullable=True))
    op.add_column("tournament_results", sa.Column("raw_weight_category", sa.String(50), nullable=True))

    # Drop old unique constraint, create new one
    op.drop_constraint("uq_tournament_results_tournament_id", "tournament_results", type_="unique")
    op.create_unique_constraint(
        "uq_tournament_results_csv",
        "tournament_results",
        ["tournament_id", "raw_full_name", "weight_category"],
    )


def downgrade() -> None:
    op.drop_constraint("uq_tournament_results_csv", "tournament_results", type_="unique")
    op.create_unique_constraint(
        "uq_tournament_results_tournament_id",
        "tournament_results",
        ["tournament_id", "athlete_id", "weight_category", "age_category"],
    )
    op.drop_column("tournament_results", "raw_weight_category")
    op.drop_column("tournament_results", "raw_full_name")
    op.alter_column("tournament_results", "athlete_id", existing_type=sa.Uuid(), nullable=False)
