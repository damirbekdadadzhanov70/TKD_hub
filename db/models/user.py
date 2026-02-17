import uuid
from datetime import datetime

from sqlalchemy import BigInteger, String, Uuid, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from db.base import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    telegram_id: Mapped[int] = mapped_column(BigInteger, unique=True, nullable=False)
    username: Mapped[str | None] = mapped_column(String(255))
    language: Mapped[str] = mapped_column(String(2), default="ru")
    active_role: Mapped[str | None] = mapped_column(String(20))
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(server_default=func.now(), onupdate=func.now())

    athlete: Mapped["Athlete"] = relationship(back_populates="user", uselist=False)
    coach: Mapped["Coach"] = relationship(back_populates="user", uselist=False)
    role_requests: Mapped[list["RoleRequest"]] = relationship(back_populates="user", foreign_keys="RoleRequest.user_id")
