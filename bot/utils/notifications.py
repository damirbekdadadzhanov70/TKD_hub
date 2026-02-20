import asyncio
import logging
import uuid

from aiogram import Bot
from sqlalchemy.ext.asyncio import AsyncSession

from bot.config import settings
from bot.utils.helpers import t

logger = logging.getLogger(__name__)


async def _safe_send(bot: Bot, chat_id: int, text: str, retries: int = 1) -> None:
    """Send message with retry and full traceback on failure."""
    for attempt in range(1 + retries):
        try:
            await bot.send_message(chat_id, text)
            return
        except Exception:
            if attempt < retries:
                await asyncio.sleep(1)
            else:
                logger.exception(
                    "Failed to send message to %s after %d attempts",
                    chat_id,
                    1 + retries,
                )


async def create_notification(
    session: AsyncSession,
    user_id: uuid.UUID,
    type: str,
    title: str,
    body: str,
    role: str | None = None,
    ref_id: str | None = None,
) -> None:
    """Insert a notification row. Import model lazily to avoid circular imports.

    Args:
        role: Target role that should see this notification (e.g. 'admin', 'coach', 'athlete').
              None means visible regardless of active role.
        ref_id: Optional reference ID (e.g. coach_id for verify requests).
    """
    from db.models.notification import Notification

    notification = Notification(
        user_id=user_id,
        type=type,
        role=role,
        title=title,
        body=body,
        ref_id=ref_id,
    )
    session.add(notification)
    await session.flush()


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
        await _safe_send(bot, admin_id, text)


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
        await _safe_send(bot, admin_id, text)


async def notify_admins_account_deleted_by_admin(
    bot: Bot,
    full_name: str,
    username: str,
    lang: str = "ru",
) -> None:
    text = t("account_deleted_by_admin_notification", lang).format(
        name=full_name,
        username=username,
    )
    for admin_id in settings.admin_ids:
        await _safe_send(bot, admin_id, text)


async def notify_user_account_deleted(
    bot: Bot,
    telegram_id: int,
    lang: str = "ru",
) -> None:
    text = t("account_deleted_user_notification", lang)
    await _safe_send(bot, telegram_id, text)


async def notify_admins_account_created(
    bot: Bot,
    full_name: str,
    username: str,
    role: str,
    lang: str = "ru",
) -> None:
    role_label = {"athlete": "спортсмен", "coach": "тренер"}.get(role, role) if lang == "ru" else role
    text = t("account_created_admin_notification", lang).format(
        name=full_name,
        username=username,
        role=role_label,
    )
    for admin_id in settings.admin_ids:
        await _safe_send(bot, admin_id, text)


async def notify_admins_role_request(
    bot: Bot,
    full_name: str,
    username: str,
    role: str,
    lang: str = "ru",
) -> None:
    role_label = {"athlete": "спортсмен", "coach": "тренер"}.get(role, role) if lang == "ru" else role
    text = t("role_request_admin_notification", lang).format(
        name=full_name,
        username=username,
        role=role_label,
    )
    for admin_id in settings.admin_ids:
        await _safe_send(bot, admin_id, text)


async def notify_user_role_approved(
    bot: Bot,
    telegram_id: int,
    role: str,
    lang: str = "ru",
) -> None:
    role_label = {"athlete": "спортсмен", "coach": "тренер"}.get(role, role) if lang == "ru" else role
    text = t("role_request_approved_notification", lang).format(role=role_label)
    await _safe_send(bot, telegram_id, text)


async def notify_user_role_rejected(
    bot: Bot,
    telegram_id: int,
    role: str,
    lang: str = "ru",
) -> None:
    role_label = {"athlete": "спортсмен", "coach": "тренер"}.get(role, role) if lang == "ru" else role
    text = t("role_request_rejected_notification", lang).format(role=role_label)
    await _safe_send(bot, telegram_id, text)


async def notify_athlete_interest(
    bot: Bot,
    athlete_telegram_id: int,
    tournament_name: str,
    lang: str = "ru",
) -> None:
    text = t("interest_confirmed_athlete", lang).format(tournament=tournament_name)
    await _safe_send(bot, athlete_telegram_id, text)


async def notify_coach_athlete_interest(
    bot: Bot,
    coach_telegram_id: int,
    athlete_name: str,
    tournament_name: str,
    lang: str = "ru",
) -> None:
    text = t("interest_coach_notification", lang).format(
        athlete=athlete_name,
        tournament=tournament_name,
    )
    await _safe_send(bot, coach_telegram_id, text)


async def notify_coach_new_athlete_request(
    bot: Bot,
    coach_telegram_id: int,
    athlete_name: str,
    lang: str = "ru",
) -> None:
    text = t("new_athlete_request_coach_notification", lang).format(
        athlete=athlete_name,
    )
    await _safe_send(bot, coach_telegram_id, text)


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
    await _safe_send(bot, coach_telegram_id, text)
