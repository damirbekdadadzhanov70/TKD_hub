import uuid
from datetime import date
from decimal import Decimal

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
    club: str | None = None
    photo_url: str | None = None
    rating_points: int = 0

    model_config = {"from_attributes": True}


class AthleteUpdate(BaseModel):
    full_name: str | None = None
    weight_category: str | None = None
    current_weight: Decimal | None = None
    belt: str | None = None
    city: str | None = None
    club: str | None = None
    photo_url: str | None = None
