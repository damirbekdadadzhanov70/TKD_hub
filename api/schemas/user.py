from typing import Literal, Optional

from pydantic import BaseModel

from api.schemas.athlete import AthleteRead
from api.schemas.coach import CoachRead


class MeResponse(BaseModel):
    telegram_id: int
    username: Optional[str] = None
    language: str
    role: Literal["athlete", "coach", "none"]
    athlete: Optional[AthleteRead] = None
    coach: Optional[CoachRead] = None
