import uuid
from datetime import date
from typing import Optional

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
    photo_url: Optional[str] = None
    is_verified: bool = False

    model_config = {"from_attributes": True}


class CoachAthleteRead(BaseModel):
    id: uuid.UUID
    full_name: str
    weight_category: str
    belt: str
    rating_points: int = 0
    club: Optional[str] = None

    model_config = {"from_attributes": True}


class CoachEntryRead(BaseModel):
    id: uuid.UUID
    tournament_id: uuid.UUID
    tournament_name: str
    athlete_id: uuid.UUID
    athlete_name: str
    weight_category: str
    age_category: str
    status: str
