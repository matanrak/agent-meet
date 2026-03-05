"""T026 - Message service: sending messages and polling."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

import asyncpg

from app.services import agent_service, room_service
from app.services.room_state import get_or_create_room_state
from app.models.message import RoomEvent


class MessageError(Exception):
    """Custom error with status code and error details."""

    def __init__(self, status_code: int, error: str, message: str, **extra: Any):
        self.status_code = status_code
        self.error = error
        self.message = message
        self.extra = extra
        super().__init__(message)


async def send_message(
    pool: asyncpg.Pool,
    room_code: str,
    agent_id: str,
    agent_name: str,
    content: str,
) -> Dict[str, Any]:
    """
    Send a message to a room.

    Handles agent activation, name updates, room locking on max messages.
    Returns message_id, timestamp, room_message_count, max_messages.
    Raises MessageError on validation failures.
    """
    # 1. Check room exists and is active
    room = await room_service.get_room(pool, room_code)
    if room is None:
        raise MessageError(404, "room_not_found", "No room with this code exists")
    if room["state"] == "locked":
        raise MessageError(
            423,
            "room_locked",
            "This room is locked and read-only. No new messages or agents allowed.",
        )

    # 2. Check agent exists and belongs to room
    agent = await agent_service.validate_agent(pool, agent_id, room_code)
    if agent is None:
        raise MessageError(422, "unknown_agent", "agent_id not registered in this room")

    # 3. Handle agent status
    status = agent["status"]
    if status == "pending":
        # Check active agent count < 20
        active_count = await agent_service.count_active_agents(pool, room_code)
        if active_count >= 20:
            raise MessageError(
                409,
                "room_full",
                "Room has reached the maximum of 20 active agents",
                max_agents=20,
            )
        # Activate the agent
        await agent_service.activate_agent(pool, agent_id, agent_name)
        # Fire agent_joined event
        room_state = get_or_create_room_state(room_code)
        room_state.pending_events.append(
            RoomEvent(
                type="agent_joined",
                agent_id=agent_id,
                agent_name=agent_name,
                timestamp=datetime.now(timezone.utc),
            )
        )
    elif status == "active":
        # Update name if changed
        if agent.get("agent_name") != agent_name:
            await agent_service.update_agent_name(pool, agent_id, agent_name)
    elif status in ("left", "kicked"):
        raise MessageError(
            403,
            "agent_inactive",
            "Agent has been kicked or has left the room",
        )

    # 4. Insert message
    row = await pool.fetchrow(
        """
        INSERT INTO app.messages (room_code, agent_id, agent_name, content)
        VALUES ($1, $2, $3, $4)
        RETURNING id, created_at
        """,
        room_code,
        agent_id,
        agent_name,
        content,
    )
    message_id = row["id"]
    timestamp = row["created_at"]

    # 5. Update room counters
    updated = await pool.fetchrow(
        """
        UPDATE app.rooms
        SET message_count = message_count + 1,
            last_activity_at = now(),
            first_message_at = COALESCE(first_message_at, now())
        WHERE room_code = $1
        RETURNING message_count, max_messages
        """,
        room_code,
    )
    room_message_count = updated["message_count"]
    max_messages = updated["max_messages"]

    # 6. Check if we should auto-lock
    if room_message_count >= max_messages:
        await room_service.lock_room(pool, room_code, "max_messages_reached")
        room_state = get_or_create_room_state(room_code)
        room_state.lock_event.set()

    # 7. Wake waiters
    room_state = get_or_create_room_state(room_code)
    room_state.event.set()

    return {
        "message_id": message_id,
        "timestamp": timestamp,
        "room_message_count": room_message_count,
        "max_messages": max_messages,
    }


async def get_messages_after(
    pool: asyncpg.Pool,
    room_code: str,
    after_id: int,
) -> List[Dict[str, Any]]:
    """Get messages in a room with ID > after_id, ordered by ID."""
    rows = await pool.fetch(
        """
        SELECT id AS message_id, agent_id, agent_name, content, created_at AS timestamp
        FROM app.messages
        WHERE room_code = $1 AND id > $2
        ORDER BY id
        """,
        room_code,
        after_id,
    )
    return [dict(r) for r in rows]


async def get_recent_messages(
    pool: asyncpg.Pool,
    room_code: str,
    limit: Optional[int] = None,
) -> List[Dict[str, Any]]:
    """Get recent messages, optionally limited. If limit is None, get all."""
    if limit is not None and limit == 0:
        return []

    if limit is not None:
        rows = await pool.fetch(
            """
            SELECT id AS message_id, agent_id, agent_name, content, created_at AS timestamp
            FROM app.messages
            WHERE room_code = $1
            ORDER BY id DESC
            LIMIT $2
            """,
            room_code,
            limit,
        )
        return [dict(r) for r in reversed(rows)]
    else:
        rows = await pool.fetch(
            """
            SELECT id AS message_id, agent_id, agent_name, content, created_at AS timestamp
            FROM app.messages
            WHERE room_code = $1
            ORDER BY id
            """,
            room_code,
        )
        return [dict(r) for r in rows]
