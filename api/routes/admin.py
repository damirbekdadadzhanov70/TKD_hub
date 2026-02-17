import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import or_, select
from sqlalchemy.orm import selectinload

from api.dependencies import AuthContext, get_current_user
from api.routes.me import AthleteRegistration, CoachRegistration, _resolve_role
from bot.config import settings
from bot.utils.notifications import (
    notify_admins_account_deleted_by_admin,
    notify_user_account_deleted,
)
from db.models.athlete import Athlete
from db.models.coach import Coach
from db.models.role_request import RoleRequest
from db.models.user import User

router = APIRouter()


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

    if role_request.requested_role == "athlete":
        if target_user.athlete:
            raise HTTPException(status_code=400, detail="User already has athlete profile")
        if role_request.data:
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
        else:
            raise HTTPException(status_code=400, detail="No profile data in request")
        ctx.session.add(athlete)

    elif role_request.requested_role == "coach":
        if target_user.coach:
            raise HTTPException(status_code=400, detail="User already has coach profile")
        if role_request.data:
            reg = CoachRegistration(**role_request.data)
            coach = Coach(
                user_id=target_user.id,
                full_name=reg.full_name,
                date_of_birth=reg.date_of_birth,
                gender=reg.gender,
                country="Россия",
                city=reg.city,
                club=reg.club,
                qualification=reg.sport_rank,
            )
        else:
            raise HTTPException(status_code=400, detail="No profile data in request")
        ctx.session.add(coach)

    role_request.status = "approved"
    role_request.reviewed_at = datetime.now(timezone.utc)
    role_request.reviewed_by = ctx.user.id
    ctx.session.add(role_request)
    await ctx.session.commit()

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

    result = await ctx.session.execute(select(RoleRequest).where(RoleRequest.id == rid))
    role_request = result.scalar_one_or_none()
    if not role_request:
        raise HTTPException(status_code=404, detail="Role request not found")
    if role_request.status != "pending":
        raise HTTPException(status_code=400, detail="Request already processed")

    role_request.status = "rejected"
    role_request.reviewed_at = datetime.now(timezone.utc)
    role_request.reviewed_by = ctx.user.id
    ctx.session.add(role_request)
    await ctx.session.commit()

    return {"status": "rejected"}


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


@router.delete("/admin/users/{user_id}")
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
        from aiogram import Bot

        bot = Bot(token=settings.BOT_TOKEN)
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
        import logging

        logging.getLogger(__name__).warning("Failed to send notification for admin account deletion")

    await ctx.session.delete(target)
    await ctx.session.commit()

    return {"status": "deleted"}
