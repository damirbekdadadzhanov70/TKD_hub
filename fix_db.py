import asyncio
import os

import asyncpg


async def main():
    url = os.environ["DATABASE_URL"].replace("postgresql+asyncpg://", "postgresql://")
    c = await asyncpg.connect(url)
    await c.execute("ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS photos_url VARCHAR(500)")
    await c.execute("ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS organizer_name VARCHAR(255)")
    await c.execute("ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS organizer_phone VARCHAR(50)")
    await c.execute("ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS organizer_telegram VARCHAR(100)")
    await c.execute("ALTER TABLE tournament_results ADD COLUMN IF NOT EXISTS gender VARCHAR(10)")
    rows = await c.fetch(
        "SELECT column_name FROM information_schema.columns WHERE table_name='tournaments'"
    )
    print("OK! Columns:", [r["column_name"] for r in rows])
    await c.close()


asyncio.run(main())
