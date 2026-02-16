import uuid
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.orm import selectinload

from api.dependencies import AuthContext, get_current_user
from api.schemas.pagination import PaginatedResponse
from api.schemas.tournament import (
    TournamentBatchEnter,
    TournamentEntryRead,
    TournamentInterestResponse,
    TournamentListItem,
    TournamentRead,
    TournamentResultCreate,
    TournamentResultRead,
)
from api.utils.pagination import paginate_query
from bot.config import settings
from db.models import (
    Athlete,
    CoachAthlete,
    Tournament,
    TournamentEntry,
    TournamentInterest,
    TournamentResult,
)

router = APIRouter()


@router.get("/tournaments", response_model=PaginatedResponse[TournamentListItem])
async def list_tournaments(
    country: str | None = Query(None, max_length=100),
    city: str | None = Query(None, max_length=100),
    status_filter: str | None = Query(None, alias="status", max_length=50),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=100),
    ctx: AuthContext = Depends(get_current_user),
):
    query = select(Tournament)
    if country:
        query = query.where(Tournament.country == country)
    if city:
        query = query.where(Tournament.city == city)
    if status_filter:
        query = query.where(Tournament.status == status_filter)
    query = query.order_by(Tournament.start_date.desc())

    tournaments, total = await paginate_query(ctx.session, query, page, limit)

    if not tournaments:
        return PaginatedResponse(items=[], total=0, page=page, limit=limit, has_next=False)

    # Use subquery to avoid N+1 for entry counts
    entry_counts_sq = (
        select(
            TournamentEntry.tournament_id,
            func.count().label("cnt"),
        )
        .group_by(TournamentEntry.tournament_id)
        .subquery()
    )

    t_ids = [t.id for t in tournaments]
    counts_result = await ctx.session.execute(
        select(entry_counts_sq.c.tournament_id, entry_counts_sq.c.cnt).where(entry_counts_sq.c.tournament_id.in_(t_ids))
    )
    counts_map = {row.tournament_id: row.cnt for row in counts_result}

    items = [
        TournamentListItem(
            id=t.id,
            name=t.name,
            start_date=t.start_date,
            end_date=t.end_date,
            city=t.city,
            country=t.country,
            status=t.status,
            importance_level=t.importance_level,
            entry_count=counts_map.get(t.id, 0),
        )
        for t in tournaments
    ]
    return PaginatedResponse(
        items=items,
        total=total,
        page=page,
        limit=limit,
        has_next=(page * limit) < total,
    )


@router.get("/tournaments/{tournament_id}", response_model=TournamentRead)
async def get_tournament(
    tournament_id: uuid.UUID,
    ctx: AuthContext = Depends(get_current_user),
):
    result = await ctx.session.execute(
        select(Tournament)
        .where(Tournament.id == tournament_id)
        .options(
            selectinload(Tournament.entries).selectinload(TournamentEntry.athlete),
            selectinload(Tournament.entries).selectinload(TournamentEntry.coach),
        )
    )
    tournament = result.scalar_one_or_none()
    if not tournament:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tournament not found")

    entries = [
        TournamentEntryRead(
            id=e.id,
            athlete_id=e.athlete_id,
            coach_id=e.coach_id,
            coach_name=e.coach.full_name if e.coach else None,
            athlete_name=e.athlete.full_name,
            weight_category=e.weight_category,
            age_category=e.age_category,
            status=e.status,
        )
        for e in tournament.entries
    ]

    return TournamentRead(
        id=tournament.id,
        name=tournament.name,
        description=tournament.description,
        start_date=tournament.start_date,
        end_date=tournament.end_date,
        city=tournament.city,
        country=tournament.country,
        venue=tournament.venue,
        age_categories=tournament.age_categories or [],
        weight_categories=tournament.weight_categories or [],
        entry_fee=tournament.entry_fee,
        currency=tournament.currency,
        registration_deadline=tournament.registration_deadline,
        organizer_contact=tournament.organizer_contact,
        status=tournament.status,
        importance_level=tournament.importance_level,
        entries=entries,
    )


@router.post(
    "/tournaments/{tournament_id}/interest",
    response_model=TournamentInterestResponse,
)
async def mark_interest(
    tournament_id: uuid.UUID,
    ctx: AuthContext = Depends(get_current_user),
):
    if not ctx.user.athlete:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only athletes can mark interest",
        )

    # Check tournament exists
    t_result = await ctx.session.execute(select(Tournament).where(Tournament.id == tournament_id))
    if not t_result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tournament not found",
        )

    # Check if already interested
    existing = await ctx.session.execute(
        select(TournamentInterest).where(
            TournamentInterest.tournament_id == tournament_id,
            TournamentInterest.athlete_id == ctx.user.athlete.id,
        )
    )
    if existing.scalar_one_or_none():
        return TournamentInterestResponse(
            tournament_id=tournament_id,
            athlete_id=ctx.user.athlete.id,
            created=False,
        )

    interest = TournamentInterest(
        tournament_id=tournament_id,
        athlete_id=ctx.user.athlete.id,
    )
    ctx.session.add(interest)
    await ctx.session.commit()

    return TournamentInterestResponse(
        tournament_id=tournament_id,
        athlete_id=ctx.user.athlete.id,
        created=True,
    )


@router.post(
    "/tournaments/{tournament_id}/enter",
    response_model=list[TournamentEntryRead],
    status_code=status.HTTP_201_CREATED,
)
async def enter_athletes(
    tournament_id: uuid.UUID,
    data: TournamentBatchEnter,
    ctx: AuthContext = Depends(get_current_user),
):
    if not ctx.user.coach:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only coaches can enter athletes",
        )

    # Verify tournament exists and is open
    t_result = await ctx.session.execute(select(Tournament).where(Tournament.id == tournament_id))
    tournament = t_result.scalar_one_or_none()
    if not tournament:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tournament not found",
        )

    # Check registration deadline
    if tournament.registration_deadline < date.today():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Registration deadline has passed",
        )

    # Validate age category
    if tournament.age_categories and data.age_category not in tournament.age_categories:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid age category '{data.age_category}'. Allowed: {', '.join(tournament.age_categories)}",
        )

    # Batch-load all needed data in 3 queries instead of N*3
    link_result = await ctx.session.execute(
        select(CoachAthlete).where(
            CoachAthlete.coach_id == ctx.user.coach.id,
            CoachAthlete.athlete_id.in_(data.athlete_ids),
            CoachAthlete.status == "accepted",
        )
    )
    linked_ids = {link.athlete_id for link in link_result.scalars().all()}

    dup_result = await ctx.session.execute(
        select(TournamentEntry.athlete_id).where(
            TournamentEntry.tournament_id == tournament_id,
            TournamentEntry.athlete_id.in_(data.athlete_ids),
        )
    )
    already_entered = set(dup_result.scalars().all())

    athletes_result = await ctx.session.execute(select(Athlete).where(Athlete.id.in_(data.athlete_ids)))
    athletes_map = {a.id: a for a in athletes_result.scalars().all()}

    created_entries = []
    for athlete_id in data.athlete_ids:
        if athlete_id not in linked_ids:
            continue
        if athlete_id in already_entered:
            continue
        athlete = athletes_map.get(athlete_id)
        if not athlete:
            continue
        if tournament.weight_categories and athlete.weight_category not in tournament.weight_categories:
            continue

        entry = TournamentEntry(
            tournament_id=tournament_id,
            athlete_id=athlete_id,
            coach_id=ctx.user.coach.id,
            weight_category=athlete.weight_category,
            age_category=data.age_category,
        )
        ctx.session.add(entry)
        await ctx.session.flush()

        created_entries.append(
            TournamentEntryRead(
                id=entry.id,
                athlete_id=entry.athlete_id,
                coach_id=entry.coach_id,
                coach_name=ctx.user.coach.full_name,
                athlete_name=athlete.full_name,
                weight_category=entry.weight_category,
                age_category=entry.age_category,
                status=entry.status,
            )
        )

    await ctx.session.commit()
    return created_entries


@router.delete(
    "/tournaments/{tournament_id}/entries/{entry_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def remove_entry(
    tournament_id: uuid.UUID,
    entry_id: uuid.UUID,
    ctx: AuthContext = Depends(get_current_user),
):
    if not ctx.user.coach:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only coaches can remove entries",
        )

    result = await ctx.session.execute(
        select(TournamentEntry).where(
            TournamentEntry.id == entry_id,
            TournamentEntry.tournament_id == tournament_id,
            TournamentEntry.coach_id == ctx.user.coach.id,
        )
    )
    entry = result.scalar_one_or_none()
    if not entry:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Entry not found",
        )

    await ctx.session.delete(entry)
    await ctx.session.commit()


def _check_admin(user) -> None:
    """Verify user is admin by telegram_id in settings."""
    if user.telegram_id not in settings.admin_ids:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can perform this action",
        )


@router.post(
    "/tournaments/{tournament_id}/coaches/{coach_id}/approve",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def approve_coach_entries(
    tournament_id: uuid.UUID,
    coach_id: uuid.UUID,
    ctx: AuthContext = Depends(get_current_user),
):
    _check_admin(ctx.user)

    result = await ctx.session.execute(
        select(TournamentEntry).where(
            TournamentEntry.tournament_id == tournament_id,
            TournamentEntry.coach_id == coach_id,
        )
    )
    entries = result.scalars().all()
    if not entries:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No entries found for this coach",
        )

    for entry in entries:
        entry.status = "approved"
    await ctx.session.commit()


@router.post(
    "/tournaments/{tournament_id}/coaches/{coach_id}/reject",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def reject_coach_entries(
    tournament_id: uuid.UUID,
    coach_id: uuid.UUID,
    ctx: AuthContext = Depends(get_current_user),
):
    _check_admin(ctx.user)

    result = await ctx.session.execute(
        select(TournamentEntry).where(
            TournamentEntry.tournament_id == tournament_id,
            TournamentEntry.coach_id == coach_id,
        )
    )
    entries = result.scalars().all()
    if not entries:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No entries found for this coach",
        )

    for entry in entries:
        entry.status = "rejected"
    await ctx.session.commit()


@router.get(
    "/tournaments/{tournament_id}/results",
    response_model=list[TournamentResultRead],
)
async def get_tournament_results(
    tournament_id: uuid.UUID,
    ctx: AuthContext = Depends(get_current_user),
):
    # Verify tournament exists
    t_result = await ctx.session.execute(select(Tournament).where(Tournament.id == tournament_id))
    if not t_result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tournament not found",
        )

    result = await ctx.session.execute(
        select(TournamentResult)
        .where(TournamentResult.tournament_id == tournament_id)
        .options(selectinload(TournamentResult.athlete))
        .order_by(TournamentResult.age_category, TournamentResult.weight_category, TournamentResult.place)
    )
    results = result.scalars().all()

    return [
        TournamentResultRead(
            id=r.id,
            tournament_id=r.tournament_id,
            athlete_id=r.athlete_id,
            athlete_name=r.athlete.full_name,
            city=r.athlete.city,
            weight_category=r.weight_category,
            age_category=r.age_category,
            place=r.place,
            rating_points_earned=r.rating_points_earned,
        )
        for r in results
    ]


@router.post(
    "/tournaments/{tournament_id}/results",
    response_model=TournamentResultRead,
    status_code=status.HTTP_201_CREATED,
)
async def create_tournament_result(
    tournament_id: uuid.UUID,
    data: TournamentResultCreate,
    ctx: AuthContext = Depends(get_current_user),
):
    _check_admin(ctx.user)

    # Verify tournament exists
    t_result = await ctx.session.execute(select(Tournament).where(Tournament.id == tournament_id))
    if not t_result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tournament not found",
        )

    # Verify athlete exists
    a_result = await ctx.session.execute(select(Athlete).where(Athlete.id == data.athlete_id))
    athlete = a_result.scalar_one_or_none()
    if not athlete:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Athlete not found",
        )

    # Check for duplicate result
    dup_result = await ctx.session.execute(
        select(TournamentResult).where(
            TournamentResult.tournament_id == tournament_id,
            TournamentResult.athlete_id == data.athlete_id,
            TournamentResult.weight_category == data.weight_category,
            TournamentResult.age_category == data.age_category,
        )
    )
    if dup_result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Result already exists for this athlete in this category",
        )

    result = TournamentResult(
        tournament_id=tournament_id,
        athlete_id=data.athlete_id,
        weight_category=data.weight_category,
        age_category=data.age_category,
        place=data.place,
        rating_points_earned=data.rating_points_earned,
    )
    ctx.session.add(result)
    await ctx.session.flush()

    # Update athlete rating points
    athlete.rating_points += data.rating_points_earned
    ctx.session.add(athlete)
    await ctx.session.commit()

    return TournamentResultRead(
        id=result.id,
        tournament_id=result.tournament_id,
        athlete_id=result.athlete_id,
        athlete_name=athlete.full_name,
        city=athlete.city,
        weight_category=result.weight_category,
        age_category=result.age_category,
        place=result.place,
        rating_points_earned=result.rating_points_earned,
    )
