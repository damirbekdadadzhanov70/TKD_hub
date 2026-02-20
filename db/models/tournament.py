import uuid
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import JSON, Date, ForeignKey, Integer, Numeric, String, Text, UniqueConstraint, Uuid, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from db.base import Base


class Tournament(Base):
    __tablename__ = "tournaments"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    end_date: Mapped[date] = mapped_column(Date, nullable=False)
    city: Mapped[str] = mapped_column(String(100), nullable=False)
    country: Mapped[str] = mapped_column(String(100), nullable=False)
    venue: Mapped[str] = mapped_column(String(255), nullable=False)
    age_categories: Mapped[list] = mapped_column(JSON, default=list)
    weight_categories: Mapped[list] = mapped_column(JSON, default=list)
    entry_fee: Mapped[Decimal | None] = mapped_column(Numeric(10, 2))
    currency: Mapped[str] = mapped_column(String(3), default="USD")
    registration_deadline: Mapped[date] = mapped_column(Date, nullable=False)
    organizer_contact: Mapped[str | None] = mapped_column(String(255))
    photos_url: Mapped[str | None] = mapped_column(String(500))
    results_url: Mapped[str | None] = mapped_column(String(500))
    organizer_name: Mapped[str | None] = mapped_column(String(255))
    organizer_phone: Mapped[str | None] = mapped_column(String(50))
    organizer_telegram: Mapped[str | None] = mapped_column(String(100))
    status: Mapped[str] = mapped_column(String(20), default="upcoming")
    importance_level: Mapped[int] = mapped_column(Integer, default=1)
    created_by: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(server_default=func.now(), onupdate=func.now())

    creator: Mapped["User"] = relationship()
    entries: Mapped[list["TournamentEntry"]] = relationship(
        back_populates="tournament", cascade="all, delete-orphan", passive_deletes=True
    )
    results: Mapped[list["TournamentResult"]] = relationship(
        back_populates="tournament", cascade="all, delete-orphan", passive_deletes=True
    )
    interests: Mapped[list["TournamentInterest"]] = relationship(
        back_populates="tournament", cascade="all, delete-orphan", passive_deletes=True
    )
    files: Mapped[list["TournamentFile"]] = relationship(
        back_populates="tournament", cascade="all, delete-orphan", passive_deletes=True
    )


class TournamentEntry(Base):
    __tablename__ = "tournament_entries"
    __table_args__ = (UniqueConstraint("tournament_id", "athlete_id"),)

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    tournament_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("tournaments.id", ondelete="CASCADE"), nullable=False
    )
    athlete_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("athletes.id", ondelete="CASCADE"), nullable=False)
    coach_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("coaches.id", ondelete="CASCADE"), nullable=False)
    weight_category: Mapped[str] = mapped_column(String(50), nullable=False)
    age_category: Mapped[str] = mapped_column(String(50), nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="pending")
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(server_default=func.now(), onupdate=func.now())

    tournament: Mapped["Tournament"] = relationship(back_populates="entries")
    athlete: Mapped["Athlete"] = relationship()
    coach: Mapped["Coach"] = relationship()


class TournamentResult(Base):
    __tablename__ = "tournament_results"
    __table_args__ = (UniqueConstraint("tournament_id", "raw_full_name", "weight_category"),)

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    tournament_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("tournaments.id", ondelete="CASCADE"), nullable=False
    )
    athlete_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("athletes.id", ondelete="SET NULL"), nullable=True
    )
    weight_category: Mapped[str] = mapped_column(String(50), nullable=False)
    age_category: Mapped[str] = mapped_column(String(50), nullable=False)
    gender: Mapped[str | None] = mapped_column(String(10))
    place: Mapped[int] = mapped_column(Integer, nullable=False)
    rating_points_earned: Mapped[int] = mapped_column(Integer, default=0)
    raw_full_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    raw_weight_category: Mapped[str | None] = mapped_column(String(50), nullable=True)
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())

    tournament: Mapped["Tournament"] = relationship(back_populates="results")
    athlete: Mapped["Athlete | None"] = relationship()


class TournamentInterest(Base):
    __tablename__ = "tournament_interests"
    __table_args__ = (UniqueConstraint("tournament_id", "athlete_id"),)

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    tournament_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("tournaments.id", ondelete="CASCADE"), nullable=False
    )
    athlete_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("athletes.id", ondelete="CASCADE"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())

    tournament: Mapped["Tournament"] = relationship(back_populates="interests")
    athlete: Mapped["Athlete"] = relationship()


class TournamentFile(Base):
    __tablename__ = "tournament_files"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    tournament_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("tournaments.id", ondelete="CASCADE"), nullable=False
    )
    category: Mapped[str] = mapped_column(String(20), nullable=False, default="protocol")
    filename: Mapped[str] = mapped_column(String(255), nullable=False)
    blob_url: Mapped[str] = mapped_column(String(1000), nullable=False)
    file_size: Mapped[int] = mapped_column(Integer, nullable=False)
    file_type: Mapped[str] = mapped_column(String(50), nullable=False)
    uploaded_by: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())

    tournament: Mapped["Tournament"] = relationship(back_populates="files")
    uploader: Mapped["User"] = relationship()
