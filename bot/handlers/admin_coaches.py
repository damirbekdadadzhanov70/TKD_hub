from datetime import datetime, timezone

from aiogram import F, Router
from aiogram.filters import Command
from aiogram.fsm.context import FSMContext
from aiogram.types import CallbackQuery, Message
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from bot.config import settings
from bot.keyboards.admin import admin_menu_keyboard, pending_coaches_keyboard, review_coach_keyboard
from bot.states.admin import DeclineCoach
from bot.utils.helpers import t
from db.base import async_session
from db.models.coach import Coach
from db.models.role_request import RoleRequest
from db.models.user import User

router = Router()


async def _get_user_lang(telegram_id: int) -> str:
    async with async_session() as session:
        result = await session.execute(
            select(User.language).where(User.telegram_id == telegram_id)
        )
        lang = result.scalar_one_or_none()
    return lang or "ru"


@router.message(Command("admin"))
async def cmd_admin(message: Message):
    if message.from_user.id not in settings.admin_ids:
        return

    lang = await _get_user_lang(message.from_user.id)
    await message.answer(
        t("admin_menu", lang),
        reply_markup=admin_menu_keyboard(lang),
    )


@router.callback_query(F.data.startswith("admin_action:"))
async def on_admin_action(callback: CallbackQuery):
    if callback.from_user.id not in settings.admin_ids:
        await callback.answer()
        return

    lang = await _get_user_lang(callback.from_user.id)
    action = callback.data.split(":")[1]

    if action == "pending_coaches":
        async with async_session() as session:
            result = await session.execute(
                select(RoleRequest)
                .where(
                    RoleRequest.requested_role == "coach",
                    RoleRequest.status == "pending",
                )
                .options(selectinload(RoleRequest.user).selectinload(User.coach))
            )
            requests = result.scalars().all()

        if not requests:
            await callback.message.edit_text(t("no_pending_coaches", lang))
        else:
            coaches_list = []
            for req in requests:
                coach = req.user.coach
                name = coach.full_name if coach else f"User {req.user.telegram_id}"
                coaches_list.append((req.id, name))
            await callback.message.edit_text(
                t("pending_coaches_list", lang),
                reply_markup=pending_coaches_keyboard(coaches_list, lang),
            )
    elif action == "add_tournament":
        await callback.message.edit_text(
            t("admin_use_command", lang).format(command="/add_tournament")
        )
    elif action == "edit_tournament":
        await callback.message.edit_text(
            t("admin_use_command", lang).format(command="/edit_tournament")
        )
    elif action == "delete_tournament":
        await callback.message.edit_text(
            t("admin_use_command", lang).format(command="/delete_tournament")
        )

    await callback.answer()


@router.message(Command("pending_coaches"))
async def cmd_pending_coaches(message: Message):
    if message.from_user.id not in settings.admin_ids:
        return

    lang = await _get_user_lang(message.from_user.id)

    async with async_session() as session:
        result = await session.execute(
            select(RoleRequest)
            .where(
                RoleRequest.requested_role == "coach",
                RoleRequest.status == "pending",
            )
            .options(selectinload(RoleRequest.user).selectinload(User.coach))
        )
        requests = result.scalars().all()

    if not requests:
        await message.answer(t("no_pending_coaches", lang))
        return

    coaches_list = []
    for req in requests:
        coach = req.user.coach
        name = coach.full_name if coach else f"User {req.user.telegram_id}"
        coaches_list.append((req.id, name))

    await message.answer(
        t("pending_coaches_list", lang),
        reply_markup=pending_coaches_keyboard(coaches_list, lang),
    )


@router.callback_query(F.data.startswith("review_coach:"))
async def on_review_coach(callback: CallbackQuery):
    if callback.from_user.id not in settings.admin_ids:
        await callback.answer()
        return

    lang = await _get_user_lang(callback.from_user.id)
    request_id = callback.data.split(":")[1]

    async with async_session() as session:
        result = await session.execute(
            select(RoleRequest)
            .where(RoleRequest.id == request_id)
            .options(selectinload(RoleRequest.user).selectinload(User.coach))
        )
        req = result.scalar_one_or_none()

    if not req:
        await callback.message.edit_text(t("request_not_found", lang))
        await callback.answer()
        return

    coach = req.user.coach
    if not coach:
        await callback.message.edit_text(t("request_not_found", lang))
        await callback.answer()
        return

    text = t("coach_review_card", lang).format(
        name=coach.full_name,
        club=coach.club,
        city=coach.city,
        country=coach.country,
        qualification=coach.qualification,
    )

    await callback.message.edit_text(
        text, reply_markup=review_coach_keyboard(req.id, lang)
    )
    await callback.answer()


@router.callback_query(F.data.startswith("approve_coach:"))
async def on_approve_coach(callback: CallbackQuery):
    if callback.from_user.id not in settings.admin_ids:
        await callback.answer()
        return

    lang = await _get_user_lang(callback.from_user.id)
    request_id = callback.data.split(":")[1]

    async with async_session() as session:
        result = await session.execute(
            select(RoleRequest)
            .where(RoleRequest.id == request_id)
            .options(selectinload(RoleRequest.user).selectinload(User.coach))
        )
        req = result.scalar_one_or_none()

        if not req or req.status != "pending":
            await callback.message.edit_text(t("request_not_found", lang))
            await callback.answer()
            return

        req.status = "approved"
        req.reviewed_at = datetime.now(timezone.utc)

        coach = req.user.coach
        if coach:
            coach.is_verified = True

        await session.commit()

    await callback.message.edit_text(t("coach_approved", lang))
    await callback.answer()

    # Notify the coach
    if req.user:
        coach_lang = req.user.language or "ru"
        try:
            await callback.bot.send_message(
                req.user.telegram_id,
                t("your_coach_approved", coach_lang),
            )
        except Exception:
            pass


@router.callback_query(F.data.startswith("decline_coach:"))
async def on_decline_coach(callback: CallbackQuery, state: FSMContext):
    if callback.from_user.id not in settings.admin_ids:
        await callback.answer()
        return

    lang = await _get_user_lang(callback.from_user.id)
    request_id = callback.data.split(":")[1]

    async with async_session() as session:
        result = await session.execute(
            select(RoleRequest)
            .where(RoleRequest.id == request_id)
        )
        req = result.scalar_one_or_none()

        if not req or req.status != "pending":
            await callback.message.edit_text(t("request_not_found", lang))
            await callback.answer()
            return

    await state.update_data(decline_request_id=request_id, language=lang)
    await state.set_state(DeclineCoach.enter_reason)
    await callback.message.edit_text(t("enter_decline_reason", lang))
    await callback.answer()


@router.message(DeclineCoach.enter_reason)
async def on_decline_reason(message: Message, state: FSMContext):
    data = await state.get_data()
    lang = data.get("language", "ru")
    request_id = data["decline_request_id"]
    reason = message.text.strip()

    async with async_session() as session:
        result = await session.execute(
            select(RoleRequest)
            .where(RoleRequest.id == request_id)
            .options(selectinload(RoleRequest.user))
        )
        req = result.scalar_one_or_none()

        if not req or req.status != "pending":
            await message.answer(t("request_not_found", lang))
            await state.clear()
            return

        req.status = "declined"
        req.admin_comment = reason
        req.reviewed_at = datetime.now(timezone.utc)
        await session.commit()

    await state.clear()
    await message.answer(t("coach_declined_with_reason", lang))

    if req.user:
        coach_lang = req.user.language or "ru"
        try:
            await message.bot.send_message(
                req.user.telegram_id,
                t("your_coach_declined_reason", coach_lang).format(reason=reason),
            )
        except Exception:
            pass
