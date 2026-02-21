import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select

from api.dependencies import AuthContext, get_current_user
from api.schemas.weight_entry import WeightEntryCreate, WeightEntryRead
from db.models import WeightEntry

router = APIRouter()


@router.get("/weight-entries", response_model=list[WeightEntryRead])
async def list_weight_entries(
    ctx: AuthContext = Depends(get_current_user),
):
    result = await ctx.session.execute(
        select(WeightEntry).where(WeightEntry.user_id == ctx.user.id).order_by(WeightEntry.date.desc())
    )
    entries = result.scalars().all()
    return [WeightEntryRead.model_validate(e) for e in entries]


@router.post("/weight-entries", response_model=WeightEntryRead, status_code=status.HTTP_201_CREATED)
async def create_weight_entry(
    data: WeightEntryCreate,
    ctx: AuthContext = Depends(get_current_user),
):
    # Upsert: update if entry exists for this date, else insert
    result = await ctx.session.execute(
        select(WeightEntry).where(
            WeightEntry.user_id == ctx.user.id,
            WeightEntry.date == data.date,
        )
    )
    entry = result.scalar_one_or_none()

    if entry:
        entry.weight_kg = data.weight_kg
    else:
        entry = WeightEntry(
            user_id=ctx.user.id,
            athlete_id=ctx.user.athlete.id if ctx.user.athlete else None,
            date=data.date,
            weight_kg=data.weight_kg,
        )
        ctx.session.add(entry)

    await ctx.session.commit()
    await ctx.session.refresh(entry)
    return WeightEntryRead.model_validate(entry)


@router.delete("/weight-entries/{entry_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_weight_entry(
    entry_id: uuid.UUID,
    ctx: AuthContext = Depends(get_current_user),
):
    result = await ctx.session.execute(
        select(WeightEntry).where(
            WeightEntry.id == entry_id,
            WeightEntry.user_id == ctx.user.id,
        )
    )
    entry = result.scalar_one_or_none()
    if not entry:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Weight entry not found",
        )

    await ctx.session.delete(entry)
    await ctx.session.commit()
