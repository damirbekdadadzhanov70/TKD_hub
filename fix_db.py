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
    await c.execute("ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS results_url VARCHAR(500)")
    await c.execute("""
        CREATE TABLE IF NOT EXISTS tournament_files (
            id UUID PRIMARY KEY,
            tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
            category VARCHAR(20) NOT NULL DEFAULT 'protocol',
            filename VARCHAR(255) NOT NULL,
            blob_url VARCHAR(1000) NOT NULL,
            file_size INTEGER NOT NULL,
            file_type VARCHAR(50) NOT NULL,
            uploaded_by UUID REFERENCES users(id) ON DELETE SET NULL,
            created_at TIMESTAMP DEFAULT NOW()
        )
    """)
    await c.execute(
        "ALTER TABLE tournament_files ADD COLUMN IF NOT EXISTS category VARCHAR(20) NOT NULL DEFAULT 'protocol'"
    )
    # CSV results support
    await c.execute("ALTER TABLE tournament_results ALTER COLUMN athlete_id DROP NOT NULL")
    await c.execute("ALTER TABLE tournament_results ADD COLUMN IF NOT EXISTS raw_full_name VARCHAR(255)")
    await c.execute("ALTER TABLE tournament_results ADD COLUMN IF NOT EXISTS raw_weight_category VARCHAR(50)")
    # Replace old unique constraint with new one (idempotent)
    await c.execute("""
        DO $$ BEGIN
            ALTER TABLE tournament_results DROP CONSTRAINT IF EXISTS uq_tournament_results_tournament_id;
        EXCEPTION WHEN undefined_object THEN NULL;
        END $$
    """)
    await c.execute("""
        DO $$ BEGIN
            ALTER TABLE tournament_results ADD CONSTRAINT uq_tournament_results_csv
                UNIQUE (tournament_id, raw_full_name, weight_category);
        EXCEPTION WHEN duplicate_table THEN NULL;
        END $$
    """)
    rows = await c.fetch("SELECT column_name FROM information_schema.columns WHERE table_name='tournaments'")
    print("OK! Columns:", [r["column_name"] for r in rows])
    tf_rows = await c.fetch("SELECT column_name FROM information_schema.columns WHERE table_name='tournament_files'")
    print("tournament_files columns:", [r["column_name"] for r in tf_rows])
    await c.close()


asyncio.run(main())
