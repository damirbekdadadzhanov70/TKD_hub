import uuid
from datetime import date
from decimal import Decimal

from pydantic import BaseModel


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
    athlete_name: str
    weight_category: str
    age_category: str
    status: str

    model_config = {"from_attributes": True}


class TournamentRead(BaseModel):
    id: uuid.UUID
    name: str
    description: str | None = None
    start_date: date
    end_date: date
    city: str
    country: str
    venue: str
    age_categories: list = []
    weight_categories: list = []
    entry_fee: Decimal | None = None
    currency: str = "USD"
    registration_deadline: date
    organizer_contact: str | None = None
    status: str
    importance_level: int
    entries: list[TournamentEntryRead] = []

    model_config = {"from_attributes": True}


class TournamentEntryCreate(BaseModel):
    athlete_id: uuid.UUID
    weight_category: str
    age_category: str
