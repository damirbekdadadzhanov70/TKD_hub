import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import case, extract, func, select

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

    filters = [TrainingLog.athlete_id == ctx.user.athlete.id]
    if month:
        filters.append(extract("month", TrainingLog.date) == month)
    if year:
        filters.append(extract("year", TrainingLog.date) == year)

    intensity_score = case(
        (TrainingLog.intensity == "low", 1),
        (TrainingLog.intensity == "high", 3),
        else_=2,
    )

    query = select(
        func.count().label("total_sessions"),
        func.coalesce(func.sum(TrainingLog.duration_minutes), 0).label("total_minutes"),
        func.count(func.distinct(TrainingLog.date)).label("training_days"),
        func.avg(intensity_score).label("avg_intensity_num"),
    ).where(*filters)

    result = await ctx.session.execute(query)
    row = result.one()

    if row.total_sessions == 0:
        return TrainingLogStats(
            total_sessions=0,
            total_minutes=0,
            avg_intensity="none",
            training_days=0,
        )

    avg_num = row.avg_intensity_num or 2
    if avg_num < 1.5:
        avg_intensity = "low"
    elif avg_num > 2.5:
        avg_intensity = "high"
    else:
        avg_intensity = "medium"

    return TrainingLogStats(
        total_sessions=row.total_sessions,
        total_minutes=row.total_minutes,
        avg_intensity=avg_intensity,
        training_days=row.training_days,
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
