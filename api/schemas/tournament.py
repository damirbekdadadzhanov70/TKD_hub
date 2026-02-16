import uuid
from datetime import date
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, Field


class TournamentListItem(BaseModel):
    id: uuid.UUID
    name: str
    start_date: date
    end_date: date
    city: str
    country: str
    status: str
    importance_level: int
    entry_count: int = 0

    model_config = {"from_attributes": True}


class TournamentEntryRead(BaseModel):
    id: uuid.UUID
    athlete_id: uuid.UUID
    coach_id: Optional[uuid.UUID] = None
    coach_name: Optional[str] = None
    athlete_name: str
    weight_category: str
    age_category: str
    status: str

    model_config = {"from_attributes": True}


class TournamentRead(BaseModel):
    id: uuid.UUID
    name: str
    description: Optional[str] = None
    start_date: date
    end_date: date
    city: str
    country: str
    venue: str
    age_categories: list = []
    weight_categories: list = []
    entry_fee: Optional[Decimal] = None
    currency: str = "USD"
    registration_deadline: date
    organizer_contact: Optional[str] = None
    status: str
    importance_level: int
    entries: list[TournamentEntryRead] = []

    model_config = {"from_attributes": True}


class TournamentBatchEnter(BaseModel):
    athlete_ids: list[uuid.UUID] = Field(..., min_length=1, max_length=50)
    age_category: str = Field(..., min_length=1, max_length=50)


class TournamentInterestResponse(BaseModel):
    tournament_id: uuid.UUID
    athlete_id: uuid.UUID
    created: bool


class TournamentResultRead(BaseModel):
    id: uuid.UUID
    tournament_id: uuid.UUID
    athlete_id: uuid.UUID
    athlete_name: str
    city: str
    weight_category: str
    age_category: str
    place: int
    rating_points_earned: int

    model_config = {"from_attributes": True}


class TournamentResultCreate(BaseModel):
    athlete_id: uuid.UUID
    weight_category: str = Field(..., min_length=1, max_length=50)
    age_category: str = Field(..., min_length=1, max_length=50)
    place: int = Field(..., ge=1)
    rating_points_earned: int = Field(0, ge=0)
