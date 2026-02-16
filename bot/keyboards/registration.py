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


RANKS = [
    ("Без разряда", "none"),
    ("3 разряд", "3rd"),
    ("2 разряд", "2nd"),
    ("1 разряд", "1st"),
    ("КМС", "kms"),
    ("МС", "ms"),
    ("МСМК", "msmk"),
    ("ЗМС", "zms"),
]

# Reverse mapping: callback value → display label
RANK_LABELS = {value: label for label, value in RANKS}


def rank_keyboard() -> InlineKeyboardMarkup:
    buttons = []
    row = []
    for label, value in RANKS:
        row.append(InlineKeyboardButton(text=label, callback_data=f"rank:{value}"))
        if len(row) == 2:
            buttons.append(row)
            row = []
    if row:
        buttons.append(row)
    return InlineKeyboardMarkup(inline_keyboard=buttons)


CITIES = [
    ("Москва", "Москва"),
    ("Санкт-Петербург", "Санкт-Петербург"),
    ("Казань", "Казань"),
    ("Екатеринбург", "Екатеринбург"),
    ("Нижний Новгород", "Нижний Новгород"),
    ("Рязань", "Рязань"),
    ("Махачкала", "Махачкала"),
    ("Новосибирск", "Новосибирск"),
    ("Краснодар", "Краснодар"),
    ("Владивосток", "Владивосток"),
]


def city_keyboard(lang: str) -> InlineKeyboardMarkup:
    buttons = []
    row = []
    for label, value in CITIES:
        row.append(InlineKeyboardButton(text=label, callback_data=f"city:{value}"))
        if len(row) == 2:
            buttons.append(row)
            row = []
    if row:
        buttons.append(row)
    buttons.append([InlineKeyboardButton(text=t("other_city", lang), callback_data="city:other")])
    return InlineKeyboardMarkup(inline_keyboard=buttons)


COUNTRIES = [
    ("🇷🇺 Россия", "Россия"),
    ("🇰🇬 Кыргызстан", "Кыргызстан"),
    ("🇰🇿 Казахстан", "Казахстан"),
    ("🇺🇿 Узбекистан", "Узбекистан"),
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
    buttons.append([InlineKeyboardButton(text=t("other_city", lang), callback_data="country:other")])
    return InlineKeyboardMarkup(inline_keyboard=buttons)


def club_skip_keyboard(lang: str) -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(
        inline_keyboard=[[InlineKeyboardButton(text=t("no_club", lang), callback_data="club:skip")]]
    )


def photo_skip_keyboard(lang: str) -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(
        inline_keyboard=[[InlineKeyboardButton(text=t("skip_photo", lang), callback_data="photo:skip")]]
    )
