from pydantic import BaseModel

from api.schemas.athlete import AthleteRead
from api.schemas.coach import CoachRead


class MeResponse(BaseModel):
    telegram_id: int
    username: str | None = None
    language: str
    role: str  # "athlete", "coach", or "none"
    athlete: AthleteRead | None = None
    coach: CoachRead | None = None
