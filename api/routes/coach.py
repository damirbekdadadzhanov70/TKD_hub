import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from api.dependencies import AuthContext, get_current_user
from api.schemas.coach import CoachAthleteRead
from api.schemas.tournament import TournamentEntryCreate, TournamentEntryRead
from db.models import Athlete, CoachAthlete, Tournament, TournamentEntry

router = APIRouter()


@router.get("/coach/athletes", response_model=list[CoachAthleteRead])
async def list_coach_athletes(
    ctx: AuthContext = Depends(get_current_user),
):
    try:
        if not ctx.user.coach:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only coaches can access this endpoint",
            )

        result = await ctx.session.execute(
            select(CoachAthlete)
            .where(
                CoachAthlete.coach_id == ctx.user.coach.id,
                CoachAthlete.status == "accepted",
            )
            .options(selectinload(CoachAthlete.athlete))
        )
        links = result.scalars().all()

        return [
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
    finally:
        await ctx.session.close()


@router.post(
    "/coach/tournaments/{tournament_id}/enter",
    response_model=TournamentEntryRead,
    status_code=status.HTTP_201_CREATED,
)
async def enter_athlete_to_tournament(
    tournament_id: uuid.UUID,
    data: TournamentEntryCreate,
    ctx: AuthContext = Depends(get_current_user),
):
    try:
        if not ctx.user.coach:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only coaches can enter athletes",
            )

        # Verify coach-athlete link
        link_result = await ctx.session.execute(
            select(CoachAthlete).where(
                CoachAthlete.coach_id == ctx.user.coach.id,
                CoachAthlete.athlete_id == data.athlete_id,
                CoachAthlete.status == "accepted",
            )
        )
        if not link_result.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Athlete is not linked to this coach",
            )

        # Verify tournament exists
        t_result = await ctx.session.execute(
            select(Tournament).where(Tournament.id == tournament_id)
        )
        tournament = t_result.scalar_one_or_none()
        if not tournament:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Tournament not found",
            )

        # Get athlete for name
        a_result = await ctx.session.execute(
            select(Athlete).where(Athlete.id == data.athlete_id)
        )
        athlete = a_result.scalar_one_or_none()
        if not athlete:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Athlete not found",
            )

        entry = TournamentEntry(
            tournament_id=tournament_id,
            athlete_id=data.athlete_id,
            coach_id=ctx.user.coach.id,
            weight_category=data.weight_category,
            age_category=data.age_category,
        )
        ctx.session.add(entry)
        await ctx.session.commit()
        await ctx.session.refresh(entry)

        return TournamentEntryRead(
            id=entry.id,
            athlete_name=athlete.full_name,
            weight_category=entry.weight_category,
            age_category=entry.age_category,
            status=entry.status,
        )
    finally:
        await ctx.session.close()
