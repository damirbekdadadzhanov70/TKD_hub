"""add CASCADE DELETE on user-related FKs and missing indexes

Revision ID: e9f5b3c28f06
Revises: d8f4a2b17e05
Create Date: 2026-02-14 18:00:00.000000

"""

from collections.abc import Sequence

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "e9f5b3c28f06"
down_revision: str = "d8f4a2b17e05"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # ── CASCADE DELETE on user-related foreign keys ──
    # athlete.user_id → CASCADE
    op.drop_constraint("fk_athletes_user_id", "athletes", type_="foreignkey")
    op.create_foreign_key("fk_athletes_user_id", "athletes", "users", ["user_id"], ["id"], ondelete="CASCADE")

    # coach.user_id → CASCADE
    op.drop_constraint("fk_coaches_user_id", "coaches", type_="foreignkey")
    op.create_foreign_key("fk_coaches_user_id", "coaches", "users", ["user_id"], ["id"], ondelete="CASCADE")

    # training_log.athlete_id → CASCADE
    op.drop_constraint("fk_training_log_athlete_id", "training_log", type_="foreignkey")
    op.create_foreign_key(
        "fk_training_log_athlete_id", "training_log", "athletes", ["athlete_id"], ["id"], ondelete="CASCADE"
    )

    # coach_athletes.coach_id + athlete_id → CASCADE
    op.drop_constraint("fk_coach_athletes_coach_id", "coach_athletes", type_="foreignkey")
    op.drop_constraint("fk_coach_athletes_athlete_id", "coach_athletes", type_="foreignkey")
    op.create_foreign_key(
        "fk_coach_athletes_coach_id", "coach_athletes", "coaches", ["coach_id"], ["id"], ondelete="CASCADE"
    )
    op.create_foreign_key(
        "fk_coach_athletes_athlete_id", "coach_athletes", "athletes", ["athlete_id"], ["id"], ondelete="CASCADE"
    )

    # role_requests.user_id → CASCADE, reviewed_by → SET NULL
    op.drop_constraint("fk_role_requests_user_id", "role_requests", type_="foreignkey")
    op.drop_constraint("fk_role_requests_reviewed_by", "role_requests", type_="foreignkey")
    op.create_foreign_key("fk_role_requests_user_id", "role_requests", "users", ["user_id"], ["id"], ondelete="CASCADE")
    op.create_foreign_key(
        "fk_role_requests_reviewed_by", "role_requests", "users", ["reviewed_by"], ["id"], ondelete="SET NULL"
    )

    # audit_logs.user_id → CASCADE
    op.drop_constraint("fk_audit_logs_user_id", "audit_logs", type_="foreignkey")
    op.create_foreign_key("fk_audit_logs_user_id", "audit_logs", "users", ["user_id"], ["id"], ondelete="CASCADE")

    # tournaments.created_by → CASCADE
    op.drop_constraint("fk_tournaments_created_by", "tournaments", type_="foreignkey")
    op.create_foreign_key(
        "fk_tournaments_created_by", "tournaments", "users", ["created_by"], ["id"], ondelete="CASCADE"
    )

    # ── Missing indexes ──
    op.create_index("ix_coach_athletes_coach_id", "coach_athletes", ["coach_id"])
    op.create_index("ix_coach_athletes_athlete_id", "coach_athletes", ["athlete_id"])
    op.create_index("ix_role_requests_user_id", "role_requests", ["user_id"])
    op.create_index("ix_role_requests_status", "role_requests", ["status"])
    op.create_index("ix_audit_logs_action", "audit_logs", ["action"])


def downgrade() -> None:
    # Drop indexes
    op.drop_index("ix_audit_logs_action", table_name="audit_logs")
    op.drop_index("ix_role_requests_status", table_name="role_requests")
    op.drop_index("ix_role_requests_user_id", table_name="role_requests")
    op.drop_index("ix_coach_athletes_athlete_id", table_name="coach_athletes")
    op.drop_index("ix_coach_athletes_coach_id", table_name="coach_athletes")

    # Revert FKs to no-cascade (reverse order)
    op.drop_constraint("fk_tournaments_created_by", "tournaments", type_="foreignkey")
    op.create_foreign_key("fk_tournaments_created_by", "tournaments", "users", ["created_by"], ["id"])

    op.drop_constraint("fk_audit_logs_user_id", "audit_logs", type_="foreignkey")
    op.create_foreign_key("fk_audit_logs_user_id", "audit_logs", "users", ["user_id"], ["id"])

    op.drop_constraint("fk_role_requests_reviewed_by", "role_requests", type_="foreignkey")
    op.drop_constraint("fk_role_requests_user_id", "role_requests", type_="foreignkey")
    op.create_foreign_key("fk_role_requests_reviewed_by", "role_requests", "users", ["reviewed_by"], ["id"])
    op.create_foreign_key("fk_role_requests_user_id", "role_requests", "users", ["user_id"], ["id"])

    op.drop_constraint("fk_coach_athletes_athlete_id", "coach_athletes", type_="foreignkey")
    op.drop_constraint("fk_coach_athletes_coach_id", "coach_athletes", type_="foreignkey")
    op.create_foreign_key("fk_coach_athletes_athlete_id", "coach_athletes", "athletes", ["athlete_id"], ["id"])
    op.create_foreign_key("fk_coach_athletes_coach_id", "coach_athletes", "coaches", ["coach_id"], ["id"])

    op.drop_constraint("fk_training_log_athlete_id", "training_log", type_="foreignkey")
    op.create_foreign_key("fk_training_log_athlete_id", "training_log", "athletes", ["athlete_id"], ["id"])

    op.drop_constraint("fk_coaches_user_id", "coaches", type_="foreignkey")
    op.create_foreign_key("fk_coaches_user_id", "coaches", "users", ["user_id"], ["id"])

    op.drop_constraint("fk_athletes_user_id", "athletes", type_="foreignkey")
    op.create_foreign_key("fk_athletes_user_id", "athletes", "users", ["user_id"], ["id"])
