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
    # tournament_entries — replace FKs with CASCADE versions
    op.drop_constraint("fk_te_tournament_id", "tournament_entries", type_="foreignkey")
    op.drop_constraint("fk_te_athlete_id", "tournament_entries", type_="foreignkey")
    op.drop_constraint("fk_te_coach_id", "tournament_entries", type_="foreignkey")
    op.create_foreign_key(
        "fk_te_tournament_id", "tournament_entries", "tournaments", ["tournament_id"], ["id"], ondelete="CASCADE"
    )
    op.create_foreign_key(
        "fk_te_athlete_id", "tournament_entries", "athletes", ["athlete_id"], ["id"], ondelete="CASCADE"
    )
    op.create_foreign_key("fk_te_coach_id", "tournament_entries", "coaches", ["coach_id"], ["id"], ondelete="CASCADE")

    # tournament_results
    op.drop_constraint("fk_tr_tournament_id", "tournament_results", type_="foreignkey")
    op.drop_constraint("fk_tr_athlete_id", "tournament_results", type_="foreignkey")
    op.create_foreign_key(
        "fk_tr_tournament_id", "tournament_results", "tournaments", ["tournament_id"], ["id"], ondelete="CASCADE"
    )
    op.create_foreign_key(
        "fk_tr_athlete_id", "tournament_results", "athletes", ["athlete_id"], ["id"], ondelete="CASCADE"
    )

    # tournament_interests
    op.drop_constraint("fk_ti_tournament_id", "tournament_interests", type_="foreignkey")
    op.drop_constraint("fk_ti_athlete_id", "tournament_interests", type_="foreignkey")
    op.create_foreign_key(
        "fk_ti_tournament_id", "tournament_interests", "tournaments", ["tournament_id"], ["id"], ondelete="CASCADE"
    )
    op.create_foreign_key(
        "fk_ti_athlete_id", "tournament_interests", "athletes", ["athlete_id"], ["id"], ondelete="CASCADE"
    )


def downgrade() -> None:
    # tournament_interests — revert to no-cascade
    op.drop_constraint("fk_ti_tournament_id", "tournament_interests", type_="foreignkey")
    op.drop_constraint("fk_ti_athlete_id", "tournament_interests", type_="foreignkey")
    op.create_foreign_key("fk_ti_tournament_id", "tournament_interests", "tournaments", ["tournament_id"], ["id"])
    op.create_foreign_key("fk_ti_athlete_id", "tournament_interests", "athletes", ["athlete_id"], ["id"])

    # tournament_results
    op.drop_constraint("fk_tr_tournament_id", "tournament_results", type_="foreignkey")
    op.drop_constraint("fk_tr_athlete_id", "tournament_results", type_="foreignkey")
    op.create_foreign_key("fk_tr_tournament_id", "tournament_results", "tournaments", ["tournament_id"], ["id"])
    op.create_foreign_key("fk_tr_athlete_id", "tournament_results", "athletes", ["athlete_id"], ["id"])

    # tournament_entries
    op.drop_constraint("fk_te_tournament_id", "tournament_entries", type_="foreignkey")
    op.drop_constraint("fk_te_athlete_id", "tournament_entries", type_="foreignkey")
    op.drop_constraint("fk_te_coach_id", "tournament_entries", type_="foreignkey")
    op.create_foreign_key("fk_te_tournament_id", "tournament_entries", "tournaments", ["tournament_id"], ["id"])
    op.create_foreign_key("fk_te_athlete_id", "tournament_entries", "athletes", ["athlete_id"], ["id"])
    op.create_foreign_key("fk_te_coach_id", "tournament_entries", "coaches", ["coach_id"], ["id"])
