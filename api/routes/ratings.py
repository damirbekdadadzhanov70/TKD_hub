from fastapi import APIRouter, Depends, Query
from sqlalchemy import select

from api.dependencies import AuthContext, get_current_user
from api.schemas.pagination import PaginatedResponse
from api.schemas.rating import RatingEntry
from api.utils.pagination import paginate_query
from db.models import Athlete

router = APIRouter()


@router.get("/ratings", response_model=PaginatedResponse[RatingEntry])
async def get_ratings(
    city: str | None = Query(None, max_length=100),
    weight_category: str | None = Query(None, max_length=50),
    gender: str | None = Query(None, max_length=10),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
    ctx: AuthContext = Depends(get_current_user),
):
    query = select(Athlete).where(Athlete.is_active.is_(True)).order_by(Athlete.rating_points.desc())
    if city:
        query = query.where(Athlete.city == city)
    if weight_category:
        query = query.where(Athlete.weight_category == weight_category)
    if gender:
        query = query.where(Athlete.gender == gender)

    athletes, total = await paginate_query(ctx.session, query, page, limit)

    items = [
        RatingEntry(
            rank=(page - 1) * limit + i + 1,
            athlete_id=a.id,
            full_name=a.full_name,
            gender=a.gender,
            country=a.country,
            city=a.city,
            club=a.club,
            weight_category=a.weight_category,
            sport_rank=a.sport_rank,
            rating_points=a.rating_points,
            photo_url=a.photo_url,
        )
        for i, a in enumerate(athletes)
    ]
    return PaginatedResponse(
        items=items,
        total=total,
        page=page,
        limit=limit,
        has_next=(page * limit) < total,
    )
