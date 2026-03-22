"""T023 - Agent service: CRUD operations on agents table."""

from __future__ import annotations

import secrets
from typing import Any, Dict, List, Optional

import asyncpg


def generate_agent_id() -> str:
    """Generate an agent ID: 'ag_' + 8 hex chars."""
    return "ag_" + secrets.token_hex(4)


async def register_agent(
    pool: asyncpg.Pool,
    room_code: str,
) -> str:
    """Create a pending agent in the room. Returns agent_id."""
    agent_id = generate_agent_id()
    await pool.execute(
        """
        INSERT INTO app.agents (agent_id, room_code, status)
        VALUES ($1, $2, 'pending')
        """,
        agent_id,
        room_code,
    )
    return agent_id


async def activate_agent(
    pool: asyncpg.Pool,
    agent_id: str,
    agent_name: str,
    room_code: str,
    max_active: int = 20,
) -> bool:
    """Atomically activate agent only if room has fewer than max_active agents.

    Uses FOR UPDATE on the room row to serialize concurrent activations.
    Returns True if activated, False if room is full.
    """
    result = await pool.fetchval(
        """
        WITH lock AS (
            SELECT 1 FROM app.rooms WHERE room_code = $3 FOR UPDATE
        ),
        active_count AS (
            SELECT COUNT(*) AS n FROM app.agents
            WHERE room_code = $3 AND status = 'active'
        )
        UPDATE app.agents
        SET status = 'active', agent_name = $2, activated_at = now()
        FROM active_count, lock
        WHERE agent_id = $1
          AND status = 'pending'
          AND active_count.n < $4
        RETURNING app.agents.agent_id
        """,
        agent_id,
        agent_name,
        room_code,
        max_active,
    )
    return result is not None


async def update_agent_name(
    pool: asyncpg.Pool,
    agent_id: str,
    agent_name: str,
) -> None:
    """Update agent's display name."""
    await pool.execute(
        "UPDATE app.agents SET agent_name = $2 WHERE agent_id = $1",
        agent_id,
        agent_name,
    )


async def validate_agent(
    pool: asyncpg.Pool,
    agent_id: str,
    room_code: str,
) -> Optional[Dict[str, Any]]:
    """Validate agent exists and belongs to the room. Returns agent row or None."""
    row = await pool.fetchrow(
        "SELECT * FROM app.agents WHERE agent_id = $1 AND room_code = $2",
        agent_id,
        room_code,
    )
    return dict(row) if row else None


async def get_agents_in_room(
    pool: asyncpg.Pool,
    room_code: str,
) -> List[Dict[str, Any]]:
    """Get all non-pending agents in a room."""
    rows = await pool.fetch(
        """
        SELECT agent_id, agent_name, status
        FROM app.agents
        WHERE room_code = $1 AND status != 'pending'
        ORDER BY activated_at
        """,
        room_code,
    )
    return [dict(r) for r in rows]


async def leave_room(
    pool: asyncpg.Pool,
    agent_id: str,
) -> None:
    """Mark an agent as left."""
    await pool.execute(
        "UPDATE app.agents SET status = 'left', left_at = now() WHERE agent_id = $1",
        agent_id,
    )


async def get_agent(
    pool: asyncpg.Pool,
    agent_id: str,
) -> Optional[Dict[str, Any]]:
    """Fetch a single agent by agent_id."""
    row = await pool.fetchrow(
        "SELECT * FROM app.agents WHERE agent_id = $1",
        agent_id,
    )
    return dict(row) if row else None


async def count_active_agents(
    pool: asyncpg.Pool,
    room_code: str,
) -> int:
    """Count active agents in a room."""
    count = await pool.fetchval(
        "SELECT COUNT(*) FROM app.agents WHERE room_code = $1 AND status = 'active'",
        room_code,
    )
    return int(count) if count else 0
