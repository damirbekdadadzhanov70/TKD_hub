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


class CoachUpdate(BaseModel):
    full_name: Optional[str] = None
    city: Optional[str] = None
    club: Optional[str] = None
    qualification: Optional[str] = None


class CoachAthleteRead(BaseModel):
    id: uuid.UUID
    full_name: str
    weight_category: str
    sport_rank: str
    rating_points: int = 0
    club: Optional[str] = None

    model_config = {"from_attributes": True}


class CoachSearchResult(BaseModel):
    id: uuid.UUID
    full_name: str
    city: str
    club: str
    qualification: str
    is_verified: bool = False

    model_config = {"from_attributes": True}


class MyCoachRead(BaseModel):
    link_id: uuid.UUID
    coach_id: uuid.UUID
    full_name: str
    city: str
    club: str
    qualification: str
    is_verified: bool = False
    status: str


class PendingAthleteRead(BaseModel):
    link_id: uuid.UUID
    athlete_id: uuid.UUID
    full_name: str
    weight_category: str
    sport_rank: str
    club: Optional[str] = None


class CoachEntryRead(BaseModel):
    id: uuid.UUID
    tournament_id: uuid.UUID
    tournament_name: str
    athlete_id: uuid.UUID
    athlete_name: str
    weight_category: str
    age_category: str
    status: str
