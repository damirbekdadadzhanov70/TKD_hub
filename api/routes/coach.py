from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from api.dependencies import AuthContext, get_current_user
from api.schemas.coach import CoachAthleteRead, CoachEntryRead
from api.schemas.pagination import PaginatedResponse
from api.utils.pagination import paginate_query
from db.models import CoachAthlete, TournamentEntry

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
            belt=link.athlete.belt,
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
