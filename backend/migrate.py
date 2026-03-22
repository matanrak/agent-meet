"""Simple SQL migration runner for asyncpg."""
import asyncio
import os
from pathlib import Path


async def run_migrations():
    import asyncpg

    dsn = os.environ["DATABASE_URL"]
    conn = await asyncpg.connect(dsn=dsn, statement_cache_size=0)

    try:
        # Create migrations tracking table
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS _migrations (
                filename VARCHAR(255) PRIMARY KEY,
                applied_at TIMESTAMPTZ DEFAULT now()
            )
        """)

        # Get applied migrations
        applied = set()
        rows = await conn.fetch("SELECT filename FROM _migrations")
        for row in rows:
            applied.add(row["filename"])

        # Run pending migrations in order
        migration_dir = Path(__file__).parent / "migrations"
        for filepath in sorted(migration_dir.glob("*.sql")):
            filename = filepath.name
            if filename in applied:
                print(f"  SKIP {filename} (already applied)")
                continue

            print(f"  APPLY {filename}")
            sql = filepath.read_text()
            await conn.execute(sql)
            await conn.execute(
                "INSERT INTO _migrations (filename) VALUES ($1)",
                filename,
            )
            print(f"  OK {filename}")
    finally:
        await conn.close()


if __name__ == "__main__":
    print("Running migrations...")
    asyncio.run(run_migrations())
    print("Done.")
