"""Add results_url to tournaments.

Revision ID: 003_results_url
Revises: 002_tournament_info
Create Date: 2026-02-19

Adds results_url column to tournaments table for linking external result files.
"""

import sqlalchemy as sa
from alembic import op

revision = "003_results_url"
down_revision = "002_tournament_info"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("tournaments", sa.Column("results_url", sa.String(500), nullable=True))


def downgrade() -> None:
    op.drop_column("tournaments", "results_url")
