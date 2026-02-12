import uuid
from datetime import date
from decimal import Decimal
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


class Intensity(str, Enum):
    low = "low"
    medium = "medium"
    high = "high"


class TrainingLogRead(BaseModel):
    id: uuid.UUID
    date: date
    type: str
    duration_minutes: int
    intensity: str
    weight: Optional[Decimal] = None
    notes: Optional[str] = None
    coach_comment: Optional[str] = None

    model_config = {"from_attributes": True}


class TrainingLogCreate(BaseModel):
    date: date
    type: str = Field(..., min_length=1, max_length=50)
    duration_minutes: int = Field(..., gt=0, le=600)
    intensity: Intensity
    weight: Optional[Decimal] = Field(None, gt=0, le=300)
    notes: Optional[str] = Field(None, max_length=1000)


class TrainingLogUpdate(BaseModel):
    date: Optional[date] = None
    type: Optional[str] = Field(None, min_length=1, max_length=50)
    duration_minutes: Optional[int] = Field(None, gt=0, le=600)
    intensity: Optional[Intensity] = None
    weight: Optional[Decimal] = Field(None, gt=0, le=300)
    notes: Optional[str] = Field(None, max_length=1000)


class TrainingLogStats(BaseModel):
    total_sessions: int
    total_minutes: int
    avg_intensity: str
    training_days: int
