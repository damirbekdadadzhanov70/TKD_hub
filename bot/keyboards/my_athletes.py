from uuid import UUID

from aiogram.types import InlineKeyboardButton, InlineKeyboardMarkup

from bot.utils.helpers import t


def athletes_list_keyboard(athletes: list[tuple[UUID, str]], lang: str) -> InlineKeyboardMarkup:
    buttons = []
    for athlete_id, name in athletes:
        buttons.append([InlineKeyboardButton(text=name, callback_data=f"view_athlete:{athlete_id}")])
    return InlineKeyboardMarkup(inline_keyboard=buttons)


def athlete_detail_keyboard(athlete_id: UUID, lang: str) -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [
                InlineKeyboardButton(
                    text=t("unlink_athlete", lang),
                    callback_data=f"unlink_athlete:{athlete_id}",
                ),
            ],
            [
                InlineKeyboardButton(
                    text=t("back", lang),
                    callback_data="back_to_athletes",
                ),
            ],
        ]
    )
