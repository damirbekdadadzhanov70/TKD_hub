"""Initial schema — squashed from 13 migrations.

Revision ID: 001_initial
Revises:
Create Date: 2026-02-18

Creates all 13 tables matching current SQLAlchemy models.
"""

from alembic import op
import sqlalchemy as sa

revision = "001_initial"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # --- users ---
    op.create_table(
        "users",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("telegram_id", sa.BigInteger(), nullable=False, unique=True),
        sa.Column("username", sa.String(255), nullable=True),
        sa.Column("language", sa.String(2), nullable=False, server_default="ru"),
        sa.Column("active_role", sa.String(20), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )

    # --- athletes ---
    op.create_table(
        "athletes",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("user_id", sa.Uuid(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True),
        sa.Column("full_name", sa.String(255), nullable=False),
        sa.Column("date_of_birth", sa.Date(), nullable=False),
        sa.Column("gender", sa.String(1), nullable=False),
        sa.Column("weight_category", sa.String(50), nullable=False),
        sa.Column("current_weight", sa.Numeric(5, 2), nullable=False),
        sa.Column("sport_rank", sa.String(50), nullable=False),
        sa.Column("country", sa.String(100), nullable=False),
        sa.Column("city", sa.String(100), nullable=False),
        sa.Column("club", sa.String(255), nullable=True),
        sa.Column("photo_url", sa.String(500), nullable=True),
        sa.Column("rating_points", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )

    # --- coaches ---
    op.create_table(
        "coaches",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("user_id", sa.Uuid(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True),
        sa.Column("full_name", sa.String(255), nullable=False),
        sa.Column("date_of_birth", sa.Date(), nullable=False),
        sa.Column("gender", sa.String(1), nullable=False),
        sa.Column("country", sa.String(100), nullable=False),
        sa.Column("city", sa.String(100), nullable=False),
        sa.Column("club", sa.String(255), nullable=False),
        sa.Column("qualification", sa.String(255), nullable=False),
        sa.Column("photo_url", sa.String(500), nullable=True),
        sa.Column("is_verified", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )

    # --- coach_athletes ---
    op.create_table(
        "coach_athletes",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("coach_id", sa.Uuid(), sa.ForeignKey("coaches.id", ondelete="CASCADE"), nullable=False),
        sa.Column("athlete_id", sa.Uuid(), sa.ForeignKey("athletes.id", ondelete="CASCADE"), nullable=False),
        sa.Column("status", sa.String(20), nullable=False, server_default="pending"),
        sa.Column("invited_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("accepted_at", sa.DateTime(), nullable=True),
        sa.UniqueConstraint("coach_id", "athlete_id"),
    )

    # --- tournaments ---
    op.create_table(
        "tournaments",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("start_date", sa.Date(), nullable=False),
        sa.Column("end_date", sa.Date(), nullable=False),
        sa.Column("city", sa.String(100), nullable=False),
        sa.Column("country", sa.String(100), nullable=False),
        sa.Column("venue", sa.String(255), nullable=False),
        sa.Column("age_categories", sa.JSON(), nullable=True),
        sa.Column("weight_categories", sa.JSON(), nullable=True),
        sa.Column("entry_fee", sa.Numeric(10, 2), nullable=True),
        sa.Column("currency", sa.String(3), nullable=False, server_default="USD"),
        sa.Column("registration_deadline", sa.Date(), nullable=False),
        sa.Column("organizer_contact", sa.String(255), nullable=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="upcoming"),
        sa.Column("importance_level", sa.Integer(), nullable=False, server_default=sa.text("1")),
        sa.Column("created_by", sa.Uuid(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )

    # --- tournament_entries ---
    op.create_table(
        "tournament_entries",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("tournament_id", sa.Uuid(), sa.ForeignKey("tournaments.id", ondelete="CASCADE"), nullable=False),
        sa.Column("athlete_id", sa.Uuid(), sa.ForeignKey("athletes.id", ondelete="CASCADE"), nullable=False),
        sa.Column("coach_id", sa.Uuid(), sa.ForeignKey("coaches.id", ondelete="CASCADE"), nullable=False),
        sa.Column("weight_category", sa.String(50), nullable=False),
        sa.Column("age_category", sa.String(50), nullable=False),
        sa.Column("status", sa.String(20), nullable=False, server_default="pending"),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint("tournament_id", "athlete_id"),
    )

    # --- tournament_results ---
    op.create_table(
        "tournament_results",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("tournament_id", sa.Uuid(), sa.ForeignKey("tournaments.id", ondelete="CASCADE"), nullable=False),
        sa.Column("athlete_id", sa.Uuid(), sa.ForeignKey("athletes.id", ondelete="CASCADE"), nullable=False),
        sa.Column("weight_category", sa.String(50), nullable=False),
        sa.Column("age_category", sa.String(50), nullable=False),
        sa.Column("place", sa.Integer(), nullable=False),
        sa.Column("rating_points_earned", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint("tournament_id", "athlete_id", "weight_category", "age_category"),
    )

    # --- tournament_interests ---
    op.create_table(
        "tournament_interests",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("tournament_id", sa.Uuid(), sa.ForeignKey("tournaments.id", ondelete="CASCADE"), nullable=False),
        sa.Column("athlete_id", sa.Uuid(), sa.ForeignKey("athletes.id", ondelete="CASCADE"), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint("tournament_id", "athlete_id"),
    )

    # --- training_log ---
    op.create_table(
        "training_log",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("athlete_id", sa.Uuid(), sa.ForeignKey("athletes.id", ondelete="CASCADE"), nullable=False),
        sa.Column("date", sa.Date(), nullable=False),
        sa.Column("type", sa.String(50), nullable=False),
        sa.Column("duration_minutes", sa.Integer(), nullable=False),
        sa.Column("intensity", sa.String(20), nullable=False),
        sa.Column("weight", sa.Numeric(5, 2), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("coach_comment", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )

    # --- invite_tokens ---
    op.create_table(
        "invite_tokens",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("token", sa.String(24), nullable=False, unique=True),
        sa.Column("coach_id", sa.Uuid(), sa.ForeignKey("coaches.id", ondelete="CASCADE"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("used", sa.Boolean(), nullable=False, server_default=sa.text("false")),
    )
    op.create_index("ix_invite_tokens_token", "invite_tokens", ["token"])

    # --- notifications ---
    op.create_table(
        "notifications",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("user_id", sa.Uuid(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("type", sa.String(50), nullable=False),
        sa.Column("role", sa.String(20), nullable=True),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("ref_id", sa.String(36), nullable=True),
        sa.Column("read", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_notifications_user_id", "notifications", ["user_id"])
    op.create_index("ix_notifications_role", "notifications", ["role"])

    # --- role_requests ---
    op.create_table(
        "role_requests",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("user_id", sa.Uuid(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("requested_role", sa.String(20), nullable=False),
        sa.Column("status", sa.String(20), nullable=False, server_default="pending"),
        sa.Column("data", sa.JSON(), nullable=True),
        sa.Column("admin_comment", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("reviewed_at", sa.DateTime(), nullable=True),
        sa.Column("reviewed_by", sa.Uuid(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
    )
    op.create_index("ix_role_requests_user_id", "role_requests", ["user_id"])

    # --- audit_logs ---
    op.create_table(
        "audit_logs",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("user_id", sa.Uuid(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("action", sa.String(100), nullable=False),
        sa.Column("target_type", sa.String(50), nullable=False),
        sa.Column("target_id", sa.Text(), nullable=True),
        sa.Column("details", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_audit_logs_user_id", "audit_logs", ["user_id"])
    op.create_index("ix_audit_logs_action", "audit_logs", ["action"])

    # --- Performance indexes (from old migration 002) ---
    op.create_index("ix_coach_athletes_coach_id", "coach_athletes", ["coach_id"])
    op.create_index("ix_coach_athletes_athlete_id", "coach_athletes", ["athlete_id"])
    op.create_index("ix_coach_athletes_status", "coach_athletes", ["status"])
    op.create_index("ix_tournament_entries_tournament_id", "tournament_entries", ["tournament_id"])
    op.create_index("ix_tournament_entries_athlete_id", "tournament_entries", ["athlete_id"])
    op.create_index("ix_tournament_results_tournament_id", "tournament_results", ["tournament_id"])
    op.create_index("ix_tournament_results_athlete_id", "tournament_results", ["athlete_id"])
    op.create_index("ix_training_log_athlete_id", "training_log", ["athlete_id"])
    op.create_index("ix_training_log_date", "training_log", ["date"])


def downgrade() -> None:
    op.drop_table("audit_logs")
    op.drop_table("role_requests")
    op.drop_table("notifications")
    op.drop_table("invite_tokens")
    op.drop_table("training_log")
    op.drop_table("tournament_interests")
    op.drop_table("tournament_results")
    op.drop_table("tournament_entries")
    op.drop_table("tournaments")
    op.drop_table("coach_athletes")
    op.drop_table("coaches")
    op.drop_table("athletes")
    op.drop_table("users")
