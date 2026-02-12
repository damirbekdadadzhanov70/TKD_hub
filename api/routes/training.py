from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select

from api.dependencies import AuthContext, get_current_user
from api.schemas.training import TrainingLogCreate, TrainingLogRead
from db.models import TrainingLog

router = APIRouter()


@router.get("/training-log", response_model=list[TrainingLogRead])
async def list_training_logs(
    month: int | None = Query(None, ge=1, le=12),
    year: int | None = Query(None, ge=2020),
    ctx: AuthContext = Depends(get_current_user),
):
    try:
        if not ctx.user.athlete:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Only athletes have training logs",
            )

        query = (
            select(TrainingLog)
            .where(TrainingLog.athlete_id == ctx.user.athlete.id)
            .order_by(TrainingLog.date.desc())
        )
        if month:
            from sqlalchemy import extract
            query = query.where(extract("month", TrainingLog.date) == month)
        if year:
            from sqlalchemy import extract
            query = query.where(extract("year", TrainingLog.date) == year)

        result = await ctx.session.execute(query)
        logs = result.scalars().all()
        return [TrainingLogRead.model_validate(log) for log in logs]
    finally:
        await ctx.session.close()


@router.post("/training-log", response_model=TrainingLogRead, status_code=status.HTTP_201_CREATED)
async def create_training_log(
    data: TrainingLogCreate,
    ctx: AuthContext = Depends(get_current_user),
):
    try:
        if not ctx.user.athlete:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Only athletes can create training logs",
            )

        log = TrainingLog(
            athlete_id=ctx.user.athlete.id,
            date=data.date,
            type=data.type,
            duration_minutes=data.duration_minutes,
            intensity=data.intensity,
            weight=data.weight,
            notes=data.notes,
        )
        ctx.session.add(log)
        await ctx.session.commit()
        await ctx.session.refresh(log)
        return TrainingLogRead.model_validate(log)
    finally:
        await ctx.session.close()
