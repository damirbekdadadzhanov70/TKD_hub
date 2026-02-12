from uuid import UUID

from aiogram.types import InlineKeyboardButton, InlineKeyboardMarkup

from bot.utils.helpers import t


def invite_decision_keyboard(coach_id: UUID, lang: str) -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [
                InlineKeyboardButton(
                    text=t("accept_invite", lang),
                    callback_data=f"invite_accept:{coach_id}",
                ),
                InlineKeyboardButton(
                    text=t("decline_invite", lang),
                    callback_data=f"invite_decline:{coach_id}",
                ),
            ]
        ]
    )
