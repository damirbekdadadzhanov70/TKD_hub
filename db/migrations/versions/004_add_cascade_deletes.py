"""add cascade deletes to FK constraints

Revision ID: c7d3b9e15f04
Revises: b5e2a8f14c03
Create Date: 2026-02-12 21:30:00.000000

"""

from collections.abc import Sequence

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "c7d3b9e15f04"
down_revision: str | None = "b5e2a8f14c03"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # tournament_entries
    with op.batch_alter_table("tournament_entries") as batch_op:
        batch_op.drop_constraint("fk_tournament_entries_tournament_id", type_="foreignkey")
        batch_op.drop_constraint("fk_tournament_entries_athlete_id", type_="foreignkey")
        batch_op.drop_constraint("fk_tournament_entries_coach_id", type_="foreignkey")
        batch_op.create_foreign_key(
            "fk_tournament_entries_tournament_id", "tournaments", ["tournament_id"], ["id"], ondelete="CASCADE"
        )
        batch_op.create_foreign_key(
            "fk_tournament_entries_athlete_id", "athletes", ["athlete_id"], ["id"], ondelete="CASCADE"
        )
        batch_op.create_foreign_key(
            "fk_tournament_entries_coach_id", "coaches", ["coach_id"], ["id"], ondelete="CASCADE"
        )

    # tournament_results
    with op.batch_alter_table("tournament_results") as batch_op:
        batch_op.drop_constraint("fk_tournament_results_tournament_id", type_="foreignkey")
        batch_op.drop_constraint("fk_tournament_results_athlete_id", type_="foreignkey")
        batch_op.create_foreign_key(
            "fk_tournament_results_tournament_id", "tournaments", ["tournament_id"], ["id"], ondelete="CASCADE"
        )
        batch_op.create_foreign_key(
            "fk_tournament_results_athlete_id", "athletes", ["athlete_id"], ["id"], ondelete="CASCADE"
        )

    # tournament_interests
    with op.batch_alter_table("tournament_interests") as batch_op:
        batch_op.drop_constraint("fk_tournament_interests_tournament_id", type_="foreignkey")
        batch_op.drop_constraint("fk_tournament_interests_athlete_id", type_="foreignkey")
        batch_op.create_foreign_key(
            "fk_tournament_interests_tournament_id", "tournaments", ["tournament_id"], ["id"], ondelete="CASCADE"
        )
        batch_op.create_foreign_key(
            "fk_tournament_interests_athlete_id", "athletes", ["athlete_id"], ["id"], ondelete="CASCADE"
        )


def downgrade() -> None:
    # tournament_interests
    with op.batch_alter_table("tournament_interests") as batch_op:
        batch_op.drop_constraint("fk_tournament_interests_tournament_id", type_="foreignkey")
        batch_op.drop_constraint("fk_tournament_interests_athlete_id", type_="foreignkey")
        batch_op.create_foreign_key("fk_tournament_interests_tournament_id", "tournaments", ["tournament_id"], ["id"])
        batch_op.create_foreign_key("fk_tournament_interests_athlete_id", "athletes", ["athlete_id"], ["id"])

    # tournament_results
    with op.batch_alter_table("tournament_results") as batch_op:
        batch_op.drop_constraint("fk_tournament_results_tournament_id", type_="foreignkey")
        batch_op.drop_constraint("fk_tournament_results_athlete_id", type_="foreignkey")
        batch_op.create_foreign_key("fk_tournament_results_tournament_id", "tournaments", ["tournament_id"], ["id"])
        batch_op.create_foreign_key("fk_tournament_results_athlete_id", "athletes", ["athlete_id"], ["id"])

    # tournament_entries
    with op.batch_alter_table("tournament_entries") as batch_op:
        batch_op.drop_constraint("fk_tournament_entries_tournament_id", type_="foreignkey")
        batch_op.drop_constraint("fk_tournament_entries_athlete_id", type_="foreignkey")
        batch_op.drop_constraint("fk_tournament_entries_coach_id", type_="foreignkey")
        batch_op.create_foreign_key("fk_tournament_entries_tournament_id", "tournaments", ["tournament_id"], ["id"])
        batch_op.create_foreign_key("fk_tournament_entries_athlete_id", "athletes", ["athlete_id"], ["id"])
        batch_op.create_foreign_key("fk_tournament_entries_coach_id", "coaches", ["coach_id"], ["id"])
