import uuid
from datetime import date
from decimal import Decimal

from pydantic import BaseModel, Field


class WeightEntryRead(BaseModel):
    id: uuid.UUID
    date: date
    weight_kg: Decimal

    model_config = {"from_attributes": True}


class WeightEntryCreate(BaseModel):
    date: date
    weight_kg: Decimal = Field(..., gt=0, le=300)
