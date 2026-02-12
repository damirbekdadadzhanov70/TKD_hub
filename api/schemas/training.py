import uuid
from datetime import date
from decimal import Decimal

from pydantic import BaseModel


class TrainingLogRead(BaseModel):
    id: uuid.UUID
    date: date
    type: str
    duration_minutes: int
    intensity: str
    weight: Decimal | None = None
    notes: str | None = None
    coach_comment: str | None = None

    model_config = {"from_attributes": True}


class TrainingLogCreate(BaseModel):
    date: date
    type: str
    duration_minutes: int
    intensity: str
    weight: Decimal | None = None
    notes: str | None = None
