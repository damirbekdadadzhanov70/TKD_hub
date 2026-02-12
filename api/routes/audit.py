from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select

from api.dependencies import AuthContext, get_current_user
from api.schemas.audit import AuditLogRead
from api.schemas.pagination import PaginatedResponse
from api.utils.pagination import paginate_query
from bot.config import settings
from db.models.audit_log import AuditLog

router = APIRouter()


@router.get("/admin/audit-logs", response_model=PaginatedResponse[AuditLogRead])
async def list_audit_logs(
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=100),
    ctx: AuthContext = Depends(get_current_user),
):
    if ctx.user.telegram_id not in settings.admin_ids:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required",
        )

    query = select(AuditLog).order_by(AuditLog.created_at.desc())
    logs, total = await paginate_query(ctx.session, query, page, limit)

    items = [AuditLogRead.model_validate(log) for log in logs]
    return PaginatedResponse(
        items=items,
        total=total,
        page=page,
        limit=limit,
        has_next=(page * limit) < total,
    )
