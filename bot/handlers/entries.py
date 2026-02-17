import logging
import uuid
from datetime import date

from aiogram import F, Router
from aiogram.filters import Command
from aiogram.fsm.context import FSMContext
from aiogram.types import CallbackQuery, Message
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from bot.keyboards.entries import (
    age_category_keyboard,
    athlete_checkbox_keyboard,
    confirm_entries_keyboard,
    entry_detail_keyboard,
    my_entries_keyboard,
)
from bot.states.entries import EnterAthletes
from bot.utils.callback import CallbackParseError, parse_callback
from bot.utils.helpers import t
from bot.utils.notifications import notify_admins_new_entry
from db.base import async_session
from db.models.athlete import Athlete
from db.models.coach import CoachAthlete
from db.models.tournament import Tournament, TournamentEntry
from db.models.user import User

logger = logging.getLogger(__name__)

router = Router()


def _to_uuid(value) -> uuid.UUID:
    """Convert string or UUID to uuid.UUID safely."""
    return value if isinstance(value, uuid.UUID) else uuid.UUID(value)


async def _get_coach_and_lang(telegram_id: int):
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


async def _get_coach_athletes(coach_id):
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


# ──────────────────────────────────────────────
#  ENTER ATHLETES INTO TOURNAMENT
# ──────────────────────────────────────────────


@router.callback_query(F.data.startswith("tournament_enter:"))
async def on_tournament_enter(callback: CallbackQuery, state: FSMContext):
    coach, lang = await _get_coach_and_lang(callback.from_user.id)
    if not coach:
        await callback.message.edit_text(t("not_a_verified_coach", lang))
        await callback.answer()
        return

    try:
        parts = parse_callback(callback.data, "tournament_enter")
    except CallbackParseError:
        await callback.answer("Error")
        return
    tid = parts[1]

    async with async_session() as session:
        result = await session.execute(select(Tournament).where(Tournament.id == tid))
        tournament = result.scalar_one_or_none()

    if not tournament:
        await callback.message.edit_text(t("tournament_not_found", lang))
        await callback.answer()
        return

    if tournament.registration_deadline < date.today():
        await callback.message.edit_text(t("deadline_passed", lang))
        await callback.answer()
        return

    athletes = await _get_coach_athletes(coach.id)
    if not athletes:
        await callback.message.edit_text(t("no_athletes", lang))
        await callback.answer()
        return

    await state.update_data(
        language=lang,
        entry_tid=str(tid),
        entry_coach_id=str(coach.id),
        selected_athletes=[],
    )

    await callback.message.edit_text(
        t("select_athletes_for_entry", lang),
        reply_markup=athlete_checkbox_keyboard(athletes, set(), lang),
    )
    await state.set_state(EnterAthletes.select_athletes)
    await callback.answer()


@router.callback_query(EnterAthletes.select_athletes, F.data.startswith("toggle_athlete:"))
async def on_toggle_athlete(callback: CallbackQuery, state: FSMContext):
    try:
        parts = parse_callback(callback.data, "toggle_athlete")
    except CallbackParseError:
        await callback.answer("Error")
        return
    athlete_id = parts[1]
    data = await state.get_data()
    lang = data.get("language", "ru")
    selected = set(data.get("selected_athletes", []))

    if athlete_id in selected:
        selected.discard(athlete_id)
    else:
        selected.add(athlete_id)

    await state.update_data(selected_athletes=list(selected))

    coach_id = _to_uuid(data["entry_coach_id"])
    athletes = await _get_coach_athletes(coach_id)

    await callback.message.edit_reply_markup(reply_markup=athlete_checkbox_keyboard(athletes, selected, lang))
    await callback.answer()


@router.callback_query(EnterAthletes.select_athletes, F.data == "confirm_athletes_selection")
async def on_confirm_selection(callback: CallbackQuery, state: FSMContext):
    data = await state.get_data()
    lang = data.get("language", "ru")
    selected = data.get("selected_athletes", [])

    if not selected:
        await callback.answer(t("select_at_least_one", lang), show_alert=True)
        return

    tid = _to_uuid(data["entry_tid"])

    async with async_session() as session:
        result = await session.execute(select(Tournament).where(Tournament.id == tid))
        tournament = result.scalar_one_or_none()

    if not tournament or not tournament.age_categories:
        await callback.message.edit_text(t("tournament_not_found", lang))
        await state.clear()
        await callback.answer()
        return

    await callback.message.edit_text(
        t("choose_age_category", lang),
        reply_markup=age_category_keyboard(tournament.age_categories, lang),
    )
    await state.set_state(EnterAthletes.select_age_category)
    await callback.answer()


@router.callback_query(EnterAthletes.select_age_category, F.data.startswith("entry_age:"))
async def on_age_category(callback: CallbackQuery, state: FSMContext):
    try:
        parts = parse_callback(callback.data, "entry_age")
    except CallbackParseError:
        await callback.answer("Error")
        return
    age_cat = parts[1]
    data = await state.get_data()
    lang = data.get("language", "ru")
    selected = data.get("selected_athletes", [])

    await state.update_data(entry_age_category=age_cat)

    # Build summary
    async with async_session() as session:
        result = await session.execute(select(Athlete).where(Athlete.id.in_(selected)))
        athletes = result.scalars().all()

        t_result = await session.execute(select(Tournament).where(Tournament.id == _to_uuid(data["entry_tid"])))
        tournament = t_result.scalar_one_or_none()

    names = [f"• {a.full_name} ({a.weight_category})" for a in athletes]
    summary = t("entry_summary", lang).format(
        tournament=tournament.name if tournament else "?",
        age_category=age_cat,
        athletes="\n".join(names),
        count=len(names),
    )

    await callback.message.edit_text(summary, reply_markup=confirm_entries_keyboard(lang))
    await state.set_state(EnterAthletes.confirm)
    await callback.answer()


@router.callback_query(EnterAthletes.confirm, F.data == "confirm_entries")
async def on_confirm_entries(callback: CallbackQuery, state: FSMContext):
    data = await state.get_data()
    lang = data.get("language", "ru")
    selected = data.get("selected_athletes", [])
    tid = _to_uuid(data["entry_tid"])
    coach_id = _to_uuid(data["entry_coach_id"])
    age_cat = data["entry_age_category"]

    async with async_session() as session:
        # Get athletes for their weight categories
        result = await session.execute(
            select(Athlete).where(Athlete.id.in_(selected)).options(selectinload(Athlete.user))
        )
        athletes = result.scalars().all()

        # Fetch tournament for weight category validation
        t_result = await session.execute(select(Tournament).where(Tournament.id == tid))
        tournament = t_result.scalar_one_or_none()
        allowed_weights = set(tournament.weight_categories) if tournament and tournament.weight_categories else set()

        created = 0
        for athlete in athletes:
            # Check if entry already exists
            existing = await session.execute(
                select(TournamentEntry).where(
                    TournamentEntry.tournament_id == tid,
                    TournamentEntry.athlete_id == athlete.id,
                )
            )
            if existing.scalar_one_or_none():
                continue

            # Validate weight category if tournament defines them
            if allowed_weights and athlete.weight_category not in allowed_weights:
                continue

            entry = TournamentEntry(
                tournament_id=tid,
                athlete_id=athlete.id,
                coach_id=coach_id,
                weight_category=athlete.weight_category,
                age_category=age_cat,
                status="pending",
            )
            session.add(entry)
            created += 1

        await session.commit()

    await state.clear()
    await callback.message.edit_text(t("entries_created", lang).format(count=created))
    await callback.answer()

    # Notify athletes + admins
    async with async_session() as session:
        result = await session.execute(
            select(Athlete).where(Athlete.id.in_(selected)).options(selectinload(Athlete.user))
        )
        athletes = result.scalars().all()

        t_result = await session.execute(select(Tournament.name).where(Tournament.id == tid))
        t_name = t_result.scalar_one_or_none() or "?"

        from db.models.coach import Coach
        c_result = await session.execute(select(Coach.full_name).where(Coach.id == coach_id))
        coach_name = c_result.scalar_one_or_none() or "?"

    for athlete in athletes:
        if athlete.user:
            a_lang = athlete.user.language or "ru"
            try:
                await callback.bot.send_message(
                    athlete.user.telegram_id,
                    t("you_entered_tournament", a_lang).format(tournament=t_name),
                )
            except Exception:
                logger.warning("Failed to notify athlete %s about tournament entry", athlete.user.telegram_id)

    # Notify admins about new entry
    if created > 0:
        try:
            await notify_admins_new_entry(
                callback.bot,
                tournament_name=t_name,
                coach_name=coach_name,
                count=created,
            )
        except Exception:
            logger.warning("Failed to notify admins about new entry")


@router.callback_query(F.data == "entry_cancel")
async def on_entry_cancel(callback: CallbackQuery, state: FSMContext):
    data = await state.get_data()
    lang = data.get("language", "ru")
    await state.clear()
    await callback.message.edit_text(t("cancelled", lang))
    await callback.answer()


# ──────────────────────────────────────────────
#  MY ENTRIES (coach view)
# ──────────────────────────────────────────────


@router.message(Command("my_entries"))
async def cmd_my_entries(message: Message):
    coach, lang = await _get_coach_and_lang(message.from_user.id)
    if not coach:
        await message.answer(t("not_a_verified_coach", lang))
        return

    async with async_session() as session:
        result = await session.execute(
            select(TournamentEntry)
            .where(TournamentEntry.coach_id == coach.id)
            .options(selectinload(TournamentEntry.tournament))
        )
        entries = result.scalars().all()

    if not entries:
        await message.answer(t("no_entries", lang))
        return

    # Group by tournament
    by_tournament: dict[str, tuple[str, int]] = {}
    for entry in entries:
        tid = str(entry.tournament_id)
        if tid not in by_tournament:
            by_tournament[tid] = (entry.tournament.name, 0)
        name, count = by_tournament[tid]
        by_tournament[tid] = (name, count + 1)

    items = [(tid, name, f"{count} {t('athletes_word', lang)}") for tid, (name, count) in by_tournament.items()]

    await message.answer(
        t("your_entries", lang),
        reply_markup=my_entries_keyboard(items, lang),
    )


@router.callback_query(F.data.startswith("view_entries:"))
async def on_view_entries(callback: CallbackQuery):
    coach, lang = await _get_coach_and_lang(callback.from_user.id)
    if not coach:
        await callback.answer()
        return

    try:
        parts = parse_callback(callback.data, "view_entries")
    except CallbackParseError:
        await callback.answer("Error")
        return
    tid = parts[1]

    async with async_session() as session:
        result = await session.execute(
            select(TournamentEntry)
            .where(
                TournamentEntry.tournament_id == tid,
                TournamentEntry.coach_id == coach.id,
            )
            .options(selectinload(TournamentEntry.athlete))
        )
        entries = result.scalars().all()

        t_result = await session.execute(select(Tournament).where(Tournament.id == tid))
        tournament = t_result.scalar_one_or_none()

    t_name = tournament.name if tournament else "?"

    if not entries:
        await callback.message.edit_text(t("no_entries", lang))
        await callback.answer()
        return

    lines = [f"<b>{t_name}</b>\n"]
    for entry in entries:
        lines.append(f"• {entry.athlete.full_name} — {entry.weight_category}, {entry.age_category}")

    can_withdraw = tournament and tournament.registration_deadline >= date.today()
    entry_items = [(e.id, e.athlete.full_name) for e in entries]

    await callback.message.edit_text(
        "\n".join(lines),
        reply_markup=entry_detail_keyboard(entry_items, tid, lang, can_withdraw=can_withdraw),
    )
    await callback.answer()


@router.callback_query(F.data.startswith("withdraw:"))
async def on_withdraw_entry(callback: CallbackQuery):
    coach, lang = await _get_coach_and_lang(callback.from_user.id)
    if not coach:
        await callback.answer()
        return

    try:
        parts = parse_callback(callback.data, "withdraw")
    except CallbackParseError:
        await callback.answer("Error")
        return
    entry_id = parts[1]

    async with async_session() as session:
        result = await session.execute(
            select(TournamentEntry)
            .where(
                TournamentEntry.id == entry_id,
                TournamentEntry.coach_id == coach.id,
            )
            .options(
                selectinload(TournamentEntry.athlete).selectinload(Athlete.user),
                selectinload(TournamentEntry.tournament),
            )
        )
        entry = result.scalar_one_or_none()

        if not entry:
            await callback.answer(t("request_not_found", lang), show_alert=True)
            return

        if entry.tournament.registration_deadline < date.today():
            await callback.answer(t("cannot_withdraw_deadline", lang), show_alert=True)
            return

        tid = entry.tournament_id
        t_name = entry.tournament.name
        athlete_user = entry.athlete.user if entry.athlete else None

        await session.delete(entry)
        await session.commit()

    await callback.answer(t("athlete_withdrawn", lang))

    # Notify athlete
    if athlete_user:
        a_lang = athlete_user.language or "ru"
        try:
            await callback.bot.send_message(
                athlete_user.telegram_id,
                t("you_withdrawn_from_tournament", a_lang).format(tournament=t_name),
            )
        except Exception:
            logger.warning("Failed to notify athlete %s about withdrawal", athlete_user.telegram_id)

    # Refresh entry list
    async with async_session() as session:
        result = await session.execute(
            select(TournamentEntry)
            .where(
                TournamentEntry.tournament_id == tid,
                TournamentEntry.coach_id == coach.id,
            )
            .options(selectinload(TournamentEntry.athlete))
        )
        entries = result.scalars().all()

        t_result = await session.execute(select(Tournament).where(Tournament.id == tid))
        tournament = t_result.scalar_one_or_none()

    if not entries:
        await callback.message.edit_text(t("no_entries", lang))
        return

    lines = [f"<b>{t_name}</b>\n"]
    for e in entries:
        lines.append(f"• {e.athlete.full_name} — {e.weight_category}, {e.age_category}")

    can_withdraw = tournament and tournament.registration_deadline >= date.today()
    entry_items = [(e.id, e.athlete.full_name) for e in entries]

    await callback.message.edit_text(
        "\n".join(lines),
        reply_markup=entry_detail_keyboard(entry_items, tid, lang, can_withdraw=can_withdraw),
    )


@router.callback_query(F.data == "back_my_entries")
async def on_back_to_my_entries(callback: CallbackQuery):
    coach, lang = await _get_coach_and_lang(callback.from_user.id)
    if not coach:
        await callback.answer()
        return

    async with async_session() as session:
        result = await session.execute(
            select(TournamentEntry)
            .where(TournamentEntry.coach_id == coach.id)
            .options(selectinload(TournamentEntry.tournament))
        )
        entries = result.scalars().all()

    if not entries:
        await callback.message.edit_text(t("no_entries", lang))
        await callback.answer()
        return

    by_tournament: dict[str, tuple[str, int]] = {}
    for entry in entries:
        tid = str(entry.tournament_id)
        if tid not in by_tournament:
            by_tournament[tid] = (entry.tournament.name, 0)
        name, count = by_tournament[tid]
        by_tournament[tid] = (name, count + 1)

    items = [(tid, name, f"{count} {t('athletes_word', lang)}") for tid, (name, count) in by_tournament.items()]

    await callback.message.edit_text(
        t("your_entries", lang),
        reply_markup=my_entries_keyboard(items, lang),
    )
    await callback.answer()
