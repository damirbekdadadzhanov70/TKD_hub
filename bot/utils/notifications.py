import logging

from aiogram import Bot

from bot.config import settings
from bot.utils.helpers import t

logger = logging.getLogger(__name__)


async def notify_admins_new_entry(
    bot: Bot,
    tournament_name: str,
    coach_name: str,
    count: int,
    lang: str = "ru",
) -> None:
    text = t("new_entry_admin_notification", lang).format(
        tournament=tournament_name,
        coach=coach_name,
        count=count,
    )
    for admin_id in settings.admin_ids:
        try:
            await bot.send_message(admin_id, text)
        except Exception:
            logger.warning("Failed to notify admin %s", admin_id)


async def notify_admins_account_deleted(
    bot: Bot,
    full_name: str,
    username: str,
    lang: str = "ru",
) -> None:
    text = t("account_deleted_admin_notification", lang).format(
        name=full_name,
        username=username,
    )
    for admin_id in settings.admin_ids:
        try:
            await bot.send_message(admin_id, text)
        except Exception:
            logger.warning("Failed to notify admin %s about account deletion", admin_id)


async def notify_coach_entry_status(
    bot: Bot,
    coach_telegram_id: int,
    tournament_name: str,
    athlete_name: str,
    status: str,
    lang: str = "ru",
) -> None:
    key = "entry_approved_notification" if status == "approved" else "entry_rejected_notification"
    text = t(key, lang).format(
        tournament=tournament_name,
        athlete=athlete_name,
    )
    try:
        await bot.send_message(coach_telegram_id, text)
    except Exception:
        logger.warning("Failed to notify coach %s", coach_telegram_id)
