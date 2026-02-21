import logging
import os
import uuid
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, status
from sqlalchemy import func, select
from sqlalchemy.orm import selectinload

from api.dependencies import AuthContext, get_current_user
from api.schemas.pagination import PaginatedResponse
from api.schemas.tournament import (
    CsvProcessingSummary,
    TournamentBatchEnter,
    TournamentCreate,
    TournamentEntryRead,
    TournamentFileRead,
    TournamentFileUploadResponse,
    TournamentInterestResponse,
    TournamentListItem,
    TournamentRead,
    TournamentResultCreate,
    TournamentResultRead,
    TournamentUpdate,
)
from api.utils.csv_results import calculate_points, extract_match_name, normalize_name, normalize_weight, parse_csv
from api.utils.pagination import paginate_query
from bot.config import settings
from bot.utils.notifications import (
    create_notification,
    notify_athlete_interest,
    notify_coach_athlete_interest,
    notify_coach_entry_status,
)
from db.models import (
    Athlete,
    Coach,
    CoachAthlete,
    Tournament,
    TournamentEntry,
    TournamentFile,
    TournamentInterest,
    TournamentResult,
)

logger = logging.getLogger(__name__)

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


@router.post(
    "/tournaments",
    response_model=TournamentListItem,
    status_code=status.HTTP_201_CREATED,
)
async def create_tournament(
    data: TournamentCreate,
    ctx: AuthContext = Depends(get_current_user),
):
    _check_admin(ctx.user)

    tournament = Tournament(
        name=data.name,
        description=data.description,
        start_date=data.start_date,
        end_date=data.end_date,
        city=data.city,
        country="Россия",
        venue=data.venue,
        age_categories=data.age_categories,
        weight_categories=data.weight_categories,
        entry_fee=data.entry_fee,
        currency=data.currency,
        registration_deadline=data.registration_deadline,
        importance_level=data.importance_level,
        photos_url=data.photos_url,
        results_url=data.results_url,
        organizer_name=data.organizer_name,
        organizer_phone=data.organizer_phone,
        organizer_telegram=data.organizer_telegram,
        status="upcoming",
        created_by=ctx.user.id,
    )
    ctx.session.add(tournament)
    await ctx.session.commit()
    await ctx.session.refresh(tournament)

    return TournamentListItem(
        id=tournament.id,
        name=tournament.name,
        start_date=tournament.start_date,
        end_date=tournament.end_date,
        city=tournament.city,
        country=tournament.country,
        status=tournament.status,
        importance_level=tournament.importance_level,
        entry_count=0,
    )


@router.delete(
    "/tournaments/{tournament_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_tournament(
    tournament_id: uuid.UUID,
    ctx: AuthContext = Depends(get_current_user),
):
    _check_admin(ctx.user)

    result = await ctx.session.execute(
        select(Tournament).where(Tournament.id == tournament_id).options(selectinload(Tournament.files))
    )
    tournament = result.scalar_one_or_none()
    if not tournament:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tournament not found",
        )

    # Clean up blob files before cascade delete
    for f in tournament.files:
        await _delete_from_vercel_blob(f.blob_url)

    await ctx.session.delete(tournament)
    await ctx.session.commit()


@router.put("/tournaments/{tournament_id}", response_model=TournamentRead)
async def update_tournament(
    tournament_id: uuid.UUID,
    data: TournamentUpdate,
    ctx: AuthContext = Depends(get_current_user),
):
    _check_admin(ctx.user)

    result = await ctx.session.execute(
        select(Tournament).where(Tournament.id == tournament_id).options(*_load_tournament_options())
    )
    tournament = result.scalar_one_or_none()
    if not tournament:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tournament not found",
        )

    update_data = data.model_dump(exclude_unset=True)
    old_importance = tournament.importance_level
    new_importance = update_data.get("importance_level", old_importance)

    for field, value in update_data.items():
        setattr(tournament, field, value)

    # Recalculate rating points if importance_level changed
    if new_importance != old_importance:
        res = await ctx.session.execute(
            select(TournamentResult)
            .where(TournamentResult.tournament_id == tournament_id)
            .options(selectinload(TournamentResult.athlete))
        )
        for r in res.scalars().all():
            old_pts = r.rating_points_earned
            new_pts = calculate_points(r.place, new_importance)
            if r.athlete:
                r.athlete.rating_points = max(0, r.athlete.rating_points - old_pts) + new_pts
            r.rating_points_earned = new_pts

    await ctx.session.commit()
    await ctx.session.refresh(tournament)

    return _build_tournament_read(tournament)


def _build_tournament_read(tournament) -> TournamentRead:
    """Build TournamentRead from a loaded Tournament ORM object."""
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

    results = [
        TournamentResultRead(
            id=r.id,
            tournament_id=r.tournament_id,
            athlete_id=r.athlete_id,
            athlete_name=r.athlete.full_name if r.athlete else (r.raw_full_name or "?"),
            city=r.athlete.city if r.athlete else "",
            weight_category=r.weight_category,
            age_category=r.age_category,
            gender=r.gender,
            place=r.place,
            rating_points_earned=r.rating_points_earned,
            is_matched=r.athlete_id is not None,
        )
        for r in tournament.results
    ]

    files = [
        TournamentFileRead(
            id=f.id,
            tournament_id=f.tournament_id,
            category=f.category,
            filename=f.filename,
            blob_url=f.blob_url,
            file_size=f.file_size,
            file_type=f.file_type,
            created_at=f.created_at.isoformat() if f.created_at else "",
        )
        for f in tournament.files
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
        photos_url=tournament.photos_url,
        results_url=tournament.results_url,
        organizer_name=tournament.organizer_name,
        organizer_phone=tournament.organizer_phone,
        organizer_telegram=tournament.organizer_telegram,
        status=tournament.status,
        importance_level=tournament.importance_level,
        entries=entries,
        results=results,
        files=files,
    )


def _load_tournament_options():
    """Common selectinload options for tournament detail queries."""
    return [
        selectinload(Tournament.entries).selectinload(TournamentEntry.athlete),
        selectinload(Tournament.entries).selectinload(TournamentEntry.coach),
        selectinload(Tournament.results).selectinload(TournamentResult.athlete),
        selectinload(Tournament.files),
    ]


@router.get("/tournaments/{tournament_id}", response_model=TournamentRead)
async def get_tournament(
    tournament_id: uuid.UUID,
    ctx: AuthContext = Depends(get_current_user),
):
    result = await ctx.session.execute(
        select(Tournament).where(Tournament.id == tournament_id).options(*_load_tournament_options())
    )
    tournament = result.scalar_one_or_none()
    if not tournament:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tournament not found")

    return _build_tournament_read(tournament)


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
    tournament = t_result.scalar_one_or_none()
    if not tournament:
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

    # In-app notification for athlete
    await create_notification(
        ctx.session,
        user_id=ctx.user.id,
        type="interest_confirmed",
        title="Интерес отмечен",
        body=f"Вы отметили интерес к турниру {tournament.name}.",
        role="athlete",
    )

    # In-app notification for coach if linked
    coach_link_pre = await ctx.session.execute(
        select(CoachAthlete)
        .where(CoachAthlete.athlete_id == ctx.user.athlete.id, CoachAthlete.status == "accepted")
        .options(selectinload(CoachAthlete.coach).selectinload(Coach.user))
    )
    coach_link_pre_row = coach_link_pre.scalar_one_or_none()
    if coach_link_pre_row and coach_link_pre_row.coach and coach_link_pre_row.coach.user:
        await create_notification(
            ctx.session,
            user_id=coach_link_pre_row.coach.user.id,
            type="coach_athlete_interest",
            title="Спортсмен заинтересован",
            body=f"{ctx.user.athlete.full_name} заинтересован в турнире {tournament.name}.",
            role="coach",
        )

    await ctx.session.commit()

    # Notify athlete and their coach via Telegram
    user = ctx.user
    athlete = user.athlete
    lang = user.language or "ru"
    try:
        from api.utils import create_bot

        bot = create_bot()
        try:
            # Notify athlete
            await notify_athlete_interest(
                bot,
                athlete_telegram_id=user.telegram_id,
                tournament_name=tournament.name,
                lang=lang,
            )

            # Notify coach if athlete has one
            coach_link_result = await ctx.session.execute(
                select(CoachAthlete)
                .where(
                    CoachAthlete.athlete_id == athlete.id,
                    CoachAthlete.status == "accepted",
                )
                .options(selectinload(CoachAthlete.coach).selectinload(Coach.user))
            )
            coach_link = coach_link_result.scalar_one_or_none()
            if coach_link and coach_link.coach and coach_link.coach.user:
                coach_user = coach_link.coach.user
                await notify_coach_athlete_interest(
                    bot,
                    coach_telegram_id=coach_user.telegram_id,
                    athlete_name=athlete.full_name,
                    tournament_name=tournament.name,
                    lang=coach_user.language or "ru",
                )
        finally:
            await bot.session.close()
    except Exception:
        logger.exception("Failed to send interest notifications for athlete %s", athlete.id)

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


async def _notify_coach_entries(session, coach_id, tournament_id, entries, entry_status: str):
    """Send notification to coach about entry approval/rejection."""
    try:
        # Get coach's telegram_id and language
        coach_result = await session.execute(
            select(Coach).where(Coach.id == coach_id).options(selectinload(Coach.user))
        )
        coach = coach_result.scalar_one_or_none()
        if not coach or not coach.user:
            return

        # Get tournament name
        t_result = await session.execute(select(Tournament.name).where(Tournament.id == tournament_id))
        t_name = t_result.scalar_one_or_none() or "?"

        coach_tid = coach.user.telegram_id
        lang = coach.user.language or "ru"

        from api.utils import create_bot

        bot = create_bot()
        try:
            for entry in entries:
                athlete_name = entry.athlete.full_name if entry.athlete else "?"
                await notify_coach_entry_status(
                    bot,
                    coach_telegram_id=coach_tid,
                    tournament_name=t_name,
                    athlete_name=athlete_name,
                    status=entry_status,
                    lang=lang,
                )
        finally:
            await bot.session.close()
    except Exception:
        logger.exception("Failed to notify coach %s about entry %s", coach_id, entry_status)


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
        select(TournamentEntry)
        .where(
            TournamentEntry.tournament_id == tournament_id,
            TournamentEntry.coach_id == coach_id,
        )
        .options(
            selectinload(TournamentEntry.athlete).selectinload(Athlete.user),
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

    # In-app notification for coach
    coach_result = await ctx.session.execute(
        select(Coach).where(Coach.id == coach_id).options(selectinload(Coach.user))
    )
    coach_obj = coach_result.scalar_one_or_none()
    t_result_q = await ctx.session.execute(select(Tournament.name).where(Tournament.id == tournament_id))
    t_name_q = t_result_q.scalar_one_or_none() or "?"
    if coach_obj and coach_obj.user:
        for entry in entries:
            a_name = entry.athlete.full_name if entry.athlete else "?"
            await create_notification(
                ctx.session,
                user_id=coach_obj.user.id,
                type="entry_approved",
                title="Заявка одобрена",
                body=f"Заявка на {t_name_q} ({a_name}) одобрена.",
                role="coach",
            )

    # In-app notification for each athlete
    for entry in entries:
        if entry.athlete and entry.athlete.user:
            await create_notification(
                ctx.session,
                user_id=entry.athlete.user.id,
                type="entry_approved",
                title="Заявка одобрена",
                body=f"Ваша заявка на турнир {t_name_q} одобрена.",
                role="athlete",
            )

    await ctx.session.commit()

    # Notify coach about approval via Telegram
    await _notify_coach_entries(ctx.session, coach_id, tournament_id, entries, "approved")


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
        select(TournamentEntry)
        .where(
            TournamentEntry.tournament_id == tournament_id,
            TournamentEntry.coach_id == coach_id,
        )
        .options(
            selectinload(TournamentEntry.athlete).selectinload(Athlete.user),
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

    # In-app notification for coach
    coach_result2 = await ctx.session.execute(
        select(Coach).where(Coach.id == coach_id).options(selectinload(Coach.user))
    )
    coach_obj2 = coach_result2.scalar_one_or_none()
    t_result_q2 = await ctx.session.execute(select(Tournament.name).where(Tournament.id == tournament_id))
    t_name_q2 = t_result_q2.scalar_one_or_none() or "?"
    if coach_obj2 and coach_obj2.user:
        for entry in entries:
            a_name = entry.athlete.full_name if entry.athlete else "?"
            await create_notification(
                ctx.session,
                user_id=coach_obj2.user.id,
                type="entry_rejected",
                title="Заявка отклонена",
                body=f"Заявка на {t_name_q2} ({a_name}) отклонена.",
                role="coach",
            )

    # In-app notification for each athlete
    for entry in entries:
        if entry.athlete and entry.athlete.user:
            await create_notification(
                ctx.session,
                user_id=entry.athlete.user.id,
                type="entry_rejected",
                title="Заявка отклонена",
                body=f"Ваша заявка на турнир {t_name_q2} отклонена.",
                role="athlete",
            )

    await ctx.session.commit()

    # Notify coach about rejection via Telegram
    await _notify_coach_entries(ctx.session, coach_id, tournament_id, entries, "rejected")


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
            athlete_name=r.athlete.full_name if r.athlete else (r.raw_full_name or "?"),
            city=r.athlete.city if r.athlete else "",
            weight_category=r.weight_category,
            age_category=r.age_category,
            gender=r.gender,
            place=r.place,
            rating_points_earned=r.rating_points_earned,
            is_matched=r.athlete_id is not None,
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
        gender=data.gender or athlete.gender,
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
        gender=result.gender,
        place=result.place,
        rating_points_earned=result.rating_points_earned,
    )


# ── Tournament Files ────────────────────────────────────────

MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB
MAX_FILES_PER_TOURNAMENT = 10
PDF_MAGIC = b"%PDF"
ALLOWED_FILE_CATEGORIES = {"protocol", "bracket", "regulations"}
CSV_CONTENT_TYPES = {"text/csv", "application/csv", "application/vnd.ms-excel"}


async def _upload_to_vercel_blob(filename: str, content: bytes, content_type: str) -> str:
    """Upload file to Vercel Blob and return the public URL."""
    import httpx

    token = os.environ.get("BLOB_READ_WRITE_TOKEN", "")
    if not token:
        raise HTTPException(status_code=500, detail="Blob storage not configured")

    async with httpx.AsyncClient() as client:
        resp = await client.put(
            f"https://blob.vercel-storage.com/{filename}",
            content=content,
            headers={
                "Authorization": f"Bearer {token}",
                "x-content-type": content_type,
                "x-api-version": "7",
            },
            timeout=30,
        )
        if resp.status_code not in (200, 201):
            logger.error("Vercel Blob upload failed: %s %s", resp.status_code, resp.text)
            raise HTTPException(status_code=502, detail="File upload failed")
        return resp.json()["url"]


async def _delete_from_vercel_blob(blob_url: str) -> None:
    """Delete a file from Vercel Blob."""
    import httpx

    token = os.environ.get("BLOB_READ_WRITE_TOKEN", "")
    if not token:
        return

    try:
        async with httpx.AsyncClient() as client:
            await client.post(
                "https://blob.vercel-storage.com/delete",
                json={"urls": [blob_url]},
                headers={
                    "Authorization": f"Bearer {token}",
                    "x-api-version": "7",
                },
                timeout=15,
            )
    except Exception:
        logger.exception("Failed to delete blob: %s", blob_url)


@router.get(
    "/tournaments/{tournament_id}/files",
    response_model=list[TournamentFileRead],
)
async def list_tournament_files(
    tournament_id: uuid.UUID,
    ctx: AuthContext = Depends(get_current_user),
):
    t_result = await ctx.session.execute(select(Tournament).where(Tournament.id == tournament_id))
    if not t_result.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tournament not found")

    result = await ctx.session.execute(
        select(TournamentFile)
        .where(TournamentFile.tournament_id == tournament_id)
        .order_by(TournamentFile.created_at.desc())
    )
    files = result.scalars().all()

    return [
        TournamentFileRead(
            id=f.id,
            tournament_id=f.tournament_id,
            category=f.category,
            filename=f.filename,
            blob_url=f.blob_url,
            file_size=f.file_size,
            file_type=f.file_type,
            created_at=f.created_at.isoformat() if f.created_at else "",
        )
        for f in files
    ]


def _is_csv_file(file: UploadFile) -> bool:
    """Check if an uploaded file is CSV."""
    if file.content_type in CSV_CONTENT_TYPES:
        return True
    fname = (file.filename or "").lower()
    return fname.endswith(".csv")


def _is_pdf_file(file: UploadFile, content: bytes) -> bool:
    """Check if an uploaded file is PDF."""
    return file.content_type == "application/pdf" or content[:4].startswith(PDF_MAGIC)


async def _process_csv_results(
    session, tournament_id: uuid.UUID, content: bytes, importance_level: int
) -> CsvProcessingSummary:
    """Parse CSV and create TournamentResult rows, matching athletes where possible."""
    rows = parse_csv(content)
    if not rows:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="CSV file is empty or has invalid format",
        )

    # Load all athletes for matching
    athletes_result = await session.execute(select(Athlete))
    all_athletes = athletes_result.scalars().all()

    # Build lookups: exact (name+weight) and name-only (for different weight class)
    exact_lookup: dict[tuple[str, str], Athlete] = {}
    name_lookup: dict[str, list[Athlete]] = {}
    for a in all_athletes:
        norm = normalize_name(extract_match_name(a.full_name))
        exact_lookup[(norm, normalize_weight(a.weight_category))] = a
        name_lookup.setdefault(norm, []).append(a)

    matched = 0
    unmatched = 0
    skipped = 0
    total_points = 0
    matched_details: list[dict[str, object]] = []
    scorable_rows = [r for r in rows if r.place <= 10]

    for row in scorable_rows:
        points = calculate_points(row.place, importance_level)
        norm_name = normalize_name(row.full_name)  # Already first two words
        norm_weight = normalize_weight(row.weight_category)

        # Try exact match (name + weight), then name-only
        athlete = exact_lookup.get((norm_name, norm_weight))
        if not athlete:
            candidates = name_lookup.get(norm_name, [])
            if len(candidates) == 1:
                athlete = candidates[0]

        # Check for duplicate (idempotency) — use raw_full_name for uniqueness
        existing = await session.execute(
            select(TournamentResult).where(
                TournamentResult.tournament_id == tournament_id,
                TournamentResult.raw_full_name == row.raw_full_name,
                TournamentResult.weight_category == row.weight_category,
            )
        )
        if existing.scalar_one_or_none():
            skipped += 1
            continue

        result = TournamentResult(
            tournament_id=tournament_id,
            athlete_id=athlete.id if athlete else None,
            weight_category=row.weight_category,
            age_category="",
            gender=row.gender or None,
            place=row.place,
            rating_points_earned=points,
            raw_full_name=row.raw_full_name,
            raw_weight_category=row.weight_category,
        )
        session.add(result)

        if athlete:
            athlete.rating_points += points
            matched += 1
            total_points += points
            matched_details.append(
                {
                    "name": athlete.full_name,
                    "points": points,
                    "place": row.place,
                }
            )
        else:
            unmatched += 1

    await session.flush()

    # If rows were skipped (re-upload), try to re-match previously unmatched + report all
    if skipped > 0:
        # Try to match previously unmatched results
        unmatched_q = await session.execute(
            select(TournamentResult).where(
                TournamentResult.tournament_id == tournament_id,
                TournamentResult.athlete_id.is_(None),
            )
        )
        newly_matched = 0
        for r in unmatched_q.scalars().all():
            r_norm = normalize_name(extract_match_name(r.raw_full_name or ""))
            r_weight = normalize_weight(r.raw_weight_category or r.weight_category)
            athlete = exact_lookup.get((r_norm, r_weight))
            if not athlete:
                candidates = name_lookup.get(r_norm, [])
                if len(candidates) == 1:
                    athlete = candidates[0]
            if athlete:
                r.athlete_id = athlete.id
                athlete.rating_points += r.rating_points_earned
                newly_matched += 1
        if newly_matched > 0:
            await session.flush()

        # Load all existing results for this tournament to report
        matched = 0
        unmatched = 0
        total_points = 0
        matched_details = []
        all_results = await session.execute(
            select(TournamentResult)
            .options(selectinload(TournamentResult.athlete))
            .where(TournamentResult.tournament_id == tournament_id)
        )
        for r in all_results.scalars().all():
            if r.athlete:
                matched += 1
                total_points += r.rating_points_earned
                matched_details.append(
                    {
                        "name": r.athlete.full_name,
                        "points": r.rating_points_earned,
                        "place": r.place,
                    }
                )
            else:
                unmatched += 1

    return CsvProcessingSummary(
        total_rows=len(scorable_rows),
        matched=matched,
        unmatched=unmatched,
        skipped=skipped,
        points_awarded=total_points,
        matched_details=matched_details,
    )


@router.post(
    "/tournaments/{tournament_id}/files",
    response_model=TournamentFileUploadResponse,
    status_code=status.HTTP_201_CREATED,
)
async def upload_tournament_file(
    tournament_id: uuid.UUID,
    file: UploadFile,
    category: str = Query("protocol", max_length=20),
    ctx: AuthContext = Depends(get_current_user),
):
    _check_admin(ctx.user)

    if category not in ALLOWED_FILE_CATEGORIES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid category. Allowed: {', '.join(ALLOWED_FILE_CATEGORIES)}",
        )

    # Verify tournament exists
    t_result = await ctx.session.execute(select(Tournament).where(Tournament.id == tournament_id))
    tournament = t_result.scalar_one_or_none()
    if not tournament:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tournament not found")

    # Check file count limit
    count_result = await ctx.session.execute(select(func.count()).where(TournamentFile.tournament_id == tournament_id))
    if count_result.scalar() >= MAX_FILES_PER_TOURNAMENT:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Maximum {MAX_FILES_PER_TOURNAMENT} files per tournament",
        )

    # Read file content
    content = await file.read()

    # Validate size
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File too large. Maximum 10 MB",
        )

    is_csv = _is_csv_file(file)
    is_pdf = _is_pdf_file(file, content)

    if not is_csv and not is_pdf:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only PDF or CSV files are allowed",
        )

    safe_filename = (file.filename or "document").replace("/", "_")
    content_type = "text/csv" if is_csv else "application/pdf"
    file_type = content_type

    # Upload to Vercel Blob
    blob_path = f"tournaments/{tournament_id}/{uuid.uuid4()}_{safe_filename}"
    blob_url = await _upload_to_vercel_blob(blob_path, content, content_type)

    # Save file record to DB
    db_file = TournamentFile(
        tournament_id=tournament_id,
        category=category,
        filename=safe_filename,
        blob_url=blob_url,
        file_size=len(content),
        file_type=file_type,
        uploaded_by=ctx.user.id,
    )
    ctx.session.add(db_file)

    # Process CSV results if applicable
    csv_summary = None
    if is_csv and category == "protocol":
        csv_summary = await _process_csv_results(ctx.session, tournament_id, content, tournament.importance_level)

    await ctx.session.commit()
    await ctx.session.refresh(db_file)

    return TournamentFileUploadResponse(
        id=db_file.id,
        tournament_id=db_file.tournament_id,
        category=db_file.category,
        filename=db_file.filename,
        blob_url=db_file.blob_url,
        file_size=db_file.file_size,
        file_type=db_file.file_type,
        created_at=db_file.created_at.isoformat() if db_file.created_at else "",
        csv_summary=csv_summary,
    )


@router.delete(
    "/tournaments/{tournament_id}/files/{file_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_tournament_file(
    tournament_id: uuid.UUID,
    file_id: uuid.UUID,
    ctx: AuthContext = Depends(get_current_user),
):
    _check_admin(ctx.user)

    result = await ctx.session.execute(
        select(TournamentFile).where(
            TournamentFile.id == file_id,
            TournamentFile.tournament_id == tournament_id,
        )
    )
    db_file = result.scalar_one_or_none()
    if not db_file:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found")

    # If deleting a CSV protocol, rollback rating points and remove results
    is_csv = db_file.filename.lower().endswith(".csv") and db_file.category == "protocol"
    if is_csv:
        # Load CSV-based results for this tournament
        csv_results = await ctx.session.execute(
            select(TournamentResult)
            .options(selectinload(TournamentResult.athlete))
            .where(
                TournamentResult.tournament_id == tournament_id,
                TournamentResult.raw_full_name.isnot(None),
            )
        )
        for r in csv_results.scalars().all():
            # Subtract points from matched athletes
            if r.athlete and r.rating_points_earned > 0:
                r.athlete.rating_points = max(0, r.athlete.rating_points - r.rating_points_earned)
            await ctx.session.delete(r)

    # Delete from Vercel Blob
    await _delete_from_vercel_blob(db_file.blob_url)

    # Delete from DB
    await ctx.session.delete(db_file)
    await ctx.session.commit()
