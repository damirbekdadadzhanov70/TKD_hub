from datetime import datetime
from decimal import Decimal, InvalidOperation

from aiogram import F, Router
from aiogram.filters import Command
from aiogram.fsm.context import FSMContext
from aiogram.types import CallbackQuery, Message
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from bot.config import settings
from bot.keyboards.registration import country_keyboard
from bot.keyboards.tournaments import (
    admin_tournaments_keyboard,
    confirm_delete_keyboard,
    confirm_tournament_keyboard,
    currency_keyboard,
    edit_fields_keyboard,
    importance_keyboard,
)
from bot.states.tournaments import AddTournament, DeleteTournament, EditTournament
from bot.utils.audit import write_audit_log
from bot.utils.callback import CallbackParseError, parse_callback, parse_callback_uuid
from bot.utils.helpers import t
from db.base import async_session
from db.models.tournament import Tournament
from db.models.user import User

router = Router()


async def _get_admin_lang(telegram_id: int) -> str:
    async with async_session() as session:
        result = await session.execute(select(User.language).where(User.telegram_id == telegram_id))
        lang = result.scalar_one_or_none()
    return lang or "ru"


def _is_admin(telegram_id: int) -> bool:
    return telegram_id in settings.admin_ids


# ──────────────────────────────────────────────
#  ADD TOURNAMENT
# ──────────────────────────────────────────────


@router.message(Command("add_tournament"))
async def cmd_add_tournament(message: Message, state: FSMContext):
    if not _is_admin(message.from_user.id):
        return

    lang = await _get_admin_lang(message.from_user.id)
    await state.update_data(language=lang)
    await message.answer(t("enter_tournament_name", lang))
    await state.set_state(AddTournament.name)


@router.message(AddTournament.name)
async def add_name(message: Message, state: FSMContext):
    data = await state.get_data()
    lang = data.get("language", "ru")
    await state.update_data(t_name=message.text.strip())
    await message.answer(t("enter_tournament_description", lang))
    await state.set_state(AddTournament.description)


@router.message(AddTournament.description)
async def add_description(message: Message, state: FSMContext):
    data = await state.get_data()
    lang = data.get("language", "ru")
    await state.update_data(t_description=message.text.strip())
    await message.answer(t("enter_start_date", lang))
    await state.set_state(AddTournament.start_date)


@router.message(AddTournament.start_date)
async def add_start_date(message: Message, state: FSMContext):
    data = await state.get_data()
    lang = data.get("language", "ru")

    try:
        start = datetime.strptime(message.text.strip(), "%d.%m.%Y").date()
    except ValueError:
        await message.answer(t("invalid_date", lang))
        return

    await state.update_data(t_start_date=start.isoformat())
    await message.answer(t("enter_end_date", lang))
    await state.set_state(AddTournament.end_date)


@router.message(AddTournament.end_date)
async def add_end_date(message: Message, state: FSMContext):
    data = await state.get_data()
    lang = data.get("language", "ru")

    try:
        end = datetime.strptime(message.text.strip(), "%d.%m.%Y").date()
    except ValueError:
        await message.answer(t("invalid_date", lang))
        return

    start = datetime.fromisoformat(data["t_start_date"]).date()
    if end < start:
        await message.answer(t("end_before_start", lang))
        return

    await state.update_data(t_end_date=end.isoformat())
    await message.answer(t("enter_tournament_city", lang))
    await state.set_state(AddTournament.city)


@router.message(AddTournament.city)
async def add_city(message: Message, state: FSMContext):
    data = await state.get_data()
    lang = data.get("language", "ru")
    await state.update_data(t_city=message.text.strip())
    await message.answer(t("choose_country", lang), reply_markup=country_keyboard(lang))
    await state.set_state(AddTournament.country)


@router.callback_query(AddTournament.country, F.data.startswith("country:"))
async def add_country_cb(callback: CallbackQuery, state: FSMContext):
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
        # Stay in same state, next text message will be the country
        await callback.answer()
        return

    await state.update_data(t_country=country)
    await callback.message.edit_text(t("enter_venue", lang))
    await state.set_state(AddTournament.venue)
    await callback.answer()


@router.message(AddTournament.country)
async def add_country_text(message: Message, state: FSMContext):
    data = await state.get_data()
    lang = data.get("language", "ru")
    await state.update_data(t_country=message.text.strip())
    await message.answer(t("enter_venue", lang))
    await state.set_state(AddTournament.venue)


@router.message(AddTournament.venue)
async def add_venue(message: Message, state: FSMContext):
    data = await state.get_data()
    lang = data.get("language", "ru")
    await state.update_data(t_venue=message.text.strip())
    await message.answer(t("enter_age_categories", lang))
    await state.set_state(AddTournament.age_categories)


@router.message(AddTournament.age_categories)
async def add_age_categories(message: Message, state: FSMContext):
    data = await state.get_data()
    lang = data.get("language", "ru")
    cats = [c.strip() for c in message.text.split(",") if c.strip()]
    await state.update_data(t_age_categories=cats)
    await message.answer(t("enter_weight_categories", lang))
    await state.set_state(AddTournament.weight_categories)


@router.message(AddTournament.weight_categories)
async def add_weight_categories(message: Message, state: FSMContext):
    data = await state.get_data()
    lang = data.get("language", "ru")
    cats = [c.strip() for c in message.text.split(",") if c.strip()]
    await state.update_data(t_weight_categories=cats)
    await message.answer(t("enter_entry_fee", lang))
    await state.set_state(AddTournament.entry_fee)


@router.message(AddTournament.entry_fee)
async def add_entry_fee(message: Message, state: FSMContext):
    data = await state.get_data()
    lang = data.get("language", "ru")

    try:
        fee = Decimal(message.text.strip().replace(",", "."))
        if fee < 0:
            raise InvalidOperation
    except (InvalidOperation, ValueError):
        await message.answer(t("invalid_fee", lang))
        return

    await state.update_data(t_entry_fee=str(fee))
    await message.answer(t("choose_currency", lang), reply_markup=currency_keyboard())
    await state.set_state(AddTournament.currency)


@router.callback_query(AddTournament.currency, F.data.startswith("currency:"))
async def add_currency(callback: CallbackQuery, state: FSMContext):
    try:
        parts = parse_callback(callback.data, "currency")
    except CallbackParseError:
        await callback.answer("Error")
        return
    currency = parts[1]
    data = await state.get_data()
    lang = data.get("language", "ru")
    await state.update_data(t_currency=currency)
    await callback.message.edit_text(t("enter_registration_deadline", lang))
    await state.set_state(AddTournament.registration_deadline)
    await callback.answer()


@router.message(AddTournament.registration_deadline)
async def add_deadline(message: Message, state: FSMContext):
    data = await state.get_data()
    lang = data.get("language", "ru")

    try:
        deadline = datetime.strptime(message.text.strip(), "%d.%m.%Y").date()
    except ValueError:
        await message.answer(t("invalid_date", lang))
        return

    start = datetime.fromisoformat(data["t_start_date"]).date()
    if deadline >= start:
        await message.answer(t("deadline_after_start", lang))
        return

    await state.update_data(t_deadline=deadline.isoformat())
    await message.answer(t("choose_importance", lang), reply_markup=importance_keyboard())
    await state.set_state(AddTournament.importance_level)


@router.callback_query(AddTournament.importance_level, F.data.startswith("importance:"))
async def add_importance(callback: CallbackQuery, state: FSMContext):
    try:
        parts = parse_callback(callback.data, "importance")
        level = int(parts[1])
    except (CallbackParseError, ValueError):
        await callback.answer("Error")
        return
    data = await state.get_data()
    lang = data.get("language", "ru")
    await state.update_data(t_importance=level)

    data = await state.get_data()

    summary = t("tournament_summary", lang).format(
        name=data["t_name"],
        description=data["t_description"],
        start_date=data["t_start_date"],
        end_date=data["t_end_date"],
        city=data["t_city"],
        country=data["t_country"],
        venue=data["t_venue"],
        age_categories=", ".join(data["t_age_categories"]),
        weight_categories=", ".join(data["t_weight_categories"]),
        entry_fee=data["t_entry_fee"],
        currency=data["t_currency"],
        deadline=data["t_deadline"],
        importance="⭐" * data["t_importance"],
    )

    await callback.message.edit_text(summary, reply_markup=confirm_tournament_keyboard(lang))
    await state.set_state(AddTournament.confirm)
    await callback.answer()


@router.callback_query(AddTournament.confirm, F.data == "t_confirm_create")
async def add_confirm(callback: CallbackQuery, state: FSMContext):
    data = await state.get_data()
    lang = data.get("language", "ru")

    async with async_session() as session:
        # Get user id
        result = await session.execute(select(User.id).where(User.telegram_id == callback.from_user.id))
        user_id = result.scalar_one()

        tournament = Tournament(
            name=data["t_name"],
            description=data["t_description"],
            start_date=datetime.fromisoformat(data["t_start_date"]).date(),
            end_date=datetime.fromisoformat(data["t_end_date"]).date(),
            city=data["t_city"],
            country=data["t_country"],
            venue=data["t_venue"],
            age_categories=data["t_age_categories"],
            weight_categories=data["t_weight_categories"],
            entry_fee=Decimal(data["t_entry_fee"]),
            currency=data["t_currency"],
            registration_deadline=datetime.fromisoformat(data["t_deadline"]).date(),
            importance_level=data["t_importance"],
            created_by=user_id,
        )
        session.add(tournament)
        await session.flush()

        await write_audit_log(
            session,
            callback.from_user.id,
            action="create_tournament",
            target_type="tournament",
            target_id=str(tournament.id),
            details={"name": data["t_name"]},
        )
        await session.commit()

    await state.clear()
    await callback.message.edit_text(t("tournament_created", lang))
    await callback.answer()


# ──────────────────────────────────────────────
#  EDIT TOURNAMENT
# ──────────────────────────────────────────────


@router.message(Command("edit_tournament"))
async def cmd_edit_tournament(message: Message, state: FSMContext):
    if not _is_admin(message.from_user.id):
        return

    lang = await _get_admin_lang(message.from_user.id)
    await state.update_data(language=lang)

    async with async_session() as session:
        result = await session.execute(select(Tournament).order_by(Tournament.start_date))
        tournaments = result.scalars().all()

    if not tournaments:
        await message.answer(t("no_tournaments", lang))
        return

    items = [(t_.id, t_.name) for t_ in tournaments]
    await message.answer(
        t("select_tournament_to_edit", lang),
        reply_markup=admin_tournaments_keyboard(items, lang, action="edit"),
    )
    await state.set_state(EditTournament.select_tournament)


@router.callback_query(EditTournament.select_tournament, F.data.startswith("t_edit:"))
async def edit_select(callback: CallbackQuery, state: FSMContext):
    try:
        _, tid = parse_callback_uuid(callback.data, "t_edit")
    except CallbackParseError:
        await callback.answer("Error")
        return
    tid = str(tid)
    data = await state.get_data()
    lang = data.get("language", "ru")
    await state.update_data(edit_tid=tid)

    await callback.message.edit_text(
        t("select_field_to_edit", lang),
        reply_markup=edit_fields_keyboard(tid, lang),
    )
    await state.set_state(EditTournament.select_field)
    await callback.answer()


@router.callback_query(EditTournament.select_field, F.data.startswith("t_edit_field:"))
async def edit_field_select(callback: CallbackQuery, state: FSMContext):
    try:
        parts = parse_callback(callback.data, "t_edit_field", expected_parts=3)
    except CallbackParseError:
        await callback.answer("Error")
        return
    field = parts[2]
    data = await state.get_data()
    lang = data.get("language", "ru")
    await state.update_data(edit_field=field)

    await callback.message.edit_text(t("enter_new_value", lang).format(field=field))
    await state.set_state(EditTournament.enter_value)
    await callback.answer()


@router.message(EditTournament.enter_value)
async def edit_enter_value(message: Message, state: FSMContext):
    data = await state.get_data()
    lang = data.get("language", "ru")
    field = data["edit_field"]
    tid = data["edit_tid"]
    raw = message.text.strip()

    async with async_session() as session:
        result = await session.execute(select(Tournament).where(Tournament.id == tid))
        tournament = result.scalar_one_or_none()

        if not tournament:
            await message.answer(t("tournament_not_found", lang))
            await state.clear()
            return

        # Whitelist of editable string fields
        EDITABLE_TEXT_FIELDS = {"name", "description", "city", "country", "venue", "currency", "organizer_contact"}

        # Parse and set the value based on field type
        try:
            if field in ("start_date", "end_date", "registration_deadline"):
                val = datetime.strptime(raw, "%d.%m.%Y").date()
                setattr(tournament, field, val)
            elif field == "entry_fee":
                val = Decimal(raw.replace(",", "."))
                tournament.entry_fee = val
            elif field == "importance_level":
                val = int(raw)
                if val < 1 or val > 5:
                    raise ValueError
                tournament.importance_level = val
            elif field in ("age_categories", "weight_categories"):
                cats = [c.strip() for c in raw.split(",") if c.strip()]
                setattr(tournament, field, cats)
            elif field in EDITABLE_TEXT_FIELDS:
                setattr(tournament, field, raw)
            else:
                await message.answer(t("invalid_value", lang))
                return

            await write_audit_log(
                session,
                message.from_user.id,
                action="update_tournament",
                target_type="tournament",
                target_id=tid,
                details={"field": field, "value": raw},
            )
            await session.commit()
        except (ValueError, InvalidOperation):
            await message.answer(t("invalid_value", lang))
            return

    await state.clear()
    await message.answer(t("tournament_updated", lang))


# ──────────────────────────────────────────────
#  DELETE TOURNAMENT
# ──────────────────────────────────────────────


@router.message(Command("delete_tournament"))
async def cmd_delete_tournament(message: Message, state: FSMContext):
    if not _is_admin(message.from_user.id):
        return

    lang = await _get_admin_lang(message.from_user.id)
    await state.update_data(language=lang)

    async with async_session() as session:
        result = await session.execute(select(Tournament).order_by(Tournament.start_date))
        tournaments = result.scalars().all()

    if not tournaments:
        await message.answer(t("no_tournaments", lang))
        return

    items = [(t_.id, t_.name) for t_ in tournaments]
    await message.answer(
        t("select_tournament_to_delete", lang),
        reply_markup=admin_tournaments_keyboard(items, lang, action="delete"),
    )
    await state.set_state(DeleteTournament.select_tournament)


@router.callback_query(DeleteTournament.select_tournament, F.data.startswith("t_delete:"))
async def delete_select(callback: CallbackQuery, state: FSMContext):
    try:
        _, tid = parse_callback_uuid(callback.data, "t_delete")
    except CallbackParseError:
        await callback.answer("Error")
        return
    tid = str(tid)
    data = await state.get_data()
    lang = data.get("language", "ru")

    await callback.message.edit_text(
        t("confirm_tournament_delete", lang),
        reply_markup=confirm_delete_keyboard(tid, lang),
    )
    await state.set_state(DeleteTournament.confirm)
    await callback.answer()


@router.callback_query(DeleteTournament.confirm, F.data.startswith("t_confirm_delete:"))
async def delete_confirm(callback: CallbackQuery, state: FSMContext):
    try:
        _, tid = parse_callback_uuid(callback.data, "t_confirm_delete")
    except CallbackParseError:
        await callback.answer("Error")
        return
    tid = str(tid)
    data = await state.get_data()
    lang = data.get("language", "ru")

    async with async_session() as session:
        result = await session.execute(
            select(Tournament).where(Tournament.id == tid).options(selectinload(Tournament.entries))
        )
        tournament = result.scalar_one_or_none()

        if tournament:
            await write_audit_log(
                session,
                callback.from_user.id,
                action="delete_tournament",
                target_type="tournament",
                target_id=tid,
                details={"name": tournament.name},
            )
            for entry in tournament.entries:
                await session.delete(entry)
            await session.delete(tournament)
            await session.commit()

    await state.clear()
    await callback.message.edit_text(t("tournament_deleted", lang))
    await callback.answer()


# ──────────────────────────────────────────────
#  CANCEL (shared by all admin tournament FSM)
# ──────────────────────────────────────────────


@router.callback_query(F.data == "t_cancel")
async def on_cancel(callback: CallbackQuery, state: FSMContext):
    lang_data = await state.get_data()
    lang = lang_data.get("language", "ru")
    await state.clear()
    await callback.message.edit_text(t("cancelled", lang))
    await callback.answer()
