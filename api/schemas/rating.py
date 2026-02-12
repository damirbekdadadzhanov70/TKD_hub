import uuid

from pydantic import BaseModel


class RatingEntry(BaseModel):
    rank: int
    athlete_id: uuid.UUID
    full_name: str
    country: str
    city: str
    club: str | None = None
    weight_category: str
    belt: str
    rating_points: int
    photo_url: str | None = None
