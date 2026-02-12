import uuid
from datetime import datetime

from aiogram import F, Router
from aiogram.fsm.context import FSMContext
from aiogram.types import CallbackQuery, Message

from bot.keyboards.registration import (
    belt_keyboard,
    club_skip_keyboard,
    country_keyboard,
    gender_keyboard,
    photo_skip_keyboard,
    weight_category_keyboard,
)
from bot.states.registration import AthleteRegistration, CoachRegistration
from bot.utils.callback import CallbackParseError, parse_callback
from bot.utils.helpers import t
from db.base import async_session
from db.models.athlete import Athlete
from db.models.coach import Coach
from db.models.role_request import RoleRequest

router = Router()


# ──────────────────────────────────────────────
#  ATHLETE REGISTRATION
# ──────────────────────────────────────────────


@router.message(AthleteRegistration.full_name)
async def athlete_full_name(message: Message, state: FSMContext):
    data = await state.get_data()
    lang = data.get("language", "ru")
    await state.update_data(full_name=message.text.strip())
    await message.answer(t("enter_dob", lang))
    await state.set_state(AthleteRegistration.date_of_birth)


@router.message(AthleteRegistration.date_of_birth)
async def athlete_dob(message: Message, state: FSMContext):
    data = await state.get_data()
    lang = data.get("language", "ru")

    try:
        dob = datetime.strptime(message.text.strip(), "%d.%m.%Y").date()
    except ValueError:
        await message.answer(t("invalid_date", lang))
        return

    await state.update_data(date_of_birth=dob.isoformat())
    await message.answer(t("choose_gender", lang), reply_markup=gender_keyboard(lang))
    await state.set_state(AthleteRegistration.gender)


@router.callback_query(AthleteRegistration.gender, F.data.startswith("gender:"))
async def athlete_gender(callback: CallbackQuery, state: FSMContext):
    try:
        parts = parse_callback(callback.data, "gender")
    except CallbackParseError:
        await callback.answer("Error")
        return
    gender = parts[1]
    data = await state.get_data()
    lang = data.get("language", "ru")
    await state.update_data(gender=gender)

    await callback.message.edit_text(
        t("choose_weight_category", lang),
        reply_markup=weight_category_keyboard(gender),
    )
    await state.set_state(AthleteRegistration.weight_category)
    await callback.answer()


@router.callback_query(AthleteRegistration.weight_category, F.data.startswith("weight:"))
async def athlete_weight_category(callback: CallbackQuery, state: FSMContext):
    try:
        parts = parse_callback(callback.data, "weight")
    except CallbackParseError:
        await callback.answer("Error")
        return
    weight_cat = parts[1]
    data = await state.get_data()
    lang = data.get("language", "ru")
    await state.update_data(weight_category=weight_cat)

    await callback.message.edit_text(t("enter_current_weight", lang))
    await state.set_state(AthleteRegistration.current_weight)
    await callback.answer()


@router.message(AthleteRegistration.current_weight)
async def athlete_current_weight(message: Message, state: FSMContext):
    data = await state.get_data()
    lang = data.get("language", "ru")

    try:
        weight = float(message.text.strip().replace(",", "."))
        if weight <= 0 or weight > 300:
            raise ValueError
    except ValueError:
        await message.answer(t("invalid_weight", lang))
        return

    await state.update_data(current_weight=weight)
    await message.answer(t("choose_belt", lang), reply_markup=belt_keyboard())
    await state.set_state(AthleteRegistration.belt)


@router.callback_query(AthleteRegistration.belt, F.data.startswith("belt:"))
async def athlete_belt(callback: CallbackQuery, state: FSMContext):
    try:
        parts = parse_callback(callback.data, "belt")
    except CallbackParseError:
        await callback.answer("Error")
        return
    belt = parts[1]
    data = await state.get_data()
    lang = data.get("language", "ru")
    await state.update_data(belt=belt)

    await callback.message.edit_text(
        t("choose_country", lang),
        reply_markup=country_keyboard(lang),
    )
    await state.set_state(AthleteRegistration.country)
    await callback.answer()


@router.callback_query(AthleteRegistration.country, F.data.startswith("country:"))
async def athlete_country(callback: CallbackQuery, state: FSMContext):
    try:
        parts = parse_callback(callback.data, "country")
    except CallbackParseError:
        await callback.answer("Error")
        return
    country = parts[1]
    data = await state.get_data()
    lang = data.get("language", "ru")

    if country == "other":
        await callback.message.edit_text(t("enter_country", lang))
        await state.set_state(AthleteRegistration.country_custom)
        await callback.answer()
        return

    await state.update_data(country=country)
    await callback.message.edit_text(t("enter_city", lang))
    await state.set_state(AthleteRegistration.city)
    await callback.answer()


@router.message(AthleteRegistration.country_custom)
async def athlete_country_custom(message: Message, state: FSMContext):
    data = await state.get_data()
    lang = data.get("language", "ru")
    await state.update_data(country=message.text.strip())
    await message.answer(t("enter_city", lang))
    await state.set_state(AthleteRegistration.city)


@router.message(AthleteRegistration.city)
async def athlete_city(message: Message, state: FSMContext):
    data = await state.get_data()
    lang = data.get("language", "ru")
    await state.update_data(city=message.text.strip())
    await message.answer(
        t("enter_club", lang),
        reply_markup=club_skip_keyboard(lang),
    )
    await state.set_state(AthleteRegistration.club)


@router.callback_query(AthleteRegistration.club, F.data == "club:skip")
async def athlete_club_skip(callback: CallbackQuery, state: FSMContext):
    data = await state.get_data()
    lang = data.get("language", "ru")
    await state.update_data(club=None)
    await callback.message.edit_text(
        t("send_photo", lang),
        reply_markup=photo_skip_keyboard(lang),
    )
    await state.set_state(AthleteRegistration.photo)
    await callback.answer()


@router.message(AthleteRegistration.club)
async def athlete_club_text(message: Message, state: FSMContext):
    data = await state.get_data()
    lang = data.get("language", "ru")
    await state.update_data(club=message.text.strip())
    await message.answer(
        t("send_photo", lang),
        reply_markup=photo_skip_keyboard(lang),
    )
    await state.set_state(AthleteRegistration.photo)


@router.callback_query(AthleteRegistration.photo, F.data == "photo:skip")
async def athlete_photo_skip(callback: CallbackQuery, state: FSMContext):
    await state.update_data(photo_url=None)
    await _save_athlete(callback.message, state)
    await callback.answer()


@router.message(AthleteRegistration.photo, F.photo)
async def athlete_photo_upload(message: Message, state: FSMContext):
    photo = message.photo[-1]
    file = await message.bot.get_file(photo.file_id)
    await state.update_data(photo_url=file.file_path)
    await _save_athlete(message, state)


async def _save_athlete(message: Message, state: FSMContext):
    data = await state.get_data()
    lang = data.get("language", "ru")
    user_id = uuid.UUID(data["user_id"])

    async with async_session() as session:
        athlete = Athlete(
            user_id=user_id,
            full_name=data["full_name"],
            date_of_birth=datetime.fromisoformat(data["date_of_birth"]).date(),
            gender=data["gender"],
            weight_category=data["weight_category"],
            current_weight=data["current_weight"],
            belt=data["belt"],
            country=data["country"],
            city=data["city"],
            club=data.get("club"),
            photo_url=data.get("photo_url"),
        )
        session.add(athlete)
        await session.commit()

    await state.clear()
    await message.answer(t("profile_created", lang))


# ──────────────────────────────────────────────
#  COACH REGISTRATION
# ──────────────────────────────────────────────


@router.message(CoachRegistration.full_name)
async def coach_full_name(message: Message, state: FSMContext):
    data = await state.get_data()
    lang = data.get("language", "ru")
    await state.update_data(full_name=message.text.strip())
    await message.answer(t("enter_dob", lang))
    await state.set_state(CoachRegistration.date_of_birth)


@router.message(CoachRegistration.date_of_birth)
async def coach_dob(message: Message, state: FSMContext):
    data = await state.get_data()
    lang = data.get("language", "ru")

    try:
        dob = datetime.strptime(message.text.strip(), "%d.%m.%Y").date()
    except ValueError:
        await message.answer(t("invalid_date", lang))
        return

    await state.update_data(date_of_birth=dob.isoformat())
    await message.answer(t("choose_gender", lang), reply_markup=gender_keyboard(lang))
    await state.set_state(CoachRegistration.gender)


@router.callback_query(CoachRegistration.gender, F.data.startswith("gender:"))
async def coach_gender(callback: CallbackQuery, state: FSMContext):
    try:
        parts = parse_callback(callback.data, "gender")
    except CallbackParseError:
        await callback.answer("Error")
        return
    gender = parts[1]
    data = await state.get_data()
    lang = data.get("language", "ru")
    await state.update_data(gender=gender)

    await callback.message.edit_text(
        t("choose_country", lang),
        reply_markup=country_keyboard(lang),
    )
    await state.set_state(CoachRegistration.country)
    await callback.answer()


@router.callback_query(CoachRegistration.country, F.data.startswith("country:"))
async def coach_country(callback: CallbackQuery, state: FSMContext):
    try:
        parts = parse_callback(callback.data, "country")
    except CallbackParseError:
        await callback.answer("Error")
        return
    country = parts[1]
    data = await state.get_data()
    lang = data.get("language", "ru")

    if country == "other":
        await callback.message.edit_text(t("enter_country", lang))
        await state.set_state(CoachRegistration.country_custom)
        await callback.answer()
        return

    await state.update_data(country=country)
    await callback.message.edit_text(t("enter_city", lang))
    await state.set_state(CoachRegistration.city)
    await callback.answer()


@router.message(CoachRegistration.country_custom)
async def coach_country_custom(message: Message, state: FSMContext):
    data = await state.get_data()
    lang = data.get("language", "ru")
    await state.update_data(country=message.text.strip())
    await message.answer(t("enter_city", lang))
    await state.set_state(CoachRegistration.city)


@router.message(CoachRegistration.city)
async def coach_city(message: Message, state: FSMContext):
    data = await state.get_data()
    lang = data.get("language", "ru")
    await state.update_data(city=message.text.strip())
    await message.answer(t("enter_club", lang))
    await state.set_state(CoachRegistration.club)


@router.message(CoachRegistration.club)
async def coach_club(message: Message, state: FSMContext):
    data = await state.get_data()
    lang = data.get("language", "ru")
    await state.update_data(club=message.text.strip())
    await message.answer(t("enter_qualification", lang))
    await state.set_state(CoachRegistration.qualification)


@router.message(CoachRegistration.qualification)
async def coach_qualification(message: Message, state: FSMContext):
    data = await state.get_data()
    lang = data.get("language", "ru")
    await state.update_data(qualification=message.text.strip())
    await message.answer(
        t("send_photo", lang),
        reply_markup=photo_skip_keyboard(lang),
    )
    await state.set_state(CoachRegistration.photo)


@router.callback_query(CoachRegistration.photo, F.data == "photo:skip")
async def coach_photo_skip(callback: CallbackQuery, state: FSMContext):
    await state.update_data(photo_url=None)
    await _save_coach(callback.message, state)
    await callback.answer()


@router.message(CoachRegistration.photo, F.photo)
async def coach_photo_upload(message: Message, state: FSMContext):
    photo = message.photo[-1]
    file = await message.bot.get_file(photo.file_id)
    await state.update_data(photo_url=file.file_path)
    await _save_coach(message, state)


async def _save_coach(message: Message, state: FSMContext):
    data = await state.get_data()
    lang = data.get("language", "ru")
    user_id = uuid.UUID(data["user_id"])

    async with async_session() as session:
        coach = Coach(
            user_id=user_id,
            full_name=data["full_name"],
            date_of_birth=datetime.fromisoformat(data["date_of_birth"]).date(),
            gender=data["gender"],
            country=data["country"],
            city=data["city"],
            club=data["club"],
            qualification=data["qualification"],
            photo_url=data.get("photo_url"),
            is_verified=False,
        )
        session.add(coach)

        role_request = RoleRequest(
            user_id=user_id,
            requested_role="coach",
            status="pending",
        )
        session.add(role_request)
        await session.commit()

    await state.clear()
    await message.answer(t("coach_request_sent", lang))
