"""Add user_id to weight_entries and sleep_entries, make athlete_id nullable.

Revision ID: 009_health_entries_user_id
Revises: 008_training_log_user_id
Create Date: 2026-02-21
"""

import sqlalchemy as sa
from alembic import op

revision = "009_health_entries_user_id"
down_revision = "008_training_log_user_id"
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


def _migrate_table(table: str, old_uq_name: str, new_uq_name: str) -> None:
    """Apply user_id migration pattern to a single table."""
    # Add user_id column (nullable first for backfill)
    op.add_column(table, sa.Column("user_id", sa.Uuid(), nullable=True))

    # Backfill user_id from athlete → user relationship
    op.execute(
        f"""
        UPDATE {table}
        SET user_id = a.user_id
        FROM athletes a
        WHERE {table}.athlete_id = a.id
        """
    )

    # Now make user_id non-nullable
    op.alter_column(table, "user_id", nullable=False)

    # Add FK constraint + index
    op.create_foreign_key(
        f"fk_{table}_user_id",
        table,
        "users",
        ["user_id"],
        ["id"],
        ondelete="CASCADE",
    )
    op.create_index(f"ix_{table}_user_id", table, ["user_id"])

    # Make athlete_id nullable
    op.alter_column(table, "athlete_id", nullable=True)

    # Change athlete_id FK from CASCADE to SET NULL
    old_fk_name = _find_fk_name(table, "athletes", ["id"])
    op.drop_constraint(old_fk_name, table, type_="foreignkey")
    op.create_foreign_key(
        f"fk_{table}_athlete_id",
        table,
        "athletes",
        ["athlete_id"],
        ["id"],
        ondelete="SET NULL",
    )

    # Drop old UniqueConstraint, create new one on (user_id, date)
    op.drop_constraint(old_uq_name, table, type_="unique")
    op.create_unique_constraint(new_uq_name, table, ["user_id", "date"])


def _rollback_table(table: str, old_uq_name: str, new_uq_name: str) -> None:
    """Reverse user_id migration for a single table."""
    op.drop_constraint(new_uq_name, table, type_="unique")
    op.create_unique_constraint(old_uq_name, table, ["athlete_id", "date"])

    # Restore athlete_id FK to CASCADE
    op.drop_constraint(f"fk_{table}_athlete_id", table, type_="foreignkey")
    op.create_foreign_key(
        f"fk_{table}_athlete_id",
        table,
        "athletes",
        ["athlete_id"],
        ["id"],
        ondelete="CASCADE",
    )

    op.alter_column(table, "athlete_id", nullable=False)
    op.drop_index(f"ix_{table}_user_id", table_name=table)
    op.drop_constraint(f"fk_{table}_user_id", table, type_="foreignkey")
    op.drop_column(table, "user_id")


def upgrade() -> None:
    _migrate_table("weight_entries", "uq_weight_athlete_date", "uq_weight_user_date")
    _migrate_table("sleep_entries", "uq_sleep_athlete_date", "uq_sleep_user_date")


def downgrade() -> None:
    _rollback_table("sleep_entries", "uq_sleep_athlete_date", "uq_sleep_user_date")
    _rollback_table("weight_entries", "uq_weight_athlete_date", "uq_weight_user_date")
