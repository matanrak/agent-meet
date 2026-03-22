"""T009 - Raw asyncpg connection pool management."""

from __future__ import annotations

from typing import Optional

import asyncpg

from app.config import settings

_pool: Optional[asyncpg.Pool] = None


async def _set_search_path(conn: asyncpg.Connection) -> None:
    """Set search_path on each connection (Supavisor ignores server_settings)."""
    await conn.execute("SET search_path TO app, public")


async def init_pool() -> asyncpg.Pool:
    """Create and store the asyncpg connection pool."""
    global _pool
    _pool = await asyncpg.create_pool(
        dsn=settings.DATABASE_URL,
        statement_cache_size=0,
        min_size=5,
        max_size=settings.DB_POOL_MAX_SIZE,
        command_timeout=10.0,
        init=_set_search_path,
    )
    return _pool


async def close_pool() -> None:
    """Close the asyncpg connection pool."""
    global _pool
    if _pool is not None:
        await _pool.close()
        _pool = None


def get_pool() -> asyncpg.Pool:
    """Return the current pool. Raises if not initialized."""
    if _pool is None:
        raise RuntimeError("Database pool not initialized. Call init_pool() first.")
    return _pool
