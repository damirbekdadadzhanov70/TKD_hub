import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from bot.config import settings
from db.models import User
from db.models.audit_log import AuditLog
from tests.conftest import make_init_data


@pytest.mark.asyncio
async def test_audit_logs_admin_access(client: AsyncClient, db_session: AsyncSession):
    """Admin can access audit logs."""
    # Create admin user
    admin_tid = settings.admin_ids[0] if settings.admin_ids else 999999999
    user = User(telegram_id=admin_tid, username="admin", language="en")
    db_session.add(user)
    await db_session.flush()

    # Add a log entry
    log = AuditLog(
        user_id=user.id,
        action="test_action",
        target_type="test",
        target_id="123",
    )
    db_session.add(log)
    await db_session.commit()

    init_data = make_init_data(telegram_id=admin_tid)
    client.headers["Authorization"] = f"tma {init_data}"

    response = await client.get("/api/admin/audit-logs")
    assert response.status_code == 200
    body = response.json()
    assert body["total"] >= 1
    assert len(body["items"]) >= 1
    assert body["items"][0]["action"] == "test_action"


@pytest.mark.asyncio
async def test_audit_logs_non_admin_rejected(auth_client: AsyncClient):
    """Non-admin users get 403."""
    response = await auth_client.get("/api/admin/audit-logs")
    assert response.status_code == 403
