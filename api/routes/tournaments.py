import uuid

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.orm import selectinload

from api.dependencies import AuthContext, get_current_user
from api.schemas.tournament import (
    TournamentEntryRead,
    TournamentListItem,
    TournamentRead,
)
from db.models import Tournament, TournamentEntry

router = APIRouter()


@router.get("/tournaments", response_model=list[TournamentListItem])
async def list_tournaments(
    country: str | None = Query(None),
    status: str | None = Query(None),
    ctx: AuthContext = Depends(get_current_user),
):
    try:
        query = select(Tournament)
        if country:
            query = query.where(Tournament.country == country)
        if status:
            query = query.where(Tournament.status == status)
        query = query.order_by(Tournament.start_date.desc())

        result = await ctx.session.execute(query)
        tournaments = result.scalars().all()

        items = []
        for t in tournaments:
            count_result = await ctx.session.execute(
                select(func.count()).where(TournamentEntry.tournament_id == t.id)
            )
            entry_count = count_result.scalar() or 0
            items.append(
                TournamentListItem(
                    id=t.id,
                    name=t.name,
                    start_date=t.start_date,
                    end_date=t.end_date,
                    city=t.city,
                    country=t.country,
                    status=t.status,
                    importance_level=t.importance_level,
                    entry_count=entry_count,
                )
            )
        return items
    finally:
        await ctx.session.close()


@router.get("/tournaments/{tournament_id}", response_model=TournamentRead)
async def get_tournament(
    tournament_id: uuid.UUID,
    ctx: AuthContext = Depends(get_current_user),
):
    try:
        result = await ctx.session.execute(
            select(Tournament)
            .where(Tournament.id == tournament_id)
            .options(selectinload(Tournament.entries).selectinload(TournamentEntry.athlete))
        )
        tournament = result.scalar_one_or_none()
        if not tournament:
            from fastapi import HTTPException, status
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tournament not found")

        entries = [
            TournamentEntryRead(
                id=e.id,
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
    finally:
        await ctx.session.close()
