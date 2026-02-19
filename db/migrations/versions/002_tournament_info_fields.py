"""Add tournament info fields and result gender.

Revision ID: 002_tournament_info
Revises: 001_initial
Create Date: 2026-02-19

Adds photos_url, organizer_name, organizer_phone, organizer_telegram
to tournaments table. Adds gender to tournament_results table.
"""

import sqlalchemy as sa
from alembic import op

revision = "002_tournament_info"
down_revision = "001_initial"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("tournaments", sa.Column("photos_url", sa.String(500), nullable=True))
    op.add_column("tournaments", sa.Column("organizer_name", sa.String(255), nullable=True))
    op.add_column("tournaments", sa.Column("organizer_phone", sa.String(50), nullable=True))
    op.add_column("tournaments", sa.Column("organizer_telegram", sa.String(100), nullable=True))
    op.add_column("tournament_results", sa.Column("gender", sa.String(10), nullable=True))


def downgrade() -> None:
    op.drop_column("tournament_results", "gender")
    op.drop_column("tournaments", "organizer_telegram")
    op.drop_column("tournaments", "organizer_phone")
    op.drop_column("tournaments", "organizer_name")
    op.drop_column("tournaments", "photos_url")
