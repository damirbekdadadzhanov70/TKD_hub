import uuid
from datetime import date
from decimal import Decimal

from pydantic import BaseModel, Field


class SleepEntryRead(BaseModel):
    id: uuid.UUID
    date: date
    sleep_hours: Decimal

    model_config = {"from_attributes": True}


class SleepEntryCreate(BaseModel):
    date: date
    sleep_hours: Decimal = Field(..., gt=0, le=24)
