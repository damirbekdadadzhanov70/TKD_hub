from aiogram import F, Router
from aiogram.filters import Command
from aiogram.types import CallbackQuery, Message
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from bot.keyboards.my_athletes import athlete_detail_keyboard, athletes_list_keyboard
from bot.utils.callback import CallbackParseError, parse_callback, parse_callback_uuid
from bot.utils.helpers import t
from db.base import async_session
from db.models.athlete import Athlete
from db.models.coach import CoachAthlete
from db.models.user import User

router = Router()


async def _get_coach_and_lang(telegram_id: int):
    """Return (coach, lang) or (None, lang)."""
    async with async_session() as session:
        result = await session.execute(
            select(User).where(User.telegram_id == telegram_id).options(selectinload(User.coach))
        )
        user = result.scalar_one_or_none()

    if not user:
        return None, "ru"
    lang = user.language or "ru"
    if not user.coach or not user.coach.is_verified:
        return None, lang
    return user.coach, lang


async def _build_athletes_list(coach_id):
    """Return list of (athlete_id, full_name)."""
    async with async_session() as session:
        result = await session.execute(
            select(CoachAthlete)
            .where(
                CoachAthlete.coach_id == coach_id,
                CoachAthlete.status == "accepted",
            )
            .options(selectinload(CoachAthlete.athlete))
        )
        links = result.scalars().all()

    return [(link.athlete.id, link.athlete.full_name) for link in links]


@router.message(Command("my_athletes"))
async def cmd_my_athletes(message: Message):
    coach, lang = await _get_coach_and_lang(message.from_user.id)

    if not coach:
        await message.answer(t("not_a_verified_coach", lang))
        return

    athletes = await _build_athletes_list(coach.id)

    if not athletes:
        await message.answer(t("no_athletes", lang))
        return

    await message.answer(
        t("your_athletes", lang),
        reply_markup=athletes_list_keyboard(athletes, lang),
    )


@router.callback_query(F.data.startswith("view_athlete:"))
async def on_view_athlete(callback: CallbackQuery):
    coach, lang = await _get_coach_and_lang(callback.from_user.id)
    if not coach:
        await callback.answer()
        return

    try:
        _, athlete_id = parse_callback_uuid(callback.data, "view_athlete")
    except CallbackParseError:
        await callback.answer("Error")
        return

    async with async_session() as session:
        # Verify coach owns this athlete via CoachAthlete link
        link_result = await session.execute(
            select(CoachAthlete).where(
                CoachAthlete.coach_id == coach.id,
                CoachAthlete.athlete_id == athlete_id,
                CoachAthlete.status == "accepted",
            )
        )
        if not link_result.scalar_one_or_none():
            await callback.message.edit_text(t("athlete_not_found", lang))
            await callback.answer()
            return

        result = await session.execute(select(Athlete).where(Athlete.id == athlete_id))
        athlete = result.scalar_one_or_none()

    if not athlete:
        await callback.message.edit_text(t("athlete_not_found", lang))
        await callback.answer()
        return

    text = t("athlete_card", lang).format(
        name=athlete.full_name,
        dob=athlete.date_of_birth.strftime("%d.%m.%Y"),
        gender=t("gender_male", lang) if athlete.gender == "M" else t("gender_female", lang),
        weight_cat=athlete.weight_category,
        weight=athlete.current_weight,
        sport_rank=athlete.sport_rank,
        city=athlete.city,
        club=athlete.club or "—",
    )

    await callback.message.edit_text(text, reply_markup=athlete_detail_keyboard(athlete.id, lang))
    await callback.answer()


@router.callback_query(F.data.startswith("unlink_athlete:"))
async def on_unlink_athlete(callback: CallbackQuery):
    coach, lang = await _get_coach_and_lang(callback.from_user.id)
    if not coach:
        await callback.answer()
        return

    try:
        _, athlete_id = parse_callback_uuid(callback.data, "unlink_athlete")
    except CallbackParseError:
        await callback.answer("Error")
        return

    async with async_session() as session:
        result = await session.execute(
            select(CoachAthlete).where(
                CoachAthlete.coach_id == coach.id,
                CoachAthlete.athlete_id == athlete_id,
            )
        )
        link = result.scalar_one_or_none()
        if link:
            await session.delete(link)
            await session.commit()

    # Refresh the list
    athletes = await _build_athletes_list(coach.id)

    if not athletes:
        await callback.message.edit_text(t("athlete_unlinked_empty", lang))
    else:
        await callback.message.edit_text(
            t("athlete_unlinked", lang) + "\n\n" + t("your_athletes", lang),
            reply_markup=athletes_list_keyboard(athletes, lang),
        )
    await callback.answer()


@router.callback_query(F.data == "back_to_athletes")
async def on_back_to_athletes(callback: CallbackQuery):
    coach, lang = await _get_coach_and_lang(callback.from_user.id)
    if not coach:
        await callback.answer()
        return

    athletes = await _build_athletes_list(coach.id)

    if not athletes:
        await callback.message.edit_text(t("no_athletes", lang))
    else:
        await callback.message.edit_text(
            t("your_athletes", lang),
            reply_markup=athletes_list_keyboard(athletes, lang),
        )
    await callback.answer()
