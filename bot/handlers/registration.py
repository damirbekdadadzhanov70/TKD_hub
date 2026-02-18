import html
import uuid
from datetime import datetime

from aiogram import F, Router
from aiogram.fsm.context import FSMContext
from aiogram.types import CallbackQuery, Message

from bot.keyboards.registration import (
    RANK_LABELS,
    city_keyboard,
    club_skip_keyboard,
    gender_keyboard,
    photo_skip_keyboard,
    rank_keyboard,
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

MAX_NAME = 255
MAX_TEXT = 500
MAX_CITY = 100
MAX_CLUB = 255


def _check_len(text: str, max_len: int) -> str | None:
    """Return stripped text if within limit, else None."""
    stripped = text.strip()
    return stripped if len(stripped) <= max_len else None


# ──────────────────────────────────────────────
#  ATHLETE REGISTRATION
# ──────────────────────────────────────────────


@router.message(AthleteRegistration.full_name)
async def athlete_full_name(message: Message, state: FSMContext):
    data = await state.get_data()
    lang = data.get("language", "ru")
    name = _check_len(message.text, MAX_NAME)
    if not name:
        await message.answer(t("input_too_long", lang).format(max=MAX_NAME))
        return
    await state.update_data(full_name=html.escape(name))
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
    await message.answer(t("choose_rank", lang), reply_markup=rank_keyboard())
    await state.set_state(AthleteRegistration.sport_rank)


@router.callback_query(AthleteRegistration.sport_rank, F.data.startswith("rank:"))
async def athlete_rank(callback: CallbackQuery, state: FSMContext):
    try:
        parts = parse_callback(callback.data, "rank")
    except CallbackParseError:
        await callback.answer("Error")
        return
    rank_value = parts[1]
    rank_label = RANK_LABELS.get(rank_value, rank_value)
    data = await state.get_data()
    lang = data.get("language", "ru")
    await state.update_data(sport_rank=rank_label)

    await callback.message.edit_text(
        t("choose_city", lang),
        reply_markup=city_keyboard(lang),
    )
    await state.set_state(AthleteRegistration.city)
    await callback.answer()


@router.callback_query(AthleteRegistration.city, F.data.startswith("city:"))
async def athlete_city_callback(callback: CallbackQuery, state: FSMContext):
    try:
        parts = parse_callback(callback.data, "city")
    except CallbackParseError:
        await callback.answer("Error")
        return
    city = parts[1]
    data = await state.get_data()
    lang = data.get("language", "ru")

    if city == "other":
        await callback.message.edit_text(t("enter_city", lang))
        await state.set_state(AthleteRegistration.city_custom)
        await callback.answer()
        return

    await state.update_data(city=city)
    await callback.message.edit_text(
        t("enter_club", lang),
        reply_markup=club_skip_keyboard(lang),
    )
    await state.set_state(AthleteRegistration.club)
    await callback.answer()


@router.message(AthleteRegistration.city_custom)
async def athlete_city_custom(message: Message, state: FSMContext):
    data = await state.get_data()
    lang = data.get("language", "ru")
    city = _check_len(message.text, MAX_CITY)
    if not city:
        await message.answer(t("input_too_long", lang).format(max=MAX_CITY))
        return
    await state.update_data(city=html.escape(city))
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
    club = _check_len(message.text, MAX_CLUB)
    if not club:
        await message.answer(t("input_too_long", lang).format(max=MAX_CLUB))
        return
    await state.update_data(club=html.escape(club))
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
    try:
        file = await message.bot.get_file(photo.file_id)
        await state.update_data(photo_url=file.file_path)
    except Exception:
        await state.update_data(photo_url=None)
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
            sport_rank=data["sport_rank"],
            country="Россия",
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
    name = _check_len(message.text, MAX_NAME)
    if not name:
        await message.answer(t("input_too_long", lang).format(max=MAX_NAME))
        return
    await state.update_data(full_name=html.escape(name))
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
        t("choose_rank", lang),
        reply_markup=rank_keyboard(),
    )
    await state.set_state(CoachRegistration.sport_rank)
    await callback.answer()


@router.callback_query(CoachRegistration.sport_rank, F.data.startswith("rank:"))
async def coach_rank(callback: CallbackQuery, state: FSMContext):
    try:
        parts = parse_callback(callback.data, "rank")
    except CallbackParseError:
        await callback.answer("Error")
        return
    rank_value = parts[1]
    rank_label = RANK_LABELS.get(rank_value, rank_value)
    data = await state.get_data()
    lang = data.get("language", "ru")
    await state.update_data(sport_rank=rank_label)

    await callback.message.edit_text(
        t("choose_city", lang),
        reply_markup=city_keyboard(lang),
    )
    await state.set_state(CoachRegistration.city)
    await callback.answer()


@router.callback_query(CoachRegistration.city, F.data.startswith("city:"))
async def coach_city_callback(callback: CallbackQuery, state: FSMContext):
    try:
        parts = parse_callback(callback.data, "city")
    except CallbackParseError:
        await callback.answer("Error")
        return
    city = parts[1]
    data = await state.get_data()
    lang = data.get("language", "ru")

    if city == "other":
        await callback.message.edit_text(t("enter_city", lang))
        await state.set_state(CoachRegistration.city_custom)
        await callback.answer()
        return

    await state.update_data(city=city)
    await callback.message.edit_text(t("enter_club", lang))
    await state.set_state(CoachRegistration.club)
    await callback.answer()


@router.message(CoachRegistration.city_custom)
async def coach_city_custom(message: Message, state: FSMContext):
    data = await state.get_data()
    lang = data.get("language", "ru")
    city = _check_len(message.text, MAX_CITY)
    if not city:
        await message.answer(t("input_too_long", lang).format(max=MAX_CITY))
        return
    await state.update_data(city=html.escape(city))
    await message.answer(t("enter_club", lang))
    await state.set_state(CoachRegistration.club)


@router.message(CoachRegistration.club)
async def coach_club(message: Message, state: FSMContext):
    data = await state.get_data()
    lang = data.get("language", "ru")
    club = _check_len(message.text, MAX_CLUB)
    if not club:
        await message.answer(t("input_too_long", lang).format(max=MAX_CLUB))
        return
    await state.update_data(club=html.escape(club))
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
    try:
        file = await message.bot.get_file(photo.file_id)
        await state.update_data(photo_url=file.file_path)
    except Exception:
        await state.update_data(photo_url=None)
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
            country="Россия",
            city=data["city"],
            club=data["club"],
            qualification=data["sport_rank"],
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
