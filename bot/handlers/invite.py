import uuid
from datetime import datetime, timezone

from aiogram import F, Router
from aiogram.filters import Command
from aiogram.fsm.context import FSMContext
from aiogram.types import CallbackQuery, Message
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from bot.config import settings
from bot.keyboards.invite import invite_decision_keyboard
from bot.utils.helpers import t
from db.base import async_session
from db.models.athlete import Athlete
from db.models.coach import Coach, CoachAthlete
from db.models.user import User

router = Router()

# In-memory invite tokens: token -> (coach_id, created_at)
invite_tokens: dict[str, tuple[uuid.UUID, datetime]] = {}


@router.message(Command("invite"))
async def cmd_invite(message: Message):
    async with async_session() as session:
        result = await session.execute(
            select(User)
            .where(User.telegram_id == message.from_user.id)
            .options(selectinload(User.coach))
        )
        user = result.scalar_one_or_none()

    if not user or not user.coach:
        lang = (user.language if user else None) or "ru"
        await message.answer(t("not_a_coach", lang))
        return

    coach = user.coach
    lang = user.language or "ru"

    if not coach.is_verified:
        await message.answer(t("coach_not_verified", lang))
        return

    token = uuid.uuid4().hex[:12]
    invite_tokens[token] = (coach.id, datetime.now(timezone.utc))

    bot_username = settings.BOT_USERNAME
    link = f"https://t.me/{bot_username}?start=invite_{token}"

    await message.answer(t("invite_link_created", lang).format(link=link))


async def handle_invite_deep_link(
    message: Message, state: FSMContext, args: str
):
    token = args.removeprefix("invite_")

    # Look up user language
    async with async_session() as session:
        result = await session.execute(
            select(User)
            .where(User.telegram_id == message.from_user.id)
            .options(selectinload(User.athlete))
        )
        user = result.scalar_one_or_none()

    lang = (user.language if user else None) or "ru"

    if token not in invite_tokens:
        await message.answer(t("invite_expired", lang))
        return

    coach_id, created_at = invite_tokens[token]

    if not user or not user.athlete:
        await message.answer(t("invite_must_be_athlete", lang))
        return

    # Check not already linked
    async with async_session() as session:
        existing = await session.execute(
            select(CoachAthlete).where(
                CoachAthlete.coach_id == coach_id,
                CoachAthlete.athlete_id == user.athlete.id,
            )
        )
        if existing.scalar_one_or_none():
            await message.answer(t("invite_already_linked", lang))
            # Clean up used token
            invite_tokens.pop(token, None)
            return

        # Get coach info
        coach_result = await session.execute(
            select(Coach).where(Coach.id == coach_id)
        )
        coach = coach_result.scalar_one_or_none()

    if not coach:
        await message.answer(t("invite_expired", lang))
        return

    # Remove token so it can't be reused
    invite_tokens.pop(token, None)

    text = t("invite_received", lang).format(
        name=coach.full_name,
        club=coach.club,
        city=coach.city,
    )

    await message.answer(
        text,
        reply_markup=invite_decision_keyboard(coach.id, lang),
    )


@router.callback_query(F.data.startswith("invite_accept:"))
async def on_invite_accept(callback: CallbackQuery):
    coach_id = callback.data.split(":")[1]

    async with async_session() as session:
        # Get athlete
        user_result = await session.execute(
            select(User)
            .where(User.telegram_id == callback.from_user.id)
            .options(selectinload(User.athlete))
        )
        user = user_result.scalar_one_or_none()
        lang = (user.language if user else None) or "ru"

        if not user or not user.athlete:
            await callback.message.edit_text(t("invite_must_be_athlete", lang))
            await callback.answer()
            return

        # Check not already linked
        existing = await session.execute(
            select(CoachAthlete).where(
                CoachAthlete.coach_id == coach_id,
                CoachAthlete.athlete_id == user.athlete.id,
            )
        )
        if existing.scalar_one_or_none():
            await callback.message.edit_text(t("invite_already_linked", lang))
            await callback.answer()
            return

        link = CoachAthlete(
            coach_id=coach_id,
            athlete_id=user.athlete.id,
            status="active",
            accepted_at=datetime.now(timezone.utc),
        )
        session.add(link)
        await session.commit()

        # Get coach for notification
        coach_result = await session.execute(
            select(Coach).where(Coach.id == coach_id).options(selectinload(Coach.user))
        )
        coach = coach_result.scalar_one_or_none()

    await callback.message.edit_text(t("invite_accepted", lang))
    await callback.answer()

    # Notify coach
    if coach and coach.user:
        coach_lang = coach.user.language or "ru"
        try:
            await callback.bot.send_message(
                coach.user.telegram_id,
                t("athlete_accepted_invite", coach_lang).format(
                    name=user.athlete.full_name
                ),
            )
        except Exception:
            pass


@router.callback_query(F.data.startswith("invite_decline:"))
async def on_invite_decline(callback: CallbackQuery):
    async with async_session() as session:
        user_result = await session.execute(
            select(User).where(User.telegram_id == callback.from_user.id)
        )
        user = user_result.scalar_one_or_none()

    lang = (user.language if user else None) or "ru"
    await callback.message.edit_text(t("invite_declined_by_athlete", lang))
    await callback.answer()
