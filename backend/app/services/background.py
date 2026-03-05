"""T042 - Background tasks: cleanup pending agents, lock idle rooms."""

from __future__ import annotations

import asyncio
import logging

import asyncpg

from app.services import room_service
from app.services.room_state import get_or_create_room_state

logger = logging.getLogger(__name__)


async def cleanup_pending_agents(pool: asyncpg.Pool) -> int:
    """Delete agents still pending after 5 minutes. Returns count deleted."""
    result = await pool.execute(
        """
        DELETE FROM agents
        WHERE status = 'pending'
          AND created_at < now() - interval '5 minutes'
        """
    )
    # result is like "DELETE N"
    try:
        count = int(result.split()[-1])
    except (ValueError, IndexError):
        count = 0
    if count > 0:
        logger.info("Cleaned up %d pending agents", count)
    return count


async def lock_idle_rooms(pool: asyncpg.Pool) -> int:
    """Lock rooms with no activity for 30 minutes. Returns count locked."""
    rows = await pool.fetch(
        """
        SELECT room_code FROM rooms
        WHERE state = 'active'
          AND last_activity_at IS NOT NULL
          AND last_activity_at < now() - interval '30 minutes'
        """
    )
    count = 0
    for row in rows:
        room_code = row["room_code"]
        await room_service.lock_room(pool, room_code, "inactivity_timeout")
        # Notify waiters
        room_state = get_or_create_room_state(room_code)
        room_state.lock_event.set()
        room_state.event.set()
        count += 1
        logger.info("Locked idle room %s", room_code)
    return count


async def run_background_tasks(pool: asyncpg.Pool) -> None:
    """Run cleanup and idle-lock tasks every 60 seconds. Runs forever."""
    while True:
        try:
            await cleanup_pending_agents(pool)
            await lock_idle_rooms(pool)
        except Exception:
            logger.exception("Background task error")
        await asyncio.sleep(60)
