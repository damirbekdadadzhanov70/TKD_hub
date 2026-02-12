from fastapi import APIRouter, Depends

from api.dependencies import AuthContext, get_current_user
from api.schemas.athlete import AthleteRead, AthleteUpdate
from api.schemas.coach import CoachRead
from api.schemas.user import MeResponse

router = APIRouter()


@router.get("/me", response_model=MeResponse)
async def get_me(ctx: AuthContext = Depends(get_current_user)):
    try:
        user = ctx.user
        role = "none"
        athlete_data = None
        coach_data = None

        if user.athlete:
            role = "athlete"
            athlete_data = AthleteRead.model_validate(user.athlete)
        if user.coach:
            role = "coach"
            coach_data = CoachRead.model_validate(user.coach)

        return MeResponse(
            telegram_id=user.telegram_id,
            username=user.username,
            language=user.language,
            role=role,
            athlete=athlete_data,
            coach=coach_data,
        )
    finally:
        await ctx.session.close()


@router.put("/me", response_model=MeResponse)
async def update_me(
    update: AthleteUpdate,
    ctx: AuthContext = Depends(get_current_user),
):
    try:
        user = ctx.user
        if not user.athlete:
            from fastapi import HTTPException, status
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Only athletes can update profile via this endpoint",
            )

        athlete = user.athlete
        update_data = update.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(athlete, field, value)

        ctx.session.add(athlete)
        await ctx.session.commit()
        await ctx.session.refresh(athlete)

        role = "athlete"
        coach_data = None
        if user.coach:
            coach_data = CoachRead.model_validate(user.coach)

        return MeResponse(
            telegram_id=user.telegram_id,
            username=user.username,
            language=user.language,
            role=role,
            athlete=AthleteRead.model_validate(athlete),
            coach=coach_data,
        )
    finally:
        await ctx.session.close()
