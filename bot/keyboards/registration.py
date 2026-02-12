from aiogram.types import InlineKeyboardButton, InlineKeyboardMarkup

from bot.utils.helpers import t


def language_keyboard(pre_selected: str | None = None) -> InlineKeyboardMarkup:
    ru_label = "🇷🇺 Русский ✓" if pre_selected == "ru" else "🇷🇺 Русский"
    en_label = "🇬🇧 English ✓" if pre_selected == "en" else "🇬🇧 English"
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [
                InlineKeyboardButton(text=ru_label, callback_data="lang:ru"),
                InlineKeyboardButton(text=en_label, callback_data="lang:en"),
            ]
        ]
    )


def role_keyboard(lang: str) -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [
                InlineKeyboardButton(text=t("role_athlete", lang), callback_data="role:athlete"),
                InlineKeyboardButton(text=t("role_coach", lang), callback_data="role:coach"),
            ]
        ]
    )


def gender_keyboard(lang: str) -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [
                InlineKeyboardButton(text=t("gender_male", lang), callback_data="gender:M"),
                InlineKeyboardButton(text=t("gender_female", lang), callback_data="gender:F"),
            ]
        ]
    )


# WT senior weight categories
WEIGHT_CATEGORIES_MALE = [
    "54kg",
    "58kg",
    "63kg",
    "68kg",
    "74kg",
    "80kg",
    "87kg",
    "+87kg",
]
WEIGHT_CATEGORIES_FEMALE = [
    "46kg",
    "49kg",
    "53kg",
    "57kg",
    "62kg",
    "67kg",
    "73kg",
    "+73kg",
]


def weight_category_keyboard(gender: str) -> InlineKeyboardMarkup:
    categories = WEIGHT_CATEGORIES_MALE if gender == "M" else WEIGHT_CATEGORIES_FEMALE
    buttons = []
    row = []
    for cat in categories:
        row.append(InlineKeyboardButton(text=cat, callback_data=f"weight:{cat}"))
        if len(row) == 4:
            buttons.append(row)
            row = []
    if row:
        buttons.append(row)
    return InlineKeyboardMarkup(inline_keyboard=buttons)


BELTS = [
    ("10 гып (белый)", "white"),
    ("9 гып", "yellow_stripe"),
    ("8 гып (жёлтый)", "yellow"),
    ("7 гып", "green_stripe"),
    ("6 гып (зелёный)", "green"),
    ("5 гып", "blue_stripe"),
    ("4 гып (синий)", "blue"),
    ("3 гып", "red_stripe"),
    ("2 гып (красный)", "red"),
    ("1 гып", "red_black"),
    ("1 дан", "black_1dan"),
    ("2 дан", "black_2dan"),
    ("3 дан", "black_3dan"),
    ("4 дан", "black_4dan"),
    ("5 дан", "black_5dan"),
    ("6 дан", "black_6dan"),
    ("7 дан", "black_7dan"),
    ("8 дан", "black_8dan"),
    ("9 дан", "black_9dan"),
]


def belt_keyboard() -> InlineKeyboardMarkup:
    buttons = []
    row = []
    for label, value in BELTS:
        row.append(InlineKeyboardButton(text=label, callback_data=f"belt:{value}"))
        if len(row) == 2:
            buttons.append(row)
            row = []
    if row:
        buttons.append(row)
    return InlineKeyboardMarkup(inline_keyboard=buttons)


COUNTRIES = [
    ("🇰🇬 Кыргызстан", "Кыргызстан"),
    ("🇰🇿 Казахстан", "Казахстан"),
    ("🇺🇿 Узбекистан", "Узбекистан"),
    ("🇷🇺 Россия", "Россия"),
    ("🇹🇯 Таджикистан", "Таджикистан"),
    ("🇹🇲 Туркменистан", "Туркменистан"),
    ("🇬🇪 Грузия", "Грузия"),
    ("🇦🇲 Армения", "Армения"),
    ("🇦🇿 Азербайджан", "Азербайджан"),
    ("🇧🇾 Беларусь", "Беларусь"),
]


def country_keyboard(lang: str) -> InlineKeyboardMarkup:
    buttons = []
    row = []
    for label, value in COUNTRIES:
        row.append(InlineKeyboardButton(text=label, callback_data=f"country:{value}"))
        if len(row) == 2:
            buttons.append(row)
            row = []
    if row:
        buttons.append(row)
    buttons.append([InlineKeyboardButton(text=t("other_country", lang), callback_data="country:other")])
    return InlineKeyboardMarkup(inline_keyboard=buttons)


def club_skip_keyboard(lang: str) -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(
        inline_keyboard=[[InlineKeyboardButton(text=t("no_club", lang), callback_data="club:skip")]]
    )


def photo_skip_keyboard(lang: str) -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(
        inline_keyboard=[[InlineKeyboardButton(text=t("skip_photo", lang), callback_data="photo:skip")]]
    )
