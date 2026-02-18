import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from api.dependencies import AuthContext, get_current_user
from api.schemas.coach import CoachAthleteRead, CoachEntryRead, CoachSearchResult, PendingAthleteRead
from api.schemas.pagination import PaginatedResponse
from api.utils.pagination import paginate_query
from db.models import CoachAthlete, TournamentEntry
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
