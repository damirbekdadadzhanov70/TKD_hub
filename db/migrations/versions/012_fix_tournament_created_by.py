"""Fix tournaments.created_by FK: CASCADE -> SET NULL

Revision ID: e5f6a7b8c9d0
Revises: d4e5f6a7b8c9
Create Date: 2026-02-18
"""

from alembic import op

revision = "e5f6a7b8c9d0"
down_revision = "d4e5f6a7b8c9"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_constraint("fk_tournaments_created_by", "tournaments", type_="foreignkey")
    op.alter_column("tournaments", "created_by", nullable=True)
    op.create_foreign_key(
        "fk_tournaments_created_by",
        "tournaments",
        "users",
        ["created_by"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    op.drop_constraint("fk_tournaments_created_by", "tournaments", type_="foreignkey")
    op.alter_column("tournaments", "created_by", nullable=False)
    op.create_foreign_key(
        "fk_tournaments_created_by",
        "tournaments",
        "users",
        ["created_by"],
        ["id"],
        ondelete="CASCADE",
    )
