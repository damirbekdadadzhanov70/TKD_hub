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

# Naming convention so Alembic can find unnamed SQLite FK constraints
_naming = {"fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s"}


def upgrade() -> None:
    # ── CASCADE DELETE on user-related foreign keys ──
    # athlete.user_id → CASCADE
    with op.batch_alter_table("athletes", naming_convention=_naming) as batch_op:
        batch_op.drop_constraint("fk_athletes_user_id_users", type_="foreignkey")
        batch_op.create_foreign_key("fk_athletes_user_id", "users", ["user_id"], ["id"], ondelete="CASCADE")

    # coach.user_id → CASCADE
    with op.batch_alter_table("coaches", naming_convention=_naming) as batch_op:
        batch_op.drop_constraint("fk_coaches_user_id_users", type_="foreignkey")
        batch_op.create_foreign_key("fk_coaches_user_id", "users", ["user_id"], ["id"], ondelete="CASCADE")

    # training_log.athlete_id → CASCADE
    with op.batch_alter_table("training_log", naming_convention=_naming) as batch_op:
        batch_op.drop_constraint("fk_training_log_athlete_id_athletes", type_="foreignkey")
        batch_op.create_foreign_key(
            "fk_training_log_athlete_id", "athletes", ["athlete_id"], ["id"], ondelete="CASCADE"
        )

    # coach_athletes.coach_id + athlete_id → CASCADE
    with op.batch_alter_table("coach_athletes", naming_convention=_naming) as batch_op:
        batch_op.drop_constraint("fk_coach_athletes_coach_id_coaches", type_="foreignkey")
        batch_op.drop_constraint("fk_coach_athletes_athlete_id_athletes", type_="foreignkey")
        batch_op.create_foreign_key("fk_coach_athletes_coach_id", "coaches", ["coach_id"], ["id"], ondelete="CASCADE")
        batch_op.create_foreign_key(
            "fk_coach_athletes_athlete_id", "athletes", ["athlete_id"], ["id"], ondelete="CASCADE"
        )

    # role_requests.user_id → CASCADE, reviewed_by → SET NULL
    with op.batch_alter_table("role_requests", naming_convention=_naming) as batch_op:
        batch_op.drop_constraint("fk_role_requests_user_id_users", type_="foreignkey")
        batch_op.drop_constraint("fk_role_requests_reviewed_by_users", type_="foreignkey")
        batch_op.create_foreign_key("fk_role_requests_user_id", "users", ["user_id"], ["id"], ondelete="CASCADE")
        batch_op.create_foreign_key(
            "fk_role_requests_reviewed_by", "users", ["reviewed_by"], ["id"], ondelete="SET NULL"
        )

    # audit_logs.user_id → CASCADE
    # Note: audit_logs was created in migration 005 with unnamed FK via sa.ForeignKey("users.id")
    with op.batch_alter_table("audit_logs", naming_convention=_naming) as batch_op:
        batch_op.drop_constraint("fk_audit_logs_user_id_users", type_="foreignkey")
        batch_op.create_foreign_key("fk_audit_logs_user_id", "users", ["user_id"], ["id"], ondelete="CASCADE")

    # tournaments.created_by → CASCADE
    with op.batch_alter_table("tournaments", naming_convention=_naming) as batch_op:
        batch_op.drop_constraint("fk_tournaments_created_by_users", type_="foreignkey")
        batch_op.create_foreign_key("fk_tournaments_created_by", "users", ["created_by"], ["id"], ondelete="CASCADE")

    # ── Missing indexes (only those NOT already created in earlier migrations) ──
    op.create_index("ix_coach_athletes_coach_id", "coach_athletes", ["coach_id"])
    op.create_index("ix_coach_athletes_athlete_id", "coach_athletes", ["athlete_id"])
    op.create_index("ix_role_requests_user_id", "role_requests", ["user_id"])
    op.create_index("ix_role_requests_status", "role_requests", ["status"])
    # ix_audit_logs_user_id already created in migration 005 — skip
    op.create_index("ix_audit_logs_action", "audit_logs", ["action"])


def downgrade() -> None:
    # Drop indexes (only those created in THIS migration)
    op.drop_index("ix_audit_logs_action", table_name="audit_logs")
    op.drop_index("ix_role_requests_status", table_name="role_requests")
    op.drop_index("ix_role_requests_user_id", table_name="role_requests")
    op.drop_index("ix_coach_athletes_athlete_id", table_name="coach_athletes")
    op.drop_index("ix_coach_athletes_coach_id", table_name="coach_athletes")

    # Revert FKs to no-cascade (reverse order)
    with op.batch_alter_table("tournaments", naming_convention=_naming) as batch_op:
        batch_op.drop_constraint("fk_tournaments_created_by", type_="foreignkey")
        batch_op.create_foreign_key(None, "users", ["created_by"], ["id"])

    with op.batch_alter_table("audit_logs", naming_convention=_naming) as batch_op:
        batch_op.drop_constraint("fk_audit_logs_user_id", type_="foreignkey")
        batch_op.create_foreign_key(None, "users", ["user_id"], ["id"])

    with op.batch_alter_table("role_requests", naming_convention=_naming) as batch_op:
        batch_op.drop_constraint("fk_role_requests_reviewed_by", type_="foreignkey")
        batch_op.drop_constraint("fk_role_requests_user_id", type_="foreignkey")
        batch_op.create_foreign_key(None, "users", ["reviewed_by"], ["id"])
        batch_op.create_foreign_key(None, "users", ["user_id"], ["id"])

    with op.batch_alter_table("coach_athletes", naming_convention=_naming) as batch_op:
        batch_op.drop_constraint("fk_coach_athletes_athlete_id", type_="foreignkey")
        batch_op.drop_constraint("fk_coach_athletes_coach_id", type_="foreignkey")
        batch_op.create_foreign_key(None, "athletes", ["athlete_id"], ["id"])
        batch_op.create_foreign_key(None, "coaches", ["coach_id"], ["id"])

    with op.batch_alter_table("training_log", naming_convention=_naming) as batch_op:
        batch_op.drop_constraint("fk_training_log_athlete_id", type_="foreignkey")
        batch_op.create_foreign_key(None, "athletes", ["athlete_id"], ["id"])

    with op.batch_alter_table("coaches", naming_convention=_naming) as batch_op:
        batch_op.drop_constraint("fk_coaches_user_id", type_="foreignkey")
        batch_op.create_foreign_key(None, "users", ["user_id"], ["id"])

    with op.batch_alter_table("athletes", naming_convention=_naming) as batch_op:
        batch_op.drop_constraint("fk_athletes_user_id", type_="foreignkey")
        batch_op.create_foreign_key(None, "users", ["user_id"], ["id"])
