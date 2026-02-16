import asyncio
import logging
from datetime import date, timedelta

from aiogram import Bot
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from bot.utils.helpers import t
from db.base import async_session
from db.models.coach import Coach, CoachAthlete
from db.models.tournament import Tournament, TournamentEntry

logger = logging.getLogger(__name__)

# Track (tournament_id, coach_id) pairs already notified today
_notified_today: set[tuple[str, str]] = set()
_notified_date: date | None = None


def _reset_if_new_day() -> None:
    global _notified_date  # noqa: PLW0603
    today = date.today()
    if _notified_date != today:
        _notified_today.clear()
        _notified_date = today


async def check_deadline_reminders(bot: Bot) -> None:
    _reset_if_new_day()

    target_date = date.today() + timedelta(days=3)

    async with async_session() as session:
        result = await session.execute(
            select(Tournament).where(
                Tournament.registration_deadline == target_date,
                Tournament.status == "upcoming",
            )
        )
        tournaments = result.scalars().all()

    if not tournaments:
        return

    async with async_session() as session:
        result = await session.execute(
            select(Coach)
            .where(Coach.is_verified.is_(True))
            .options(
                selectinload(Coach.user),
                selectinload(Coach.athlete_links).selectinload(CoachAthlete.athlete),
            )
        )
        coaches = result.scalars().all()

    for tournament in tournaments:
        for coach in coaches:
            if not coach.user or not coach.athlete_links:
                continue

            key = (str(tournament.id), str(coach.id))
            if key in _notified_today:
                continue

            athlete_ids = {link.athlete_id for link in coach.athlete_links if link.status == "accepted"}
            if not athlete_ids:
                continue

            async with async_session() as session:
                result = await session.execute(
                    select(TournamentEntry.athlete_id).where(
                        TournamentEntry.tournament_id == tournament.id,
                        TournamentEntry.coach_id == coach.id,
                    )
                )
                entered_ids = set(result.scalars().all())

            unregistered = athlete_ids - entered_ids
            if not unregistered:
                continue

            lang = coach.user.language or "ru"
            try:
                await bot.send_message(
                    coach.user.telegram_id,
                    t("deadline_reminder", lang).format(
                        tournament=tournament.name,
                        deadline=tournament.registration_deadline.strftime("%d.%m.%Y"),
                        count=len(unregistered),
                    ),
                )
                _notified_today.add(key)
            except Exception:
                logger.warning("Failed to send deadline reminder to coach %s", coach.id)


async def scheduler_loop(bot: Bot) -> None:
    while True:
        try:
            await check_deadline_reminders(bot)
        except Exception:
            logger.exception("Error in deadline reminder check")

        await asyncio.sleep(4 * 60 * 60)
