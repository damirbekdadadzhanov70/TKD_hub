"""initial schema

Revision ID: 47eb030a4bd7
Revises:
Create Date: 2026-02-12

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "47eb030a4bd7"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # users
    op.create_table(
        "users",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("telegram_id", sa.BigInteger(), nullable=False, unique=True),
        sa.Column("username", sa.String(255), nullable=True),
        sa.Column("language", sa.String(2), server_default="ru"),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now()),
    )

    # athletes
    op.create_table(
        "athletes",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("user_id", sa.Uuid(), sa.ForeignKey("users.id"), nullable=False, unique=True),
        sa.Column("full_name", sa.String(255), nullable=False),
        sa.Column("date_of_birth", sa.Date(), nullable=False),
        sa.Column("gender", sa.String(1), nullable=False),
        sa.Column("weight_category", sa.String(50), nullable=False),
        sa.Column("current_weight", sa.Numeric(5, 2), nullable=False),
        sa.Column("belt", sa.String(50), nullable=False),
        sa.Column("country", sa.String(100), nullable=False),
        sa.Column("city", sa.String(100), nullable=False),
        sa.Column("club", sa.String(255), nullable=True),
        sa.Column("photo_url", sa.String(500), nullable=True),
        sa.Column("rating_points", sa.Integer(), server_default="0"),
        sa.Column("is_active", sa.Boolean(), server_default=sa.text("1")),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now()),
    )

    # coaches
    op.create_table(
        "coaches",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("user_id", sa.Uuid(), sa.ForeignKey("users.id"), nullable=False, unique=True),
        sa.Column("full_name", sa.String(255), nullable=False),
        sa.Column("date_of_birth", sa.Date(), nullable=False),
        sa.Column("gender", sa.String(1), nullable=False),
        sa.Column("country", sa.String(100), nullable=False),
        sa.Column("city", sa.String(100), nullable=False),
        sa.Column("club", sa.String(255), nullable=False),
        sa.Column("qualification", sa.String(255), nullable=False),
        sa.Column("photo_url", sa.String(500), nullable=True),
        sa.Column("is_verified", sa.Boolean(), server_default=sa.text("0")),
        sa.Column("is_active", sa.Boolean(), server_default=sa.text("1")),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now()),
    )

    # coach_athletes
    op.create_table(
        "coach_athletes",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("coach_id", sa.Uuid(), sa.ForeignKey("coaches.id"), nullable=False),
        sa.Column("athlete_id", sa.Uuid(), sa.ForeignKey("athletes.id"), nullable=False),
        sa.Column("status", sa.String(20), server_default="pending"),
        sa.Column("invited_at", sa.DateTime(), server_default=sa.func.now()),
        sa.Column("accepted_at", sa.DateTime(), nullable=True),
        sa.UniqueConstraint("coach_id", "athlete_id"),
    )

    # tournaments
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
        sa.Column("age_categories", sa.JSON(), server_default="[]"),
        sa.Column("weight_categories", sa.JSON(), server_default="[]"),
        sa.Column("entry_fee", sa.Numeric(10, 2), nullable=True),
        sa.Column("currency", sa.String(3), server_default="USD"),
        sa.Column("registration_deadline", sa.Date(), nullable=False),
        sa.Column("organizer_contact", sa.String(255), nullable=True),
        sa.Column("status", sa.String(20), server_default="upcoming"),
        sa.Column("importance_level", sa.Integer(), server_default="1"),
        sa.Column("created_by", sa.Uuid(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now()),
    )

    # tournament_entries
    op.create_table(
        "tournament_entries",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("tournament_id", sa.Uuid(), sa.ForeignKey("tournaments.id"), nullable=False),
        sa.Column("athlete_id", sa.Uuid(), sa.ForeignKey("athletes.id"), nullable=False),
        sa.Column("coach_id", sa.Uuid(), sa.ForeignKey("coaches.id"), nullable=False),
        sa.Column("weight_category", sa.String(50), nullable=False),
        sa.Column("age_category", sa.String(50), nullable=False),
        sa.Column("status", sa.String(20), server_default="pending"),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now()),
        sa.UniqueConstraint("tournament_id", "athlete_id"),
    )

    # tournament_results
    op.create_table(
        "tournament_results",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("tournament_id", sa.Uuid(), sa.ForeignKey("tournaments.id"), nullable=False),
        sa.Column("athlete_id", sa.Uuid(), sa.ForeignKey("athletes.id"), nullable=False),
        sa.Column("weight_category", sa.String(50), nullable=False),
        sa.Column("age_category", sa.String(50), nullable=False),
        sa.Column("place", sa.Integer(), nullable=False),
        sa.Column("rating_points_earned", sa.Integer(), server_default="0"),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
    )

    # training_log
    op.create_table(
        "training_log",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("athlete_id", sa.Uuid(), sa.ForeignKey("athletes.id"), nullable=False),
        sa.Column("date", sa.Date(), nullable=False),
        sa.Column("type", sa.String(50), nullable=False),
        sa.Column("duration_minutes", sa.Integer(), nullable=False),
        sa.Column("intensity", sa.String(20), nullable=False),
        sa.Column("weight", sa.Numeric(5, 2), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("coach_comment", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now()),
    )

    # role_requests
    op.create_table(
        "role_requests",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("user_id", sa.Uuid(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("requested_role", sa.String(20), nullable=False),
        sa.Column("status", sa.String(20), server_default="pending"),
        sa.Column("admin_comment", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
        sa.Column("reviewed_at", sa.DateTime(), nullable=True),
        sa.Column("reviewed_by", sa.Uuid(), sa.ForeignKey("users.id"), nullable=True),
    )


def downgrade() -> None:
    op.drop_table("role_requests")
    op.drop_table("training_log")
    op.drop_table("tournament_results")
    op.drop_table("tournament_entries")
    op.drop_table("tournaments")
    op.drop_table("coach_athletes")
    op.drop_table("coaches")
    op.drop_table("athletes")
    op.drop_table("users")
