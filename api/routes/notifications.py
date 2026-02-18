import uuid

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import delete, func, or_, select, update

from api.dependencies import AuthContext, get_current_user
from api.routes.me import _resolve_role
from db.models.notification import Notification

router = APIRouter()


def _role_filter(user):
    """Filter: show notifications where role matches user's active role OR role is NULL."""
    role = _resolve_role(user)
    return or_(Notification.role == None, Notification.role == role)  # noqa: E711


class NotificationOut(BaseModel):
    id: str
    type: str
    title: str
    body: str
    ref_id: str | None = None
    read: bool
    created_at: str


class UnreadCountResponse(BaseModel):
    count: int


@router.get("/notifications", response_model=list[NotificationOut])
async def get_notifications(
    page: int = 1,
    limit: int = 20,
    ctx: AuthContext = Depends(get_current_user),
):
    offset = (max(page, 1) - 1) * limit
    result = await ctx.session.execute(
        select(Notification)
        .where(
            Notification.user_id == ctx.user.id,
            _role_filter(ctx.user),
        )
        .order_by(Notification.created_at.desc())
        .offset(offset)
        .limit(min(limit, 50))
    )
    items = result.scalars().all()
    return [
        NotificationOut(
            id=str(n.id),
            type=n.type,
            title=n.title,
            body=n.body,
            ref_id=n.ref_id,
            read=n.read,
            created_at=str(n.created_at),
        )
        for n in items
    ]


@router.get("/notifications/unread-count", response_model=UnreadCountResponse)
async def get_unread_count(
    ctx: AuthContext = Depends(get_current_user),
):
    result = await ctx.session.execute(
        select(func.count(Notification.id)).where(
            Notification.user_id == ctx.user.id,
            Notification.read == False,  # noqa: E712
            _role_filter(ctx.user),
        )
    )
    count = result.scalar_one()
    return UnreadCountResponse(count=count)


@router.post("/notifications/read")
async def mark_all_read(
    ctx: AuthContext = Depends(get_current_user),
):
    role = _resolve_role(ctx.user)
    await ctx.session.execute(
        update(Notification)
        .where(
            Notification.user_id == ctx.user.id,
            Notification.read == False,  # noqa: E712
            or_(Notification.role == None, Notification.role == role),  # noqa: E711
        )
        .values(read=True)
    )
    await ctx.session.commit()
    return {"status": "ok"}


@router.delete("/notifications/{notification_id}")
async def delete_notification(
    notification_id: str,
    ctx: AuthContext = Depends(get_current_user),
):
    try:
        nid = uuid.UUID(notification_id)
    except ValueError as err:
        raise HTTPException(status_code=400, detail="Invalid notification ID") from err

    result = await ctx.session.execute(
        delete(Notification).where(
            Notification.id == nid,
            Notification.user_id == ctx.user.id,
        )
    )
    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="Notification not found")
    await ctx.session.commit()
    return {"status": "deleted"}
