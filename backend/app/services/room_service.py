"""T014 - Room service: CRUD operations on rooms table."""

from __future__ import annotations

import secrets
from datetime import datetime, timezone
from typing import Any, Dict, Optional

import asyncpg


def generate_room_code() -> str:
    """Generate a room code in xxx-xxxx-xxxx format (lowercase hex)."""
    raw = secrets.token_hex(6)  # 12 hex chars
    # Take first 11 chars, split as 3-4-4
    return f"{raw[:3]}-{raw[3:7]}-{raw[7:11]}"


def generate_creator_token() -> str:
    """Generate a creator token: 'ct_' + 24 hex chars."""
    return "ct_" + secrets.token_hex(12)


async def create_room(
    pool: asyncpg.Pool,
    max_messages: int = 50,
    goal: str = "chat",
) -> Dict[str, Any]:
    """Insert a new room and return its details."""
    room_code = generate_room_code()
    creator_token = generate_creator_token()

    row = await pool.fetchrow(
        """
        INSERT INTO app.rooms (room_code, creator_token, max_messages, goal)
        VALUES ($1, $2, $3, $4)
        RETURNING room_code, creator_token, max_messages, goal, created_at
        """,
        room_code,
        creator_token,
        max_messages,
        goal,
    )
    return dict(row)


async def get_room(
    pool: asyncpg.Pool,
    room_code: str,
) -> Optional[Dict[str, Any]]:
    """Fetch a single room by room_code. Returns None if not found."""
    row = await pool.fetchrow(
        "SELECT * FROM app.rooms WHERE room_code = $1",
        room_code,
    )
    return dict(row) if row else None


async def get_room_status(
    pool: asyncpg.Pool,
    room_code: str,
) -> Optional[Dict[str, Any]]:
    """Get room with agent counts for the status endpoint."""
    room = await get_room(pool, room_code)
    if room is None:
        return None

    counts = await pool.fetchrow(
        """
        SELECT
            COALESCE(SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END), 0) AS active,
            COALESCE(SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END), 0) AS pending
        FROM app.agents
        WHERE room_code = $1
        """,
        room_code,
    )

    return {
        "room_code": room["room_code"],
        "state": room["state"],
        "goal": room.get("goal", "chat"),
        "agents": {"active": counts["active"], "pending": counts["pending"]},
        "message_count": room["message_count"],
        "max_messages": room["max_messages"],
        "created_at": room["created_at"],
        "first_message_at": room.get("first_message_at"),
        "locked_at": room.get("locked_at"),
        "lock_reason": room.get("lock_reason"),
    }


async def lock_room(
    pool: asyncpg.Pool,
    room_code: str,
    reason: str,
) -> Dict[str, Any]:
    """Lock a room with the given reason. Returns updated room data."""
    now = datetime.now(timezone.utc)
    row = await pool.fetchrow(
        """
        UPDATE app.rooms
        SET state = 'locked', lock_reason = $2, locked_at = $3
        WHERE room_code = $1
        RETURNING room_code, state, locked_at, lock_reason
        """,
        room_code,
        reason,
        now,
    )
    return dict(row) if row else {}


async def change_goal(
    pool: asyncpg.Pool,
    room_code: str,
    creator_token: str,
    goal: str,
) -> Optional[Dict[str, str]]:
    """Change the room goal. Returns old_goal and new_goal, or None if auth fails."""
    valid = await validate_creator_token(pool, room_code, creator_token)
    if not valid:
        return None

    # Use CTE to capture old value before the update
    row = await pool.fetchrow(
        """
        WITH old AS (
            SELECT goal FROM app.rooms WHERE room_code = $1
        )
        UPDATE app.rooms
        SET goal = $2
        WHERE room_code = $1
        RETURNING (SELECT goal FROM old) AS old_goal, goal AS new_goal
        """,
        room_code,
        goal,
    )
    if row is None:
        return None
    return {"old_goal": row["old_goal"], "new_goal": row["new_goal"]}


async def validate_creator_token(
    pool: asyncpg.Pool,
    room_code: str,
    token: str,
) -> bool:
    """Check if the creator_token matches the room."""
    result = await pool.fetchval(
        "SELECT creator_token = $2 FROM app.rooms WHERE room_code = $1",
        room_code,
        token,
    )
    return bool(result)
