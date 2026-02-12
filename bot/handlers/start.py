from aiogram import F, Router
from aiogram.filters import CommandStart
from aiogram.filters.command import CommandObject
from aiogram.fsm.context import FSMContext
from aiogram.types import CallbackQuery, Message
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from bot.keyboards.registration import language_keyboard, role_keyboard
from bot.states.registration import AthleteRegistration, CoachRegistration
from bot.utils.callback import CallbackParseError, parse_callback
from bot.utils.helpers import t
from db.base import async_session
from db.models.user import User

router = Router()


@router.message(CommandStart())
async def cmd_start(message: Message, state: FSMContext, command: CommandObject):
    await state.clear()

    # Handle invite deep link
    if command.args and command.args.startswith("invite_"):
        from bot.handlers.invite import handle_invite_deep_link

        await handle_invite_deep_link(message, state, command.args)
        return

    async with async_session() as session:
        result = await session.execute(
            select(User)
            .where(User.telegram_id == message.from_user.id)
            .options(selectinload(User.athlete), selectinload(User.coach))
        )
        user = result.scalar_one_or_none()

    if user and (user.athlete or user.coach):
        lang = user.language or "ru"
        await message.answer(t("already_registered", lang))
        return

    tg_lang = (message.from_user.language_code or "")[:2].lower()
    pre_selected = tg_lang if tg_lang in ("ru", "en") else None
    await message.answer(
        "🥋 Добро пожаловать в TKD Hub!\nВыберите язык / Choose language:",
        reply_markup=language_keyboard(pre_selected=pre_selected),
    )


@router.callback_query(F.data.startswith("lang:"))
async def on_language_chosen(callback: CallbackQuery, state: FSMContext):
    try:
        parts = parse_callback(callback.data, "lang")
    except CallbackParseError:
        await callback.answer("Error")
        return
    lang = parts[1]
    await state.update_data(language=lang)

    async with async_session() as session:
        result = await session.execute(select(User).where(User.telegram_id == callback.from_user.id))
        user = result.scalar_one_or_none()

        if not user:
            user = User(
                telegram_id=callback.from_user.id,
                username=callback.from_user.username,
                language=lang,
            )
            session.add(user)
            await session.commit()
            await session.refresh(user)
        else:
            user.language = lang
            await session.commit()

    await state.update_data(user_id=str(user.id))

    await callback.message.edit_text(
        t("choose_role", lang),
        reply_markup=role_keyboard(lang),
    )
    await callback.answer()


@router.callback_query(F.data.startswith("role:"))
async def on_role_chosen(callback: CallbackQuery, state: FSMContext):
    try:
        parts = parse_callback(callback.data, "role")
    except CallbackParseError:
        await callback.answer("Error")
        return
    role = parts[1]
    data = await state.get_data()
    lang = data.get("language", "ru")
    await state.update_data(role=role)

    await callback.message.edit_text(t("enter_full_name", lang))

    if role == "athlete":
        await state.set_state(AthleteRegistration.full_name)
    else:
        await state.set_state(CoachRegistration.full_name)

    await callback.answer()
