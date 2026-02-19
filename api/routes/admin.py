import logging
import uuid
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import distinct, func, or_, select
from sqlalchemy.orm import selectinload

from api.dependencies import AuthContext, get_current_user
from api.routes.me import AthleteRegistration, CoachRegistration, _resolve_role
from api.schemas.athlete import AthleteRead
from api.schemas.coach import CoachRead
from bot.config import settings
from bot.utils.notifications import (
    create_notification,
    notify_admins_account_deleted_by_admin,
    notify_user_account_deleted,
    notify_user_role_approved,
    notify_user_role_rejected,
)
from db.models.athlete import Athlete
from db.models.coach import Coach
from db.models.role_request import RoleRequest
from db.models.tournament import TournamentEntry, TournamentResult
from db.models.user import User

router = APIRouter()
logger = logging.getLogger(__name__)


def _require_admin(user: User) -> None:
    if user.telegram_id not in settings.admin_ids:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required",
        )


class RoleRequestItem(BaseModel):
    id: str
    user_id: str
    username: Optional[str] = None
    requested_role: str
    status: str
    data: Optional[dict] = None
    created_at: str


@router.get("/admin/role-requests", response_model=list[RoleRequestItem])
async def list_role_requests(ctx: AuthContext = Depends(get_current_user)):
    _require_admin(ctx.user)

    result = await ctx.session.execute(
        select(RoleRequest)
        .where(RoleRequest.status == "pending")
        .options(selectinload(RoleRequest.user))
        .order_by(RoleRequest.created_at.desc())
    )
    requests = result.scalars().all()

    return [
        RoleRequestItem(
            id=str(r.id),
            user_id=str(r.user_id),
            username=r.user.username if r.user else None,
            requested_role=r.requested_role,
            status=r.status,
            data=r.data,
            created_at=str(r.created_at),
        )
        for r in requests
    ]


@router.post("/admin/role-requests/{request_id}/approve")
async def approve_role_request(
    request_id: str,
    ctx: AuthContext = Depends(get_current_user),
):
    _require_admin(ctx.user)

    try:
        rid = uuid.UUID(request_id)
    except ValueError as err:
        raise HTTPException(status_code=400, detail="Invalid request ID") from err

    result = await ctx.session.execute(
        select(RoleRequest)
        .where(RoleRequest.id == rid)
        .options(selectinload(RoleRequest.user).selectinload(User.athlete))
        .options(selectinload(RoleRequest.user).selectinload(User.coach))
    )
    role_request = result.scalar_one_or_none()
    if not role_request:
        raise HTTPException(status_code=404, detail="Role request not found")
    if role_request.status != "pending":
        raise HTTPException(status_code=400, detail="Request already processed")

    target_user = role_request.user
    logger.info(
        "Approving role request %s: role=%s, data=%s",
        request_id,
        role_request.requested_role,
        role_request.data,
    )

    try:
        if role_request.requested_role == "athlete":
            if target_user.athlete:
                raise HTTPException(status_code=400, detail="User already has athlete profile")
            if not role_request.data:
                raise HTTPException(status_code=400, detail="No profile data in request")
            reg = AthleteRegistration(**role_request.data)
            athlete = Athlete(
                user_id=target_user.id,
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

        elif role_request.requested_role == "coach":
            if target_user.coach:
                raise HTTPException(status_code=400, detail="User already has coach profile")
            if not role_request.data:
                raise HTTPException(status_code=400, detail="No profile data in request")
            reg = CoachRegistration(**role_request.data)
            coach = Coach(
                user_id=target_user.id,
                full_name=reg.full_name,
                date_of_birth=reg.date_of_birth,
                gender=reg.gender,
                country="Россия",
                city=reg.city,
                club=reg.club,
                qualification=reg.sport_rank or "Не указано",
            )
            ctx.session.add(coach)

        else:
            raise HTTPException(
                status_code=400,
                detail=f"Unknown role: {role_request.requested_role}",
            )
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Failed to create profile from role request %s", request_id)
        raise HTTPException(
            status_code=400,
            detail=f"Invalid profile data: {exc}",
        ) from exc

    role_request.status = "approved"
    role_request.reviewed_at = datetime.utcnow()
    role_request.reviewed_by = ctx.user.id
    ctx.session.add(role_request)

    # In-app notification for user
    role_label = {"athlete": "спортсмен", "coach": "тренер"}.get(
        role_request.requested_role, role_request.requested_role
    )
    await create_notification(
        ctx.session,
        user_id=target_user.id,
        type="role_approved",
        title="Роль одобрена",
        body=f"Ваша заявка на роль {role_label} одобрена!",
    )

    await ctx.session.commit()

    # Notify user via Telegram bot
    try:
        from api.utils import create_bot

        bot = create_bot()
        try:
            await notify_user_role_approved(
                bot,
                telegram_id=target_user.telegram_id,
                role=role_request.requested_role,
                lang=target_user.language or "ru",
            )
        finally:
            await bot.session.close()
    except Exception:
        logger.exception("Failed to send role approval notification to user %s", target_user.telegram_id)

    return {"status": "approved"}


@router.post("/admin/role-requests/{request_id}/reject")
async def reject_role_request(
    request_id: str,
    ctx: AuthContext = Depends(get_current_user),
):
    _require_admin(ctx.user)

    try:
        rid = uuid.UUID(request_id)
    except ValueError as err:
        raise HTTPException(status_code=400, detail="Invalid request ID") from err

    result = await ctx.session.execute(
        select(RoleRequest).where(RoleRequest.id == rid).options(selectinload(RoleRequest.user))
    )
    role_request = result.scalar_one_or_none()
    if not role_request:
        raise HTTPException(status_code=404, detail="Role request not found")
    if role_request.status != "pending":
        raise HTTPException(status_code=400, detail="Request already processed")

    target_user = role_request.user

    role_request.status = "rejected"
    role_request.reviewed_at = datetime.utcnow()
    role_request.reviewed_by = ctx.user.id
    ctx.session.add(role_request)

    # In-app notification for user
    if target_user:
        role_label = {"athlete": "спортсмен", "coach": "тренер"}.get(
            role_request.requested_role, role_request.requested_role
        )
        await create_notification(
            ctx.session,
            user_id=target_user.id,
            type="role_rejected",
            title="Роль отклонена",
            body=f"Ваша заявка на роль {role_label} отклонена.",
        )

    await ctx.session.commit()

    # Notify user via Telegram bot
    if target_user:
        try:
            from api.utils import create_bot

            bot = create_bot()
            try:
                await notify_user_role_rejected(
                    bot,
                    telegram_id=target_user.telegram_id,
                    role=role_request.requested_role,
                    lang=target_user.language or "ru",
                )
            finally:
                await bot.session.close()
        except Exception:
            logger.exception("Failed to send role rejection notification to user %s", target_user.telegram_id)

    return {"status": "rejected"}


# ── Admin user detail ────────────────────────────────────────


class AdminUserDetailResponse(BaseModel):
    id: str
    telegram_id: int
    username: Optional[str] = None
    role: str
    is_admin: bool = False
    athlete: Optional[AthleteRead] = None
    coach: Optional[CoachRead] = None
    created_at: str
    stats: dict


@router.get("/admin/users/{user_id}", response_model=AdminUserDetailResponse)
async def get_user_detail(
    user_id: str,
    ctx: AuthContext = Depends(get_current_user),
):
    _require_admin(ctx.user)

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

    return AdminUserDetailResponse(
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


# ── Admin user management ────────────────────────────────────


class AdminUserItem(BaseModel):
    id: str
    telegram_id: int
    username: Optional[str] = None
    role: str
    full_name: Optional[str] = None
    city: Optional[str] = None
    created_at: str


@router.get("/admin/users", response_model=list[AdminUserItem])
async def list_users(
    q: Optional[str] = None,
    ctx: AuthContext = Depends(get_current_user),
):
    _require_admin(ctx.user)

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
        if u.athlete:
            full_name = u.athlete.full_name
            city = u.athlete.city
        elif u.coach:
            full_name = u.coach.full_name
            city = u.coach.city
        items.append(
            AdminUserItem(
                id=str(u.id),
                telegram_id=u.telegram_id,
                username=u.username,
                role=role,
                full_name=full_name,
                city=city,
                created_at=str(u.created_at),
            )
        )

    return items


@router.delete("/admin/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(
    user_id: str,
    ctx: AuthContext = Depends(get_current_user),
):
    _require_admin(ctx.user)

    try:
        uid = uuid.UUID(user_id)
    except ValueError as err:
        raise HTTPException(status_code=400, detail="Invalid user ID") from err

    if uid == ctx.user.id:
        raise HTTPException(status_code=400, detail="Cannot delete yourself")

    result = await ctx.session.execute(
        select(User).where(User.id == uid).options(selectinload(User.athlete), selectinload(User.coach))
    )
    target = result.scalar_one_or_none()
    if not target:
        raise HTTPException(status_code=404, detail="User not found")

    full_name = (
        target.athlete.full_name
        if target.athlete
        else target.coach.full_name
        if target.coach
        else target.username or str(target.telegram_id)
    )
    telegram_id = target.telegram_id
    lang = target.language or "ru"

    # Notify admins and user about deletion
    try:
        from api.utils import create_bot

        bot = create_bot()
        try:
            await notify_admins_account_deleted_by_admin(
                bot,
                full_name=full_name,
                username=target.username or "",
                lang="ru",
            )
            await notify_user_account_deleted(bot, telegram_id, lang)
        finally:
            await bot.session.close()
    except Exception:
        logger.exception("Failed to send notification for admin account deletion")

    await ctx.session.delete(target)
    await ctx.session.commit()


# ── Delete single profile (athlete or coach) ────────────────


@router.delete("/admin/users/{user_id}/profile/{role}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user_profile(
    user_id: str,
    role: str,
    ctx: AuthContext = Depends(get_current_user),
):
    """Delete a single profile (athlete or coach) from a user, keeping the other."""
    _require_admin(ctx.user)

    if role not in ("athlete", "coach"):
        raise HTTPException(status_code=400, detail="Role must be 'athlete' or 'coach'")

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

    if role == "athlete":
        if not target.athlete:
            raise HTTPException(status_code=404, detail="User has no athlete profile")
        await ctx.session.delete(target.athlete)
        remaining = "coach" if target.coach else None
    else:
        if not target.coach:
            raise HTTPException(status_code=404, detail="User has no coach profile")
        await ctx.session.delete(target.coach)
        remaining = "athlete" if target.athlete else None

    # Reset active_role to remaining profile's role (or None)
    target.active_role = remaining
    ctx.session.add(target)
    await ctx.session.commit()


# ── Coach verification ──────────────────────────────────────


@router.post("/admin/coaches/{coach_id}/verify")
async def verify_coach(
    coach_id: str,
    ctx: AuthContext = Depends(get_current_user),
):
    _require_admin(ctx.user)

    try:
        cid = uuid.UUID(coach_id)
    except ValueError as err:
        raise HTTPException(status_code=400, detail="Invalid coach ID") from err

    result = await ctx.session.execute(select(Coach).where(Coach.id == cid).options(selectinload(Coach.user)))
    coach = result.scalar_one_or_none()
    if not coach:
        raise HTTPException(status_code=404, detail="Coach not found")
    if coach.is_verified:
        return {"status": "already_verified"}

    coach.is_verified = True
    ctx.session.add(coach)

    # Notify coach about verification
    if coach.user:
        await create_notification(
            ctx.session,
            user_id=coach.user.id,
            type="coach_verified",
            title="Верификация пройдена",
            body="Ваш профиль тренера верифицирован!",
            role="coach",
        )

    await ctx.session.commit()
    return {"status": "verified"}
