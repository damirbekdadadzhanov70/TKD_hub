from uuid import UUID

from aiogram.types import InlineKeyboardButton, InlineKeyboardMarkup

from bot.utils.helpers import t


def athlete_checkbox_keyboard(
    athletes: list[tuple[UUID, str]],
    selected: set[str],
    lang: str,
) -> InlineKeyboardMarkup:
    buttons = []
    for athlete_id, name in athletes:
        check = "✅" if str(athlete_id) in selected else "⬜"
        buttons.append(
            [InlineKeyboardButton(
                text=f"{check} {name}",
                callback_data=f"toggle_athlete:{athlete_id}",
            )]
        )
    buttons.append(
        [InlineKeyboardButton(
            text=t("confirm_selection", lang),
            callback_data="confirm_athletes_selection",
        )]
    )
    buttons.append(
        [InlineKeyboardButton(text=t("cancel", lang), callback_data="entry_cancel")]
    )
    return InlineKeyboardMarkup(inline_keyboard=buttons)


def age_category_keyboard(
    categories: list[str], lang: str
) -> InlineKeyboardMarkup:
    buttons = []
    for cat in categories:
        buttons.append(
            [InlineKeyboardButton(text=cat, callback_data=f"entry_age:{cat}")]
        )
    buttons.append(
        [InlineKeyboardButton(text=t("cancel", lang), callback_data="entry_cancel")]
    )
    return InlineKeyboardMarkup(inline_keyboard=buttons)


def confirm_entries_keyboard(lang: str) -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(inline_keyboard=[
        [
            InlineKeyboardButton(
                text=t("confirm", lang), callback_data="confirm_entries"
            ),
            InlineKeyboardButton(
                text=t("cancel", lang), callback_data="entry_cancel"
            ),
        ]
    ])


def my_entries_keyboard(
    entries: list[tuple[UUID, str, str]], lang: str
) -> InlineKeyboardMarkup:
    """Each tuple: (tournament_id, tournament_name, athlete_count_str)."""
    buttons = []
    for tid, name, count in entries:
        buttons.append(
            [InlineKeyboardButton(
                text=f"{name} ({count})",
                callback_data=f"view_entries:{tid}",
            )]
        )
    return InlineKeyboardMarkup(inline_keyboard=buttons)


def entry_detail_keyboard(
    entries: list[tuple[UUID, str]],
    tournament_id: UUID,
    lang: str,
    *,
    can_withdraw: bool = True,
) -> InlineKeyboardMarkup:
    """entries: list of (entry_id, athlete_name)."""
    buttons = []
    if can_withdraw:
        for entry_id, name in entries:
            buttons.append(
                [InlineKeyboardButton(
                    text=f"❌ {name}",
                    callback_data=f"withdraw:{entry_id}",
                )]
            )
    buttons.append(
        [InlineKeyboardButton(
            text=t("back", lang), callback_data="back_my_entries"
        )]
    )
    return InlineKeyboardMarkup(inline_keyboard=buttons)
