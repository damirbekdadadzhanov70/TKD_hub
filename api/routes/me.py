from datetime import date
from decimal import Decimal
from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select

from api.dependencies import AuthContext, get_current_user
from api.schemas.athlete import AthleteRead, AthleteUpdate
from api.schemas.coach import CoachRead, CoachUpdate
from api.schemas.user import MeResponse
from bot.config import settings
from db.models.athlete import Athlete
from db.models.coach import Coach
from db.models.role_request import RoleRequest

router = APIRouter()


def _resolve_role(user) -> str:
    """Determine user role: admin > coach > athlete > none."""
    if user.telegram_id in settings.admin_ids:
        return "admin"
    if user.coach:
        return "coach"
    if user.athlete:
        return "athlete"
    return "none"


def _build_me_response(user) -> MeResponse:
    """Build MeResponse with correct role detection."""
    role = _resolve_role(user)
    athlete_data = AthleteRead.model_validate(user.athlete) if user.athlete else None
    coach_data = CoachRead.model_validate(user.coach) if user.coach else None

    return MeResponse(
        telegram_id=user.telegram_id,
        username=user.username,
        language=user.language,
        role=role,
        athlete=athlete_data,
        coach=coach_data,
    )


@router.get("/me", response_model=MeResponse)
async def get_me(ctx: AuthContext = Depends(get_current_user)):
    return _build_me_response(ctx.user)


@router.put("/me", response_model=MeResponse)
async def update_me(
    update: AthleteUpdate,
    ctx: AuthContext = Depends(get_current_user),
):
    user = ctx.user
    if not user.athlete:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No athlete profile to update",
        )

    athlete = user.athlete
    update_data = update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(athlete, field, value)

    # Name sync: athlete → coach
    if "full_name" in update_data and user.coach:
        user.coach.full_name = update_data["full_name"]
        ctx.session.add(user.coach)

    ctx.session.add(athlete)
    await ctx.session.commit()
    await ctx.session.refresh(athlete)
    if user.coach:
        await ctx.session.refresh(user.coach)

    return _build_me_response(user)


@router.put("/me/coach", response_model=MeResponse)
async def update_coach(
    update: CoachUpdate,
    ctx: AuthContext = Depends(get_current_user),
):
    user = ctx.user
    if not user.coach:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No coach profile to update",
        )

    coach = user.coach
    update_data = update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(coach, field, value)

    # Name sync: coach → athlete
    if "full_name" in update_data and user.athlete:
        user.athlete.full_name = update_data["full_name"]
        ctx.session.add(user.athlete)

    ctx.session.add(coach)
    await ctx.session.commit()
    await ctx.session.refresh(coach)
    if user.athlete:
        await ctx.session.refresh(user.athlete)

    return _build_me_response(user)


# ── Registration ─────────────────────────────────────────────


class AthleteRegistration(BaseModel):
    full_name: str = Field(..., min_length=2, max_length=255)
    date_of_birth: date
    gender: Literal["M", "F"]
    weight_category: str = Field(..., min_length=1, max_length=50)
    current_weight: Decimal = Field(..., gt=0, le=300)
    sport_rank: str = Field(..., min_length=1, max_length=50)
    city: str = Field(..., min_length=1, max_length=100)
    club: Optional[str] = Field(None, max_length=255)


class CoachRegistration(BaseModel):
    full_name: str = Field(..., min_length=2, max_length=255)
    date_of_birth: date
    gender: Literal["M", "F"]
    sport_rank: str = Field(..., min_length=1, max_length=50)
    city: str = Field(..., min_length=1, max_length=100)
    club: str = Field(..., min_length=1, max_length=255)


class RegisterPayload(BaseModel):
    role: Literal["athlete", "coach"]
    data: dict


@router.post("/me/register", response_model=MeResponse)
async def register_profile(
    payload: RegisterPayload,
    ctx: AuthContext = Depends(get_current_user),
):
    user = ctx.user

    if payload.role == "athlete":
        if user.athlete:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Athlete profile already exists",
            )
        reg = AthleteRegistration(**payload.data)
        athlete = Athlete(
            user_id=user.id,
            full_name=reg.full_name,
            date_of_birth=reg.date_of_birth,
            gender=reg.gender,
            weight_category=reg.weight_category,
            current_weight=reg.current_weight,
            sport_rank=reg.sport_rank,
            country="Россия",
            city=reg.city,
            club=reg.club,
        )
        ctx.session.add(athlete)
        await ctx.session.flush()
        await ctx.session.refresh(user, ["athlete", "coach"])

    elif payload.role == "coach":
        if user.coach:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Coach profile already exists",
            )
        reg = CoachRegistration(**payload.data)
        coach = Coach(
            user_id=user.id,
            full_name=reg.full_name,
            date_of_birth=reg.date_of_birth,
            gender=reg.gender,
            country="Россия",
            city=reg.city,
            club=reg.club,
            qualification=reg.sport_rank,
        )
        ctx.session.add(coach)
        await ctx.session.flush()
        await ctx.session.refresh(user, ["athlete", "coach"])

    await ctx.session.commit()
    return _build_me_response(user)


# ── Role change request ──────────────────────────────────────


class RoleRequestPayload(BaseModel):
    requested_role: Literal["athlete", "coach"]
    data: dict


class RoleRequestResponse(BaseModel):
    id: str
    requested_role: str
    status: str


@router.post("/me/role-request", response_model=RoleRequestResponse)
async def request_role_change(
    payload: RoleRequestPayload,
    ctx: AuthContext = Depends(get_current_user),
):
    user = ctx.user

    # Check if user already has this role
    if payload.requested_role == "athlete" and user.athlete:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You already have an athlete profile",
        )
    if payload.requested_role == "coach" and user.coach:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You already have a coach profile",
        )

    # Check for existing pending request
    existing = await ctx.session.execute(
        select(RoleRequest).where(
            RoleRequest.user_id == user.id,
            RoleRequest.status == "pending",
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You already have a pending role request",
        )

    role_request = RoleRequest(
        user_id=user.id,
        requested_role=payload.requested_role,
    )
    ctx.session.add(role_request)
    await ctx.session.commit()
    await ctx.session.refresh(role_request)

    return RoleRequestResponse(
        id=str(role_request.id),
        requested_role=role_request.requested_role,
        status=role_request.status,
    )
