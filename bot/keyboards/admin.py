from uuid import UUID

from aiogram.types import InlineKeyboardButton, InlineKeyboardMarkup

from bot.utils.helpers import t


def pending_coaches_keyboard(
    coaches: list[tuple[UUID, str]], lang: str
) -> InlineKeyboardMarkup:
    buttons = []
    for request_id, name in coaches:
        buttons.append(
            [InlineKeyboardButton(
                text=name, callback_data=f"review_coach:{request_id}"
            )]
        )
    if not buttons:
        return InlineKeyboardMarkup(inline_keyboard=[])
    return InlineKeyboardMarkup(inline_keyboard=buttons)


def review_coach_keyboard(request_id: UUID, lang: str) -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(inline_keyboard=[
        [
            InlineKeyboardButton(
                text=t("approve", lang),
                callback_data=f"approve_coach:{request_id}",
            ),
            InlineKeyboardButton(
                text=t("decline", lang),
                callback_data=f"decline_coach:{request_id}",
            ),
        ]
    ])
