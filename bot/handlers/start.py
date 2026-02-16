from aiogram import Router
from aiogram.filters import CommandStart
from aiogram.filters.command import CommandObject
from aiogram.fsm.context import FSMContext
from aiogram.types import (
    InlineKeyboardButton,
    InlineKeyboardMarkup,
    Message,
    WebAppInfo,
)
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from bot.config import settings
from bot.utils.helpers import t
from db.base import async_session
from db.models.user import User

router = Router()


def _webapp_keyboard(lang: str) -> InlineKeyboardMarkup:
    """Inline keyboard with a single WebApp button."""
    label = "Открыть приложение" if lang == "ru" else "Open App"
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [
                InlineKeyboardButton(
                    text=label,
                    web_app=WebAppInfo(url=settings.WEBAPP_URL),
                )
            ]
        ]
    )


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

        if not user:
            # Determine language from Telegram client
            tg_lang = (message.from_user.language_code or "")[:2].lower()
            lang = tg_lang if tg_lang in ("ru", "en") else "ru"

            user = User(
                telegram_id=message.from_user.id,
                username=message.from_user.username,
                language=lang,
            )
            session.add(user)
            await session.commit()
        else:
            lang = user.language or "ru"

    # Send WebApp button
    await message.answer(
        t("welcome_webapp", lang),
        reply_markup=_webapp_keyboard(lang),
    )
