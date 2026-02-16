import uuid
from datetime import date
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, Field


class AthleteRead(BaseModel):
    id: uuid.UUID
    full_name: str
    date_of_birth: date
    gender: str
    weight_category: str
    current_weight: Decimal
    sport_rank: str
    country: str
    city: str
    club: Optional[str] = None
    photo_url: Optional[str] = None
    rating_points: int = 0

    model_config = {"from_attributes": True}


class AthleteUpdate(BaseModel):
    full_name: Optional[str] = Field(None, min_length=2, max_length=255)
    weight_category: Optional[str] = Field(None, min_length=1, max_length=50)
    current_weight: Optional[Decimal] = Field(None, gt=0, le=300)
    sport_rank: Optional[str] = Field(None, min_length=1, max_length=50)
    city: Optional[str] = Field(None, min_length=1, max_length=100)
    club: Optional[str] = Field(None, max_length=255)
    photo_url: Optional[str] = Field(None, max_length=500)
