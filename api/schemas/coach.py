import uuid
from datetime import date

from pydantic import BaseModel


class CoachRead(BaseModel):
    id: uuid.UUID
    full_name: str
    date_of_birth: date
    gender: str
    country: str
    city: str
    club: str
    qualification: str
    photo_url: str | None = None
    is_verified: bool = False

    model_config = {"from_attributes": True}


class CoachAthleteRead(BaseModel):
    id: uuid.UUID
    full_name: str
    weight_category: str
    belt: str
    rating_points: int = 0
    club: str | None = None

    model_config = {"from_attributes": True}
