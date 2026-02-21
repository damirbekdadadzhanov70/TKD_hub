import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import case, extract, func, select
from sqlalchemy.orm import selectinload

from api.dependencies import AuthContext, get_current_user
from api.schemas.coach import CoachAthleteRead, CoachEntryRead, CoachSearchResult, PendingAthleteRead
from api.schemas.pagination import PaginatedResponse
from api.schemas.sleep_entry import SleepEntryRead
from api.schemas.training import TrainingLogRead, TrainingLogStats
from api.schemas.weight_entry import WeightEntryRead
from api.utils.pagination import paginate_query
from db.models import CoachAthlete, SleepEntry, TournamentEntry, TrainingLog, WeightEntry
from db.models.coach import Coach

router = APIRouter()


@router.get("/coach/athletes", response_model=PaginatedResponse[CoachAthleteRead])
async def list_coach_athletes(
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=100),
    ctx: AuthContext = Depends(get_current_user),
):
    if not ctx.user.coach:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only coaches can access this endpoint",
        )

    query = (
        select(CoachAthlete)
        .where(
            CoachAthlete.coach_id == ctx.user.coach.id,
            CoachAthlete.status == "accepted",
        )
        .options(selectinload(CoachAthlete.athlete))
    )
    links, total = await paginate_query(ctx.session, query, page, limit)

    items = [
        CoachAthleteRead(
            id=link.athlete.id,
            full_name=link.athlete.full_name,
            weight_category=link.athlete.weight_category,
            sport_rank=link.athlete.sport_rank,
            rating_points=link.athlete.rating_points,
            club=link.athlete.club,
        )
        for link in links
    ]
    return PaginatedResponse(
        items=items,
        total=total,
        page=page,
        limit=limit,
        has_next=(page * limit) < total,
    )


@router.get("/coach/entries", response_model=PaginatedResponse[CoachEntryRead])
async def list_coach_entries(
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=100),
    ctx: AuthContext = Depends(get_current_user),
):
    if not ctx.user.coach:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only coaches can access this endpoint",
        )

    query = (
        select(TournamentEntry)
        .where(TournamentEntry.coach_id == ctx.user.coach.id)
        .options(
            selectinload(TournamentEntry.athlete),
            selectinload(TournamentEntry.tournament),
        )
        .order_by(TournamentEntry.created_at.desc())
    )
    entries, total = await paginate_query(ctx.session, query, page, limit)

    items = [
        CoachEntryRead(
            id=e.id,
            tournament_id=e.tournament_id,
            tournament_name=e.tournament.name,
            athlete_id=e.athlete_id,
            athlete_name=e.athlete.full_name,
            weight_category=e.weight_category,
            age_category=e.age_category,
            status=e.status,
        )
        for e in entries
    ]
    return PaginatedResponse(
        items=items,
        total=total,
        page=page,
        limit=limit,
        has_next=(page * limit) < total,
    )


@router.get("/coaches/search", response_model=list[CoachSearchResult])
async def search_coaches(
    q: str = Query(..., min_length=2),
    ctx: AuthContext = Depends(get_current_user),
):
    if not ctx.user.athlete:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only athletes can search for coaches",
        )

    query = select(Coach).where(Coach.full_name.ilike(f"%{q}%")).limit(20)
    result = await ctx.session.execute(query)
    coaches = result.scalars().all()
    return [CoachSearchResult.model_validate(c) for c in coaches]


@router.get("/coach/pending-athletes", response_model=list[PendingAthleteRead])
async def get_pending_athletes(
    ctx: AuthContext = Depends(get_current_user),
):
    if not ctx.user.coach:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only coaches can access this endpoint",
        )

    query = (
        select(CoachAthlete)
        .where(
            CoachAthlete.coach_id == ctx.user.coach.id,
            CoachAthlete.status == "pending",
        )
        .options(selectinload(CoachAthlete.athlete))
    )
    result = await ctx.session.execute(query)
    links = result.scalars().all()
    return [
        PendingAthleteRead(
            link_id=link.id,
            athlete_id=link.athlete.id,
            full_name=link.athlete.full_name,
            weight_category=link.athlete.weight_category,
            sport_rank=link.athlete.sport_rank,
            club=link.athlete.club,
        )
        for link in links
    ]


@router.post("/coach/athletes/{link_id}/accept")
async def accept_athlete_request(
    link_id: str,
    ctx: AuthContext = Depends(get_current_user),
):
    if not ctx.user.coach:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only coaches can access this endpoint",
        )

    try:
        lid = uuid.UUID(link_id)
    except ValueError as err:
        raise HTTPException(status_code=400, detail="Invalid link_id") from err

    result = await ctx.session.execute(
        select(CoachAthlete).where(
            CoachAthlete.id == lid,
            CoachAthlete.coach_id == ctx.user.coach.id,
            CoachAthlete.status == "pending",
        )
    )
    link = result.scalar_one_or_none()
    if not link:
        raise HTTPException(status_code=404, detail="Pending request not found")

    link.status = "accepted"
    link.accepted_at = datetime.utcnow()
    ctx.session.add(link)
    await ctx.session.commit()
    return {"status": "accepted"}


@router.post("/coach/athletes/{link_id}/reject")
async def reject_athlete_request(
    link_id: str,
    ctx: AuthContext = Depends(get_current_user),
):
    if not ctx.user.coach:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only coaches can access this endpoint",
        )

    try:
        lid = uuid.UUID(link_id)
    except ValueError as err:
        raise HTTPException(status_code=400, detail="Invalid link_id") from err

    result = await ctx.session.execute(
        select(CoachAthlete).where(
            CoachAthlete.id == lid,
            CoachAthlete.coach_id == ctx.user.coach.id,
            CoachAthlete.status == "pending",
        )
    )
    link = result.scalar_one_or_none()
    if not link:
        raise HTTPException(status_code=404, detail="Pending request not found")

    await ctx.session.delete(link)
    await ctx.session.commit()
    return {"status": "rejected"}


async def _verify_coach_athlete_link(ctx: AuthContext, athlete_id: str) -> uuid.UUID:
    """Check that the current user is a coach with an accepted link to the given athlete."""
    if not ctx.user.coach:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only coaches can access this endpoint",
        )
    try:
        aid = uuid.UUID(athlete_id)
    except ValueError as err:
        raise HTTPException(status_code=400, detail="Invalid athlete_id") from err

    result = await ctx.session.execute(
        select(CoachAthlete).where(
            CoachAthlete.coach_id == ctx.user.coach.id,
            CoachAthlete.athlete_id == aid,
            CoachAthlete.status == "accepted",
        )
    )
    if not result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Athlete is not linked to this coach",
        )
    return aid


@router.get(
    "/coach/athletes/{athlete_id}/training-log",
    response_model=PaginatedResponse[TrainingLogRead],
)
async def get_coach_athlete_training_log(
    athlete_id: str,
    month: int | None = Query(None, ge=1, le=12),
    year: int | None = Query(None, ge=2020),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=100),
    ctx: AuthContext = Depends(get_current_user),
):
    aid = await _verify_coach_athlete_link(ctx, athlete_id)

    query = select(TrainingLog).where(TrainingLog.athlete_id == aid).order_by(TrainingLog.date.desc())
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


@router.get(
    "/coach/athletes/{athlete_id}/training-log/stats",
    response_model=TrainingLogStats,
)
async def get_coach_athlete_training_stats(
    athlete_id: str,
    month: int | None = Query(None, ge=1, le=12),
    year: int | None = Query(None, ge=2020),
    ctx: AuthContext = Depends(get_current_user),
):
    aid = await _verify_coach_athlete_link(ctx, athlete_id)

    filters = [TrainingLog.athlete_id == aid]
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


@router.get(
    "/coach/athletes/{athlete_id}/weight-entries",
    response_model=list[WeightEntryRead],
)
async def get_coach_athlete_weight_entries(
    athlete_id: str,
    ctx: AuthContext = Depends(get_current_user),
):
    aid = await _verify_coach_athlete_link(ctx, athlete_id)

    result = await ctx.session.execute(
        select(WeightEntry).where(WeightEntry.athlete_id == aid).order_by(WeightEntry.date.desc())
    )
    entries = result.scalars().all()
    return [WeightEntryRead.model_validate(e) for e in entries]


@router.get(
    "/coach/athletes/{athlete_id}/sleep-entries",
    response_model=list[SleepEntryRead],
)
async def get_coach_athlete_sleep_entries(
    athlete_id: str,
    ctx: AuthContext = Depends(get_current_user),
):
    aid = await _verify_coach_athlete_link(ctx, athlete_id)

    result = await ctx.session.execute(
        select(SleepEntry).where(SleepEntry.athlete_id == aid).order_by(SleepEntry.date.desc())
    )
    entries = result.scalars().all()
    return [SleepEntryRead.model_validate(e) for e in entries]
