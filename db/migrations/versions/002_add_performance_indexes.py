"""add performance indexes

Revision ID: a3f1c7d92e01
Revises: 945d8e2d1284
Create Date: 2026-02-12 20:00:00.000000

"""

from collections.abc import Sequence

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "a3f1c7d92e01"
down_revision: str | None = "945d8e2d1284"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Ratings page: filter active athletes sorted by rating
    op.create_index(
        "ix_athlete_active_rating",
        "athletes",
        ["is_active", "rating_points"],
    )

    # Training log: filter by athlete + date range
    op.create_index(
        "ix_training_log_athlete_date",
        "training_log",
        ["athlete_id", "date"],
    )

    # Tournament entries: coach lookup
    op.create_index(
        "ix_tournament_entry_coach_id",
        "tournament_entries",
        ["coach_id"],
    )

    # Tournament entries: athlete lookup
    op.create_index(
        "ix_tournament_entry_athlete_id",
        "tournament_entries",
        ["athlete_id"],
    )

    # Tournament list: filter by status, sort by start_date
    op.create_index(
        "ix_tournament_status_start",
        "tournaments",
        ["status", "start_date"],
    )

    # Tournament interests: athlete lookup
    op.create_index(
        "ix_tournament_interest_athlete",
        "tournament_interests",
        ["athlete_id"],
    )


def downgrade() -> None:
    op.drop_index("ix_tournament_interest_athlete", table_name="tournament_interests")
    op.drop_index("ix_tournament_status_start", table_name="tournaments")
    op.drop_index("ix_tournament_entry_athlete_id", table_name="tournament_entries")
    op.drop_index("ix_tournament_entry_coach_id", table_name="tournament_entries")
    op.drop_index("ix_training_log_athlete_date", table_name="training_log")
    op.drop_index("ix_athlete_active_rating", table_name="athletes")
