"""Add user_id to training_log, make athlete_id nullable.

Revision ID: 008_training_log_user_id
Revises: 007_sleep_entries
Create Date: 2026-02-21
"""

import sqlalchemy as sa
from alembic import op

revision = "008_training_log_user_id"
down_revision = "007_sleep_entries"
branch_labels = None
depends_on = None


def _find_fk_name(table: str, referred_table: str, referred_columns: list[str]) -> str:
    """Find the actual FK constraint name by inspecting the database."""
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    for fk in inspector.get_foreign_keys(table):
        if fk["referred_table"] == referred_table and fk["referred_columns"] == referred_columns:
            return fk["name"]
    raise RuntimeError(f"FK constraint not found: {table} -> {referred_table}({referred_columns})")


def upgrade() -> None:
    # Add user_id column (nullable first for backfill)
    op.add_column("training_log", sa.Column("user_id", sa.Uuid(), nullable=True))

    # Backfill user_id from athlete → user relationship
    op.execute(
        """
        UPDATE training_log
        SET user_id = a.user_id
        FROM athletes a
        WHERE training_log.athlete_id = a.id
        """
    )

    # Now make user_id non-nullable
    op.alter_column("training_log", "user_id", nullable=False)

    # Add FK constraint
    op.create_foreign_key(
        "fk_training_log_user_id",
        "training_log",
        "users",
        ["user_id"],
        ["id"],
        ondelete="CASCADE",
    )

    # Make athlete_id nullable
    op.alter_column("training_log", "athlete_id", nullable=True)

    # Change athlete_id FK from CASCADE to SET NULL
    old_fk_name = _find_fk_name("training_log", "athletes", ["id"])
    op.drop_constraint(old_fk_name, "training_log", type_="foreignkey")
    op.create_foreign_key(
        "fk_training_log_athlete_id",
        "training_log",
        "athletes",
        ["athlete_id"],
        ["id"],
        ondelete="SET NULL",
    )

    op.create_index("ix_training_log_user_id", "training_log", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_training_log_user_id", table_name="training_log")

    # Restore athlete_id FK to CASCADE
    op.drop_constraint("fk_training_log_athlete_id", "training_log", type_="foreignkey")
    op.create_foreign_key(
        "fk_training_log_athlete_id",
        "training_log",
        "athletes",
        ["athlete_id"],
        ["id"],
        ondelete="CASCADE",
    )

    op.alter_column("training_log", "athlete_id", nullable=False)
    op.drop_constraint("fk_training_log_user_id", "training_log", type_="foreignkey")
    op.drop_column("training_log", "user_id")
