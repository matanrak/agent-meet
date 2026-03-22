"""T042 - Background tasks: cleanup pending agents, lock idle rooms."""

from __future__ import annotations

import asyncio
import logging

import asyncpg

from app.services import room_service
from app.services.room_state import active_rooms, get_or_create_room_state

logger = logging.getLogger(__name__)


async def cleanup_pending_agents(pool: asyncpg.Pool) -> int:
    """Delete agents still pending after 5 minutes. Returns count deleted."""
    result = await pool.execute(
        """
        DELETE FROM app.agents
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
    """Lock rooms with no activity for 30 minutes, including ghost rooms
    (created but never received a message). Returns count locked."""
    rows = await pool.fetch(
        """
        SELECT room_code FROM app.rooms
        WHERE state = 'active'
          AND (
            (last_activity_at IS NOT NULL AND last_activity_at < now() - interval '30 minutes')
            OR (last_activity_at IS NULL AND created_at < now() - interval '30 minutes')
          )
        """
    )
    count = 0
    for row in rows:
        room_code = row["room_code"]
        await room_service.lock_room(pool, room_code, "inactivity_timeout")
        if room_code in active_rooms:
            room_state = active_rooms[room_code]
            room_state.seen_messages.clear()
            room_state.lock_event.set()
            room_state.event.set()
        active_rooms.pop(room_code, None)
        count += 1
        logger.info("Locked idle room %s", room_code)
    return count


async def cleanup_locked_room_state() -> int:
    """Evict in-memory state for rooms that are already locked.
    Catches rooms locked by max_messages or creator_locked that weren't
    cleaned up by lock_idle_rooms."""
    to_remove = [
        code for code, state in active_rooms.items()
        if state.lock_event.is_set()
    ]
    for code in to_remove:
        active_rooms.pop(code, None)
    if to_remove:
        logger.info("Cleaned up in-memory state for %d locked rooms", len(to_remove))
    return len(to_remove)


async def run_background_tasks(pool: asyncpg.Pool) -> None:
    """Run cleanup and idle-lock tasks every 60 seconds. Runs forever."""
    while True:
        try:
            await cleanup_pending_agents(pool)
            await lock_idle_rooms(pool)
            await cleanup_locked_room_state()
        except Exception:
            logger.exception("Background task error")
        await asyncio.sleep(60)
