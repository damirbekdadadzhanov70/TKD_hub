import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select

from api.dependencies import AuthContext, get_current_user
from api.schemas.sleep_entry import SleepEntryCreate, SleepEntryRead
from db.models import SleepEntry

router = APIRouter()


@router.get("/sleep-entries", response_model=list[SleepEntryRead])
async def list_sleep_entries(
    ctx: AuthContext = Depends(get_current_user),
):
    result = await ctx.session.execute(
        select(SleepEntry).where(SleepEntry.user_id == ctx.user.id).order_by(SleepEntry.date.desc())
    )
    entries = result.scalars().all()
    return [SleepEntryRead.model_validate(e) for e in entries]


@router.post("/sleep-entries", response_model=SleepEntryRead, status_code=status.HTTP_201_CREATED)
async def create_sleep_entry(
    data: SleepEntryCreate,
    ctx: AuthContext = Depends(get_current_user),
):
    # Upsert: update if entry exists for this date, else insert
    result = await ctx.session.execute(
        select(SleepEntry).where(
            SleepEntry.user_id == ctx.user.id,
            SleepEntry.date == data.date,
        )
    )
    entry = result.scalar_one_or_none()

    if entry:
        entry.sleep_hours = data.sleep_hours
    else:
        entry = SleepEntry(
            user_id=ctx.user.id,
            athlete_id=ctx.user.athlete.id if ctx.user.athlete else None,
            date=data.date,
            sleep_hours=data.sleep_hours,
        )
        ctx.session.add(entry)

    await ctx.session.commit()
    await ctx.session.refresh(entry)
    return SleepEntryRead.model_validate(entry)


@router.delete("/sleep-entries/{entry_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_sleep_entry(
    entry_id: uuid.UUID,
    ctx: AuthContext = Depends(get_current_user),
):
    result = await ctx.session.execute(
        select(SleepEntry).where(
            SleepEntry.id == entry_id,
            SleepEntry.user_id == ctx.user.id,
        )
    )
    entry = result.scalar_one_or_none()
    if not entry:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Sleep entry not found",
        )

    await ctx.session.delete(entry)
    await ctx.session.commit()
