from fastapi import APIRouter, Depends, Query
from sqlalchemy import select

from api.dependencies import AuthContext, get_current_user
from api.schemas.rating import RatingEntry
from db.models import Athlete

router = APIRouter()


@router.get("/ratings", response_model=list[RatingEntry])
async def get_ratings(
    country: str | None = Query(None),
    weight_category: str | None = Query(None),
    gender: str | None = Query(None),
    limit: int = Query(50, ge=1, le=200),
    ctx: AuthContext = Depends(get_current_user),
):
    try:
        query = (
            select(Athlete)
            .where(Athlete.is_active.is_(True))
            .order_by(Athlete.rating_points.desc())
        )
        if country:
            query = query.where(Athlete.country == country)
        if weight_category:
            query = query.where(Athlete.weight_category == weight_category)
        if gender:
            query = query.where(Athlete.gender == gender)
        query = query.limit(limit)

        result = await ctx.session.execute(query)
        athletes = result.scalars().all()

        return [
            RatingEntry(
                rank=i + 1,
                athlete_id=a.id,
                full_name=a.full_name,
                country=a.country,
                city=a.city,
                club=a.club,
                weight_category=a.weight_category,
                belt=a.belt,
                rating_points=a.rating_points,
                photo_url=a.photo_url,
            )
            for i, a in enumerate(athletes)
        ]
    finally:
        await ctx.session.close()
