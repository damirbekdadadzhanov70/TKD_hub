import asyncio
import logging

from aiogram import Bot, Dispatcher
from aiogram.client.default import DefaultBotProperties
from aiogram.enums import ParseMode
from aiogram.fsm.storage.memory import MemoryStorage

from bot.config import settings
from bot.handlers import (
    admin_coaches,
    entries,
    invite,
    my_athletes,
    registration,
    start,
    tournaments_admin,
    tournaments_view,
)
from bot.utils.scheduler import scheduler_loop

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


async def main():
    bot = Bot(
        token=settings.BOT_TOKEN,
        default=DefaultBotProperties(parse_mode=ParseMode.HTML),
    )
    dp = Dispatcher(storage=MemoryStorage())

    dp.include_router(start.router)
    dp.include_router(registration.router)
    dp.include_router(admin_coaches.router)
    dp.include_router(invite.router)
    dp.include_router(my_athletes.router)
    dp.include_router(tournaments_admin.router)
    dp.include_router(tournaments_view.router)
    dp.include_router(entries.router)

    async def on_startup(bot_instance: Bot) -> None:
        asyncio.create_task(scheduler_loop(bot_instance))
        logger.info("Scheduler started")

    dp.startup.register(on_startup)

    logger.info("Bot starting...")
    await dp.start_polling(bot)


if __name__ == "__main__":
    asyncio.run(main())
