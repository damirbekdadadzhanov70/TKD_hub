"""Add tournament_files table.

Revision ID: 004_tournament_files
Revises: 003_results_url
Create Date: 2026-02-20

Adds tournament_files table for storing PDF documents attached to tournaments.
"""

import sqlalchemy as sa
from alembic import op

revision = "004_tournament_files"
down_revision = "003_results_url"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "tournament_files",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("tournament_id", sa.Uuid(), sa.ForeignKey("tournaments.id", ondelete="CASCADE"), nullable=False),
        sa.Column("filename", sa.String(255), nullable=False),
        sa.Column("blob_url", sa.String(1000), nullable=False),
        sa.Column("file_size", sa.Integer(), nullable=False),
        sa.Column("file_type", sa.String(50), nullable=False),
        sa.Column("uploaded_by", sa.Uuid(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table("tournament_files")
