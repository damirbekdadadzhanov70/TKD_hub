from datetime import date

from aiogram import F, Router
from aiogram.filters import Command
from aiogram.types import CallbackQuery, Message
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from bot.keyboards.tournaments import tournament_detail_keyboard, tournaments_list_keyboard
from bot.utils.helpers import t
from db.base import async_session
from db.models.tournament import Tournament
from db.models.user import User

router = Router()


async def _get_user_and_role(telegram_id: int):
    """Return (user, is_verified_coach, lang)."""
    async with async_session() as session:
        result = await session.execute(
            select(User)
            .where(User.telegram_id == telegram_id)
            .options(selectinload(User.coach), selectinload(User.athlete))
        )
        user = result.scalar_one_or_none()

    if not user:
        return None, False, "ru"

    lang = user.language or "ru"
    is_coach = bool(user.coach and user.coach.is_verified)
    return user, is_coach, lang


@router.message(Command("tournaments"))
async def cmd_tournaments(message: Message):
    user, is_coach, lang = await _get_user_and_role(message.from_user.id)

    async with async_session() as session:
        result = await session.execute(
            select(Tournament)
            .where(
                Tournament.status == "upcoming",
                Tournament.start_date >= date.today(),
            )
            .order_by(Tournament.start_date)
        )
        tournaments = result.scalars().all()

    if not tournaments:
        await message.answer(t("no_upcoming_tournaments", lang))
        return

    items = [
        (t_.id, t_.name, t_.start_date.strftime("%d.%m.%Y"))
        for t_ in tournaments
    ]

    await message.answer(
        t("upcoming_tournaments", lang),
        reply_markup=tournaments_list_keyboard(items, lang),
    )


@router.callback_query(F.data.startswith("tournament_detail:"))
async def on_tournament_detail(callback: CallbackQuery):
    user, is_coach, lang = await _get_user_and_role(callback.from_user.id)
    tid = callback.data.split(":")[1]

    async with async_session() as session:
        result = await session.execute(
            select(Tournament).where(Tournament.id == tid)
        )
        tournament = result.scalar_one_or_none()

    if not tournament:
        await callback.message.edit_text(t("tournament_not_found", lang))
        await callback.answer()
        return

    text = t("tournament_detail_card", lang).format(
        name=tournament.name,
        description=tournament.description or "—",
        start_date=tournament.start_date.strftime("%d.%m.%Y"),
        end_date=tournament.end_date.strftime("%d.%m.%Y"),
        city=tournament.city,
        country=tournament.country,
        venue=tournament.venue,
        age_categories=", ".join(tournament.age_categories) if tournament.age_categories else "—",
        weight_categories=", ".join(tournament.weight_categories) if tournament.weight_categories else "—",
        entry_fee=f"{tournament.entry_fee} {tournament.currency}" if tournament.entry_fee else "—",
        deadline=tournament.registration_deadline.strftime("%d.%m.%Y"),
        importance="⭐" * tournament.importance_level,
    )

    await callback.message.edit_text(
        text,
        reply_markup=tournament_detail_keyboard(tournament.id, lang, is_coach=is_coach),
    )
    await callback.answer()


@router.callback_query(F.data == "back_to_tournaments")
async def on_back_to_tournaments(callback: CallbackQuery):
    user, is_coach, lang = await _get_user_and_role(callback.from_user.id)

    async with async_session() as session:
        result = await session.execute(
            select(Tournament)
            .where(
                Tournament.status == "upcoming",
                Tournament.start_date >= date.today(),
            )
            .order_by(Tournament.start_date)
        )
        tournaments = result.scalars().all()

    if not tournaments:
        await callback.message.edit_text(t("no_upcoming_tournaments", lang))
    else:
        items = [
            (t_.id, t_.name, t_.start_date.strftime("%d.%m.%Y"))
            for t_ in tournaments
        ]
        await callback.message.edit_text(
            t("upcoming_tournaments", lang),
            reply_markup=tournaments_list_keyboard(items, lang),
        )
    await callback.answer()
