import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel


class AuditLogRead(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    action: str
    target_type: str
    target_id: str | None = None
    details: dict[str, Any] | None = None
    created_at: datetime

    model_config = {"from_attributes": True}
