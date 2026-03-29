"""T027-T028 - Message endpoints: POST /{room_code}/message, GET /{room_code}/wait."""

from __future__ import annotations

import asyncio

from fastapi import APIRouter, Query
from fastapi.responses import JSONResponse

from app.db import get_pool
from app.models.message import (
    Message,
    SendMessageRequest,
    SendMessageResponse,
    WaitResponse,
)
from app.services import agent_service, room_service
from app.models.message import Decision
from app.services.message_service import MessageError, get_decisions, get_messages_after, send_message
from app.services.room_state import get_or_create_room_state

router = APIRouter()


@router.post("/{room_code}/message", status_code=201, response_model=None)
async def post_message(
    room_code: str,
    body: SendMessageRequest,
):
    """Send a message to the room."""
    pool = get_pool()

    try:
        result = await send_message(
            pool,
            room_code=room_code,
            agent_id=body.agent_id,
            agent_name=body.agent_name,
            content=body.content,
            message_type=body.type,
            references=body.references,
        )
    except MessageError as e:
        content = {"error": e.error, "message": e.message}
        content.update(e.extra)
        return JSONResponse(status_code=e.status_code, content=content)

    return SendMessageResponse(
        message_id=result["message_id"],
        timestamp=result["timestamp"],
        room_message_count=result["room_message_count"],
        max_messages=result["max_messages"],
        unseen=result.get("unseen") or None,
    )


@router.get("/{room_code}/wait", response_model=None)
async def wait_for_messages(
    room_code: str,
    after: int = Query(..., ge=0),
    agent_id: str = Query(...),
    timeout: int = Query(default=30, ge=1, le=90),
):
    """Long-poll for new messages."""
    pool = get_pool()

    async def _active_count() -> int:
        return await agent_service.count_active_agents(pool, room_code)

    # Check room exists
    room = await room_service.get_room(pool, room_code)
    if room is None:
        return JSONResponse(
            status_code=404,
            content={"error": "room_not_found", "message": "No room with this code exists"},
        )

    # Validate agent
    agent = await agent_service.validate_agent(pool, agent_id, room_code)
    if agent is None:
        return JSONResponse(
            status_code=422,
            content={"error": "unknown_agent", "message": "agent_id not registered in this room"},
        )

    room_state = get_or_create_room_state(room_code)
    deadline = asyncio.get_event_loop().time() + timeout
    collected_events = []

    while True:
        # 1. Check if agent was kicked
        if agent_id in room_state.kick_events and room_state.kick_events[agent_id].is_set():
            # Clean up kick event now that it's been delivered
            room_state.kick_events.pop(agent_id, None)
            # Collect any pending events
            if room_state.pending_events:
                collected_events.extend(room_state.pending_events)
                room_state.pending_events = []
            return WaitResponse(
                messages=[],
                latest_message_id=after,
                room_locked=False,
                kicked=True,
                timeout=False,
                active_agents=await _active_count(),
                events=collected_events if collected_events else None,
            )

        # 2. Clear event BEFORE checking messages to prevent lost wakeups.
        # If a message arrives between clear and the DB check, the check catches it.
        # If a message arrives after the DB check, event.set() fires and wait() returns.
        room_state.event.clear()

        # 3. Check DB for new messages
        new_messages = await get_messages_after(pool, room_code, after)
        if new_messages:
            msgs = [
                Message(
                    message_id=m["message_id"],
                    agent_id=m["agent_id"],
                    agent_name=m["agent_name"],
                    content=m["content"],
                    timestamp=m["timestamp"],
                    type=m.get("type", "message"),
                    references=m.get("references"),
                )
                for m in new_messages
            ]
            latest_id = msgs[-1].message_id

            # Track that this agent has seen these messages
            seq_ids = [m["message_id"] for m in new_messages]
            room_state.mark_seen(agent_id, seq_ids)

            # Collect pending events
            if room_state.pending_events:
                collected_events.extend(room_state.pending_events)
                room_state.pending_events = []

            # Check room lock status
            room_now = await room_service.get_room(pool, room_code)
            is_locked = room_now["state"] == "locked" if room_now else False
            lock_reason = room_now.get("lock_reason") if is_locked and room_now else None

            # Get thinking agents and decisions
            thinking = list(room_state.thinking_agents.values()) or None
            decisions_list = await get_decisions(pool, room_code)
            decisions = [Decision(**d) for d in decisions_list] if decisions_list else None

            return WaitResponse(
                messages=msgs,
                latest_message_id=latest_id,
                room_locked=is_locked,
                lock_reason=lock_reason,
                timeout=False,
                active_agents=await _active_count(),
                events=collected_events if collected_events else None,
                thinking=thinking,
                decisions=decisions,
            )

        # 4. Check if room is locked
        room_now = await room_service.get_room(pool, room_code)
        if room_now and room_now["state"] == "locked":
            if room_state.pending_events:
                collected_events.extend(room_state.pending_events)
                room_state.pending_events = []
            return WaitResponse(
                messages=[],
                latest_message_id=after,
                room_locked=True,
                lock_reason=room_now.get("lock_reason"),
                timeout=False,
                active_agents=await _active_count(),
                events=collected_events if collected_events else None,
            )

        # 5. Collect any pending events so far
        if room_state.pending_events:
            collected_events.extend(room_state.pending_events)
            room_state.pending_events = []

        # 6. Wait for event or timeout
        remaining = deadline - asyncio.get_event_loop().time()
        if remaining <= 0:
            return WaitResponse(
                messages=[],
                latest_message_id=after,
                room_locked=False,
                timeout=True,
                active_agents=await _active_count(),
                events=collected_events if collected_events else None,
            )

        try:
            await asyncio.wait_for(room_state.event.wait(), timeout=remaining)
        except asyncio.TimeoutError:
            # Final check for events/messages before returning timeout
            if room_state.pending_events:
                collected_events.extend(room_state.pending_events)
                room_state.pending_events = []

            new_messages = await get_messages_after(pool, room_code, after)
            if new_messages:
                msgs = [
                    Message(
                        message_id=m["message_id"],
                        agent_id=m["agent_id"],
                        agent_name=m["agent_name"],
                        content=m["content"],
                        timestamp=m["timestamp"],
                        type=m.get("type", "message"),
                        references=m.get("references"),
                    )
                    for m in new_messages
                ]
                latest_id = msgs[-1].message_id
                seq_ids = [m["message_id"] for m in new_messages]
                room_state.mark_seen(agent_id, seq_ids)
                room_now = await room_service.get_room(pool, room_code)
                is_locked = room_now["state"] == "locked" if room_now else False
                lock_reason = room_now.get("lock_reason") if is_locked and room_now else None
                thinking = list(room_state.thinking_agents.values()) or None
                decisions_list = await get_decisions(pool, room_code)
                decisions = [Decision(**d) for d in decisions_list] if decisions_list else None
                return WaitResponse(
                    messages=msgs,
                    latest_message_id=latest_id,
                    room_locked=is_locked,
                    lock_reason=lock_reason,
                    timeout=False,
                    active_agents=await _active_count(),
                    events=collected_events if collected_events else None,
                    thinking=thinking,
                    decisions=decisions,
                )

            thinking = list(room_state.thinking_agents.values()) or None
            return WaitResponse(
                messages=[],
                latest_message_id=after,
                room_locked=False,
                timeout=True,
                active_agents=await _active_count(),
                events=collected_events if collected_events else None,
                thinking=thinking,
            )
