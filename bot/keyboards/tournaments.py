from uuid import UUID

from aiogram.types import InlineKeyboardButton, InlineKeyboardMarkup

from bot.utils.helpers import t


def tournaments_list_keyboard(
    tournaments: list[tuple[UUID, str, str]], lang: str
) -> InlineKeyboardMarkup:
    """Each tuple: (tournament_id, name, start_date_str)."""
    buttons = []
    for tid, name, date_str in tournaments:
        buttons.append(
            [InlineKeyboardButton(
                text=f"{name} ({date_str})",
                callback_data=f"tournament_detail:{tid}",
            )]
        )
    return InlineKeyboardMarkup(inline_keyboard=buttons)


def tournament_detail_keyboard(
    tournament_id: UUID, lang: str, *, is_coach: bool = False
) -> InlineKeyboardMarkup:
    buttons = []
    if is_coach:
        buttons.append(
            [InlineKeyboardButton(
                text=t("enter_athletes", lang),
                callback_data=f"tournament_enter:{tournament_id}",
            )]
        )
    buttons.append(
        [InlineKeyboardButton(
            text=t("back", lang), callback_data="back_to_tournaments"
        )]
    )
    return InlineKeyboardMarkup(inline_keyboard=buttons)


# ── Admin keyboards ──────────────────────────────────────


def admin_tournaments_keyboard(
    tournaments: list[tuple[UUID, str]], lang: str, *, action: str
) -> InlineKeyboardMarkup:
    """action = 'edit' or 'delete'."""
    buttons = []
    for tid, name in tournaments:
        buttons.append(
            [InlineKeyboardButton(
                text=name, callback_data=f"t_{action}:{tid}"
            )]
        )
    buttons.append(
        [InlineKeyboardButton(text=t("cancel", lang), callback_data="t_cancel")]
    )
    return InlineKeyboardMarkup(inline_keyboard=buttons)


def edit_fields_keyboard(tournament_id: UUID, lang: str) -> InlineKeyboardMarkup:
    fields = [
        ("name", t("field_name", lang)),
        ("description", t("field_description", lang)),
        ("start_date", t("field_start_date", lang)),
        ("end_date", t("field_end_date", lang)),
        ("city", t("field_city", lang)),
        ("country", t("field_country", lang)),
        ("venue", t("field_venue", lang)),
        ("age_categories", t("field_age_categories", lang)),
        ("weight_categories", t("field_weight_categories", lang)),
        ("entry_fee", t("field_entry_fee", lang)),
        ("currency", t("field_currency", lang)),
        ("registration_deadline", t("field_deadline", lang)),
        ("importance_level", t("field_importance", lang)),
    ]
    buttons = []
    for field, label in fields:
        buttons.append(
            [InlineKeyboardButton(
                text=label,
                callback_data=f"t_edit_field:{tournament_id}:{field}",
            )]
        )
    buttons.append(
        [InlineKeyboardButton(text=t("cancel", lang), callback_data="t_cancel")]
    )
    return InlineKeyboardMarkup(inline_keyboard=buttons)


def confirm_delete_keyboard(tournament_id: UUID, lang: str) -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(inline_keyboard=[
        [
            InlineKeyboardButton(
                text=t("confirm_delete", lang),
                callback_data=f"t_confirm_delete:{tournament_id}",
            ),
            InlineKeyboardButton(
                text=t("cancel", lang), callback_data="t_cancel"
            ),
        ]
    ])


def currency_keyboard() -> InlineKeyboardMarkup:
    currencies = ["USD", "KGS", "KZT", "RUB"]
    buttons = [
        InlineKeyboardButton(text=c, callback_data=f"currency:{c}")
        for c in currencies
    ]
    return InlineKeyboardMarkup(inline_keyboard=[buttons])


def importance_keyboard() -> InlineKeyboardMarkup:
    buttons = [
        InlineKeyboardButton(text="⭐" * i, callback_data=f"importance:{i}")
        for i in range(1, 6)
    ]
    return InlineKeyboardMarkup(inline_keyboard=[buttons])


def confirm_tournament_keyboard(lang: str) -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(inline_keyboard=[
        [
            InlineKeyboardButton(
                text=t("confirm", lang), callback_data="t_confirm_create"
            ),
            InlineKeyboardButton(
                text=t("cancel", lang), callback_data="t_cancel"
            ),
        ]
    ])
