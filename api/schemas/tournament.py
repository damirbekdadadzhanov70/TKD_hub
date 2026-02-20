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
    photos_url: Optional[str] = None
    results_url: Optional[str] = None
    organizer_name: Optional[str] = None
    organizer_phone: Optional[str] = None
    organizer_telegram: Optional[str] = None
    status: str
    importance_level: int
    entries: list[TournamentEntryRead] = []
    results: list["TournamentResultRead"] = []
    files: list["TournamentFileRead"] = []

    model_config = {"from_attributes": True}


class TournamentBatchEnter(BaseModel):
    athlete_ids: list[uuid.UUID] = Field(..., min_length=1, max_length=50)
    age_category: str = Field(default="", max_length=50)


class TournamentInterestResponse(BaseModel):
    tournament_id: uuid.UUID
    athlete_id: uuid.UUID
    created: bool


class TournamentResultRead(BaseModel):
    id: uuid.UUID
    tournament_id: uuid.UUID
    athlete_id: Optional[uuid.UUID] = None
    athlete_name: str
    city: str
    weight_category: str
    age_category: str
    gender: Optional[str] = None
    place: int
    rating_points_earned: int
    is_matched: bool = True

    model_config = {"from_attributes": True}


class TournamentCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: str | None = Field(None, max_length=1000)
    start_date: date
    end_date: date
    city: str = Field(..., min_length=1, max_length=100)
    venue: str = Field(..., min_length=1, max_length=255)
    age_categories: list[str] = []
    weight_categories: list[str] = []
    entry_fee: int | None = None
    currency: str = Field("RUB", max_length=10)
    registration_deadline: date
    importance_level: int = Field(2, ge=1, le=3)
    photos_url: str | None = Field(None, max_length=500)
    results_url: str | None = Field(None, max_length=500)
    organizer_name: str | None = Field(None, max_length=255)
    organizer_phone: str | None = Field(None, max_length=50)
    organizer_telegram: str | None = Field(None, max_length=100)


class TournamentUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=255)
    description: str | None = None
    start_date: date | None = None
    end_date: date | None = None
    city: str | None = Field(None, min_length=1, max_length=100)
    venue: str | None = Field(None, min_length=1, max_length=255)
    age_categories: list[str] | None = None
    weight_categories: list[str] | None = None
    entry_fee: int | None = None
    currency: str | None = Field(None, max_length=10)
    registration_deadline: date | None = None
    importance_level: int | None = Field(None, ge=1, le=3)
    photos_url: str | None = None
    results_url: str | None = None
    organizer_name: str | None = None
    organizer_phone: str | None = None
    organizer_telegram: str | None = None


class TournamentFileRead(BaseModel):
    id: uuid.UUID
    tournament_id: uuid.UUID
    category: str
    filename: str
    blob_url: str
    file_size: int
    file_type: str
    created_at: str

    model_config = {"from_attributes": True}


class TournamentResultCreate(BaseModel):
    athlete_id: uuid.UUID
    weight_category: str = Field(..., min_length=1, max_length=50)
    age_category: str = Field(..., min_length=1, max_length=50)
    gender: str | None = Field(None, max_length=10)
    place: int = Field(..., ge=1)
    rating_points_earned: int = Field(0, ge=0)


class CsvMatchedDetail(BaseModel):
    name: str
    points: int
    place: int


class CsvProcessingSummary(BaseModel):
    total_rows: int
    matched: int
    unmatched: int
    points_awarded: int
    matched_details: list[CsvMatchedDetail] = []


class TournamentFileUploadResponse(TournamentFileRead):
    csv_summary: Optional[CsvProcessingSummary] = None
