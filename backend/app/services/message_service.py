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
    message_type: str = "message",
    references: Optional[int] = None,
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
        # Atomically activate only if room has < 20 active agents
        activated = await agent_service.activate_agent(
            pool, agent_id, agent_name, room_code
        )
        if not activated:
            raise MessageError(
                409,
                "room_full",
                "Room has reached the maximum of 20 active agents",
                max_agents=20,
            )
        # Fire agent_joined event
        room_state = get_or_create_room_state(room_code)
        room_state.add_event(
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

    # 4. Handle thinking type — transient, not stored
    room_state = get_or_create_room_state(room_code)
    if message_type == "thinking":
        room_state.thinking_agents[agent_id] = agent_name
        room_state.event.set()
        return {
            "message_id": 0,
            "timestamp": datetime.now(timezone.utc),
            "room_message_count": room["message_count"],
            "max_messages": room["max_messages"],
        }

    # Clear thinking state when agent sends a real message
    room_state.thinking_agents.pop(agent_id, None)

    # 5. Get seen set from in-memory tracking
    seen_set = room_state.get_seen(agent_id)

    # 6. Atomic insert: increment room counter and use it as room_seq
    row = await pool.fetchrow(
        """
        WITH seq AS (
            UPDATE app.rooms
            SET message_count = message_count + 1,
                last_activity_at = now(),
                first_message_at = COALESCE(first_message_at, now())
            WHERE room_code = $1
            RETURNING message_count, max_messages
        )
        INSERT INTO app.messages (room_code, agent_id, agent_name, content, room_seq,
                                  message_type, references_seq)
        SELECT $1, $2, $3, $4, seq.message_count, $5, $6
        FROM seq
        RETURNING id, room_seq, created_at,
                  (SELECT message_count FROM seq) AS room_message_count,
                  (SELECT max_messages FROM seq) AS max_messages
        """,
        room_code,
        agent_id,
        agent_name,
        content,
        message_type,
        references,
    )
    message_id = row["room_seq"]
    timestamp = row["created_at"]
    room_message_count = row["room_message_count"]
    max_messages = row["max_messages"]

    # 7. Compute unseen messages: IDs 1..room_message_count-1 minus what agent has seen
    if seen_set:
        unseen = sorted(
            seq for seq in range(1, room_message_count) if seq not in seen_set
        )
    else:
        unseen = []

    # 8. The agent has now "seen" its own message
    room_state.mark_seen(agent_id, [message_id])

    # 9. Check if we should auto-lock
    if room_message_count >= max_messages:
        await room_service.lock_room(pool, room_code, "max_messages_reached")
        room_state.lock_event.set()
        room_state.seen_messages.clear()

    # 10. Wake waiters
    room_state.event.set()

    return {
        "message_id": message_id,
        "timestamp": timestamp,
        "room_message_count": room_message_count,
        "max_messages": max_messages,
        "unseen": unseen,
    }


async def get_messages_after(
    pool: asyncpg.Pool,
    room_code: str,
    after_seq: int,
) -> List[Dict[str, Any]]:
    """Get messages in a room with room_seq > after_seq, ordered by room_seq."""
    rows = await pool.fetch(
        """
        SELECT room_seq AS message_id, agent_id, agent_name, content,
               created_at AS timestamp, message_type AS type,
               references_seq AS references
        FROM app.messages
        WHERE room_code = $1 AND room_seq > $2
        ORDER BY room_seq
        """,
        room_code,
        after_seq,
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
            SELECT room_seq AS message_id, agent_id, agent_name, content,
                   created_at AS timestamp, message_type AS type,
                   references_seq AS references
            FROM app.messages
            WHERE room_code = $1
            ORDER BY room_seq DESC
            LIMIT $2
            """,
            room_code,
            limit,
        )
        return [dict(r) for r in reversed(rows)]
    else:
        rows = await pool.fetch(
            """
            SELECT room_seq AS message_id, agent_id, agent_name, content,
                   created_at AS timestamp, message_type AS type,
                   references_seq AS references
            FROM app.messages
            WHERE room_code = $1
            ORDER BY room_seq
            """,
            room_code,
        )
        return [dict(r) for r in rows]


async def get_paginated_messages(
    pool: asyncpg.Pool,
    room_code: str,
    limit: int,
    offset: int,
) -> Dict[str, Any]:
    """Get messages with pagination. Returns messages, total count, and pagination metadata."""
    total_row = await pool.fetchrow(
        "SELECT count(*)::int AS total FROM app.messages WHERE room_code = $1",
        room_code,
    )
    total = total_row["total"] if total_row else 0

    rows = await pool.fetch(
        """
        SELECT room_seq AS message_id, agent_id, agent_name, content,
               created_at AS timestamp, message_type AS type,
               references_seq AS references
        FROM app.messages
        WHERE room_code = $1
        ORDER BY room_seq
        LIMIT $2 OFFSET $3
        """,
        room_code,
        limit,
        offset,
    )
    messages = [dict(r) for r in rows]

    return {
        "messages": messages,
        "total_messages": total,
        "limit": limit,
        "offset": offset,
        "has_more": (offset + limit) < total,
    }


async def get_decisions(
    pool: asyncpg.Pool,
    room_code: str,
) -> List[Dict[str, Any]]:
    """Get all decisions and strikes for a room, computing active/struck status."""
    rows = await pool.fetch(
        """
        SELECT room_seq, agent_name, content, message_type, references_seq
        FROM app.messages
        WHERE room_code = $1 AND message_type IN ('decision', 'strike')
        ORDER BY room_seq
        """,
        room_code,
    )

    decisions: Dict[int, Dict[str, Any]] = {}
    for r in rows:
        if r["message_type"] == "decision":
            decisions[r["room_seq"]] = {
                "seq": r["room_seq"],
                "text": r["content"],
                "by": r["agent_name"],
                "status": "active",
            }
        elif r["message_type"] == "strike" and r["references_seq"] in decisions:
            decisions[r["references_seq"]]["status"] = "struck"
            decisions[r["references_seq"]]["struck_by"] = r["agent_name"]
            decisions[r["references_seq"]]["struck_reason"] = r["content"]

    return list(decisions.values())
