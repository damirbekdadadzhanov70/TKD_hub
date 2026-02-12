import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import extract, select

from api.dependencies import AuthContext, get_current_user
from api.schemas.pagination import PaginatedResponse
from api.schemas.training import (
    TrainingLogCreate,
    TrainingLogRead,
    TrainingLogStats,
    TrainingLogUpdate,
)
from api.utils.pagination import paginate_query
from db.models import TrainingLog

router = APIRouter()


@router.get("/training-log", response_model=PaginatedResponse[TrainingLogRead])
async def list_training_logs(
    month: int | None = Query(None, ge=1, le=12),
    year: int | None = Query(None, ge=2020),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=100),
    ctx: AuthContext = Depends(get_current_user),
):
    if not ctx.user.athlete:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only athletes have training logs",
        )

    query = select(TrainingLog).where(TrainingLog.athlete_id == ctx.user.athlete.id).order_by(TrainingLog.date.desc())
    if month:
        query = query.where(extract("month", TrainingLog.date) == month)
    if year:
        query = query.where(extract("year", TrainingLog.date) == year)

    logs, total = await paginate_query(ctx.session, query, page, limit)
    items = [TrainingLogRead.model_validate(log) for log in logs]
    return PaginatedResponse(
        items=items,
        total=total,
        page=page,
        limit=limit,
        has_next=(page * limit) < total,
    )


@router.post("/training-log", response_model=TrainingLogRead, status_code=status.HTTP_201_CREATED)
async def create_training_log(
    data: TrainingLogCreate,
    ctx: AuthContext = Depends(get_current_user),
):
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


# NOTE: /stats must be registered BEFORE /{log_id} to avoid path conflict
@router.get("/training-log/stats", response_model=TrainingLogStats)
async def get_training_stats(
    month: int | None = Query(None, ge=1, le=12),
    year: int | None = Query(None, ge=2020),
    ctx: AuthContext = Depends(get_current_user),
):
    if not ctx.user.athlete:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only athletes have training stats",
        )

    query = select(TrainingLog).where(TrainingLog.athlete_id == ctx.user.athlete.id)
    if month:
        query = query.where(extract("month", TrainingLog.date) == month)
    if year:
        query = query.where(extract("year", TrainingLog.date) == year)

    result = await ctx.session.execute(query)
    logs = result.scalars().all()

    if not logs:
        return TrainingLogStats(
            total_sessions=0,
            total_minutes=0,
            avg_intensity="none",
            training_days=0,
        )

    total_sessions = len(logs)
    total_minutes = sum(log.duration_minutes for log in logs)
    training_days = len({log.date for log in logs})

    intensity_map = {"low": 1, "medium": 2, "high": 3}
    avg_num = sum(intensity_map.get(log.intensity, 2) for log in logs) / total_sessions
    if avg_num < 1.5:
        avg_intensity = "low"
    elif avg_num > 2.5:
        avg_intensity = "high"
    else:
        avg_intensity = "medium"

    return TrainingLogStats(
        total_sessions=total_sessions,
        total_minutes=total_minutes,
        avg_intensity=avg_intensity,
        training_days=training_days,
    )


@router.put("/training-log/{log_id}", response_model=TrainingLogRead)
async def update_training_log(
    log_id: uuid.UUID,
    data: TrainingLogUpdate,
    ctx: AuthContext = Depends(get_current_user),
):
    if not ctx.user.athlete:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only athletes can update training logs",
        )

    result = await ctx.session.execute(
        select(TrainingLog).where(
            TrainingLog.id == log_id,
            TrainingLog.athlete_id == ctx.user.athlete.id,
        )
    )
    log = result.scalar_one_or_none()
    if not log:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Training log not found",
        )

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(log, field, value)

    ctx.session.add(log)
    await ctx.session.commit()
    await ctx.session.refresh(log)
    return TrainingLogRead.model_validate(log)


@router.delete("/training-log/{log_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_training_log(
    log_id: uuid.UUID,
    ctx: AuthContext = Depends(get_current_user),
):
    if not ctx.user.athlete:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only athletes can delete training logs",
        )

    result = await ctx.session.execute(
        select(TrainingLog).where(
            TrainingLog.id == log_id,
            TrainingLog.athlete_id == ctx.user.athlete.id,
        )
    )
    log = result.scalar_one_or_none()
    if not log:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Training log not found",
        )

    await ctx.session.delete(log)
    await ctx.session.commit()
