import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import distinct, func, or_, select
from sqlalchemy.orm import selectinload

from api.dependencies import AuthContext, get_current_user
from api.routes.me import _resolve_role
from api.schemas.athlete import AthleteRead
from api.schemas.coach import CoachRead
from bot.config import settings
from db.models.athlete import Athlete
from db.models.coach import Coach
from db.models.tournament import TournamentEntry, TournamentResult
from db.models.user import User

router = APIRouter()


class UserSearchItem(BaseModel):
    id: str
    full_name: Optional[str] = None
    role: str
    city: Optional[str] = None
    club: Optional[str] = None


class UserDetailResponse(BaseModel):
    id: str
    telegram_id: int
    username: Optional[str] = None
    role: str
    is_admin: bool = False
    athlete: Optional[AthleteRead] = None
    coach: Optional[CoachRead] = None
    created_at: str
    stats: dict


@router.get("/users/search", response_model=list[UserSearchItem])
async def search_users(
    q: Optional[str] = None,
    ctx: AuthContext = Depends(get_current_user),
):
    stmt = (
        select(User)
        .options(selectinload(User.athlete), selectinload(User.coach))
        .order_by(User.created_at.desc())
        .limit(50)
    )

    if q:
        pattern = f"%{q}%"
        stmt = stmt.where(
            or_(
                User.athlete.has(Athlete.full_name.ilike(pattern)),
                User.coach.has(Coach.full_name.ilike(pattern)),
            )
        )

    result = await ctx.session.execute(stmt)
    users = result.scalars().all()

    items = []
    for u in users:
        role = _resolve_role(u)
        full_name = None
        city = None
        club = None
        if u.athlete:
            full_name = u.athlete.full_name
            city = u.athlete.city
            club = u.athlete.club
        elif u.coach:
            full_name = u.coach.full_name
            city = u.coach.city
            club = u.coach.club
        items.append(
            UserSearchItem(
                id=str(u.id),
                full_name=full_name,
                role=role,
                city=city,
                club=club,
            )
        )

    return items


@router.get("/users/{user_id}", response_model=UserDetailResponse)
async def get_user_detail(
    user_id: str,
    ctx: AuthContext = Depends(get_current_user),
):
    try:
        uid = uuid.UUID(user_id)
    except ValueError as err:
        raise HTTPException(status_code=400, detail="Invalid user ID") from err

    result = await ctx.session.execute(
        select(User).where(User.id == uid).options(selectinload(User.athlete), selectinload(User.coach))
    )
    target = result.scalar_one_or_none()
    if not target:
        raise HTTPException(status_code=404, detail="User not found")

    role = _resolve_role(target)
    athlete_data = AthleteRead.model_validate(target.athlete) if target.athlete else None
    coach_data = CoachRead.model_validate(target.coach) if target.coach else None

    # Stats
    tournaments_count = 0
    medals_count = 0
    if target.athlete:
        t_count = await ctx.session.execute(
            select(func.count(distinct(TournamentEntry.tournament_id))).where(
                TournamentEntry.athlete_id == target.athlete.id,
                TournamentEntry.status == "approved",
            )
        )
        tournaments_count = t_count.scalar_one()

        m_count = await ctx.session.execute(
            select(func.count(TournamentResult.id)).where(
                TournamentResult.athlete_id == target.athlete.id,
                TournamentResult.place <= 3,
            )
        )
        medals_count = m_count.scalar_one()

    return UserDetailResponse(
        id=str(target.id),
        telegram_id=target.telegram_id,
        username=target.username,
        role=role,
        is_admin=target.telegram_id in settings.admin_ids,
        athlete=athlete_data,
        coach=coach_data,
        created_at=str(target.created_at),
        stats={"tournaments_count": tournaments_count, "medals_count": medals_count},
    )
