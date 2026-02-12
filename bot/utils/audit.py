import logging

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from db.models.audit_log import AuditLog
from db.models.user import User

logger = logging.getLogger(__name__)


async def write_audit_log(
    session: AsyncSession,
    telegram_id: int,
    action: str,
    target_type: str,
    target_id: str | None = None,
    details: dict | None = None,
) -> None:
    """Write an audit log entry for an admin action."""
    result = await session.execute(select(User.id).where(User.telegram_id == telegram_id))
    user_id = result.scalar_one_or_none()
    if not user_id:
        logger.warning("Audit log: user with telegram_id=%s not found", telegram_id)
        return

    log = AuditLog(
        user_id=user_id,
        action=action,
        target_type=target_type,
        target_id=target_id,
        details=details,
    )
    session.add(log)
