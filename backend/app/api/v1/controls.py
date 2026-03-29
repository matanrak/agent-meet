"""T039-T040 - Creator control endpoints: POST /{room_code}/kick, POST /{room_code}/lock, PATCH /{room_code}/goal."""

from __future__ import annotations

import asyncio
from datetime import datetime, timezone

from fastapi import APIRouter
from fastapi.responses import JSONResponse

from app.db import get_pool
from app.models.agent import KickRequest, KickResponse, LockRequest, LockResponse
from app.models.message import RoomEvent
from app.models.room import ChangeGoalRequest, ChangeGoalResponse
from app.services import agent_service, room_service
from app.services.goal_instructions import get_goal_instructions
from app.services.room_state import get_or_create_room_state

router = APIRouter()


@router.post("/{room_code}/kick", response_model=None)
async def kick_agent(
    room_code: str,
    body: KickRequest,
):
    """Kick an agent from the room (creator only)."""
    pool = get_pool()

    # Check room exists
    room = await room_service.get_room(pool, room_code)
    if room is None:
        return JSONResponse(
            status_code=404,
            content={"error": "room_not_found", "message": "No room with this code exists"},
        )

    # Validate creator token
    valid = await room_service.validate_creator_token(pool, room_code, body.creator_token)
    if not valid:
        return JSONResponse(
            status_code=401,
            content={"error": "unauthorized", "message": "Invalid creator_token"},
        )

    # Check room not locked
    if room["state"] == "locked":
        return JSONResponse(
            status_code=423,
            content={
                "error": "room_locked",
                "message": "This room is locked and read-only. No new messages or agents allowed.",
            },
        )

    # Find target agent
    agent = await agent_service.get_agent(pool, body.target_agent_id)
    if agent is None or agent.get("room_code") != room_code:
        return JSONResponse(
            status_code=422,
            content={"error": "invalid_target", "message": "Agent not found or already inactive"},
        )
    if agent["status"] not in ("active", "pending"):
        return JSONResponse(
            status_code=422,
            content={"error": "invalid_target", "message": "Agent not found or already inactive"},
        )

    # Kick the agent
    await pool.execute(
        "UPDATE app.agents SET status = 'kicked', left_at = now() WHERE agent_id = $1",
        body.target_agent_id,
    )

    # Set kick event and clean up seen tracking
    room_state = get_or_create_room_state(room_code)
    room_state.seen_messages.pop(body.target_agent_id, None)
    if body.target_agent_id not in room_state.kick_events:
        room_state.kick_events[body.target_agent_id] = asyncio.Event()
    room_state.kick_events[body.target_agent_id].set()

    # Fire agent_kicked event
    room_state.add_event(
        RoomEvent(
            type="agent_kicked",
            agent_id=body.target_agent_id,
            agent_name=agent.get("agent_name"),
            timestamp=datetime.now(timezone.utc),
        )
    )

    # Wake waiters
    room_state.event.set()

    return KickResponse(
        kicked_agent_id=body.target_agent_id,
        kicked_agent_name=agent.get("agent_name"),
        status="kicked",
    )


@router.post("/{room_code}/lock", response_model=None)
async def lock_room(
    room_code: str,
    body: LockRequest,
):
    """Lock a room (creator only, irreversible)."""
    pool = get_pool()

    # Check room exists
    room = await room_service.get_room(pool, room_code)
    if room is None:
        return JSONResponse(
            status_code=404,
            content={"error": "room_not_found", "message": "No room with this code exists"},
        )

    # Validate creator token
    valid = await room_service.validate_creator_token(pool, room_code, body.creator_token)
    if not valid:
        return JSONResponse(
            status_code=401,
            content={"error": "unauthorized", "message": "Invalid creator_token"},
        )

    # Check room not already locked
    if room["state"] == "locked":
        return JSONResponse(
            status_code=423,
            content={
                "error": "room_locked",
                "message": "This room is locked and read-only. No new messages or agents allowed.",
            },
        )

    # Lock the room
    result = await room_service.lock_room(pool, room_code, "creator_locked")

    # Clean up and notify waiters
    room_state = get_or_create_room_state(room_code)
    room_state.seen_messages.clear()
    room_state.lock_event.set()
    room_state.event.set()

    return LockResponse(
        room_code=room_code,
        state="locked",
        locked_at=result["locked_at"],
        lock_reason="creator_locked",
        transcript_url=f"/api/v1/{room_code}/transcript",
    )


@router.patch("/{room_code}/goal", response_model=None)
async def change_goal(
    room_code: str,
    body: ChangeGoalRequest,
):
    """Change the room goal (creator only)."""
    pool = get_pool()

    # Check room exists
    room = await room_service.get_room(pool, room_code)
    if room is None:
        return JSONResponse(
            status_code=404,
            content={"error": "room_not_found", "message": "No room with this code exists"},
        )

    # Check room not locked
    if room["state"] == "locked":
        return JSONResponse(
            status_code=423,
            content={
                "error": "room_locked",
                "message": "This room is locked and read-only.",
            },
        )

    # Validate creator token and change goal
    result = await room_service.change_goal(pool, room_code, body.creator_token, body.goal)
    if result is None:
        return JSONResponse(
            status_code=401,
            content={"error": "unauthorized", "message": "Invalid creator_token"},
        )

    # Post a system message about the goal change
    instructions = get_goal_instructions(body.goal)
    system_content = f"Room goal changed to '{body.goal}'. {instructions}"
    await pool.fetchrow(
        """
        WITH seq AS (
            UPDATE app.rooms
            SET message_count = message_count + 1,
                last_activity_at = now(),
                first_message_at = COALESCE(first_message_at, now())
            WHERE room_code = $1
            RETURNING message_count
        )
        INSERT INTO app.messages (room_code, agent_id, agent_name, content, room_seq, message_type)
        SELECT $1, 'system', 'System', $2, seq.message_count, 'message'
        FROM seq
        RETURNING room_seq
        """,
        room_code,
        system_content,
    )

    # Fire goal_changed event and wake waiters
    room_state = get_or_create_room_state(room_code)
    room_state.add_event(
        RoomEvent(
            type="goal_changed",
            agent_id="system",
            agent_name=None,
            timestamp=datetime.now(timezone.utc),
        )
    )
    room_state.event.set()

    return ChangeGoalResponse(
        old_goal=result["old_goal"],
        new_goal=result["new_goal"],
    )
