import uuid
from datetime import date
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel


class AthleteRead(BaseModel):
    id: uuid.UUID
    full_name: str
    date_of_birth: date
    gender: str
    weight_category: str
    current_weight: Decimal
    belt: str
    country: str
    city: str
    club: Optional[str] = None
    photo_url: Optional[str] = None
    rating_points: int = 0

    model_config = {"from_attributes": True}


class AthleteUpdate(BaseModel):
    full_name: Optional[str] = None
    weight_category: Optional[str] = None
    current_weight: Optional[Decimal] = None
    belt: Optional[str] = None
    city: Optional[str] = None
    club: Optional[str] = None
    photo_url: Optional[str] = None
