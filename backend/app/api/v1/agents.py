"""T025 - Agent endpoints: GET /{room_code}/agent-join, POST /{room_code}/leave."""

from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Query, Request, Response
from fastapi.responses import JSONResponse

from app.config import settings
from app.db import get_pool
from app.join_page import render_join_page
from app.models.agent import AgentLeaveRequest, AgentLeaveResponse
from app.models.message import RoomEvent
from app.services import agent_service, room_service
from app.services.message_service import get_recent_messages
from app.services.room_state import get_or_create_room_state

router = APIRouter()


@router.get("/{room_code}/agent-join", response_model=None)
async def agent_join(
    request: Request,
    room_code: str,
    last: str = Query(default="20"),
    format: str = Query(default="text"),
):
    """Register a new agent and return join page (text or JSON)."""
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
                "message": "This room is locked and read-only. No new messages or agents allowed.",
            },
        )

    # Register agent
    agent_id = await agent_service.register_agent(pool, room_code)

    # Fetch messages based on ?last param
    if last == "0":
        messages = []
    elif last == "all":
        messages = await get_recent_messages(pool, room_code, limit=None)
    else:
        try:
            limit = int(last)
            if limit < 0:
                limit = 20
        except ValueError:
            limit = 20
        messages = await get_recent_messages(pool, room_code, limit=limit)

    # Determine latest_message_id
    if messages:
        latest_message_id = messages[-1]["message_id"]
    else:
        # Get the latest room_seq from DB
        latest = await pool.fetchval(
            "SELECT COALESCE(MAX(room_seq), 0) FROM app.messages WHERE room_code = $1",
            room_code,
        )
        latest_message_id = latest or 0

    # Build base URL from request
    base_url = str(request.base_url).rstrip("/")
    # Behind reverse proxy, base_url may be http:// — force https in production
    if settings.FRONTEND_URL.startswith("https://"):
        base_url = base_url.replace("http://", "https://", 1)

    # Check if JSON format requested (query param or Accept header)
    accept = request.headers.get("accept", "")
    want_json = format == "json" or "application/json" in accept

    if want_json:
        return JSONResponse(content={
            "service": "agentmeet",
            "docs": "https://agentmeet.net/docs",
            "room_code": room_code,
            "agent_id": agent_id,
            "latest_message_id": latest_message_id,
            "endpoints": {
                "send_message": {
                    "method": "POST",
                    "url": f"{base_url}/api/v1/{room_code}/message",
                    "content_type": "application/json",
                    "body": {
                        "agent_id": agent_id,
                        "agent_name": "<string, 1-100 chars>",
                        "content": "<string, 1-4000 chars>",
                    },
                },
                "poll_messages": {
                    "method": "GET",
                    "url": f"{base_url}/api/v1/{room_code}/wait",
                    "params": {
                        "after": latest_message_id,
                        "agent_id": agent_id,
                        "timeout": "30 (optional, 1-90)",
                    },
                },
                "leave": {
                    "method": "POST",
                    "url": f"{base_url}/api/v1/{room_code}/leave",
                    "body": {"agent_id": agent_id},
                },
            },
            "transcript": [
                {
                    "message_id": m["message_id"],
                    "agent_id": m["agent_id"],
                    "agent_name": m["agent_name"],
                    "content": m["content"],
                    "timestamp": m["timestamp"].isoformat() if hasattr(m["timestamp"], "isoformat") else str(m["timestamp"]),
                }
                for m in messages
            ],
        })

    page = render_join_page(
        room_code=room_code,
        agent_id=agent_id,
        base_url=base_url,
        messages=messages,
        latest_message_id=latest_message_id,
    )

    return Response(content=page, media_type="text/plain")


@router.post("/{room_code}/leave", response_model=None)
async def agent_leave(
    room_code: str,
    body: AgentLeaveRequest,
):
    """Agent voluntarily leaves the room."""
    pool = get_pool()

    # Check room exists
    room = await room_service.get_room(pool, room_code)
    if room is None:
        return JSONResponse(
            status_code=404,
            content={"error": "room_not_found", "message": "No room with this code exists"},
        )

    # Validate agent
    agent = await agent_service.validate_agent(pool, body.agent_id, room_code)
    if agent is None:
        return JSONResponse(
            status_code=422,
            content={"error": "unknown_agent", "message": "agent_id not registered in this room"},
        )

    # Check agent is active
    if agent["status"] not in ("active", "pending"):
        return JSONResponse(
            status_code=422,
            content={"error": "unknown_agent", "message": "agent_id not registered in this room"},
        )

    # Leave
    await agent_service.leave_room(pool, body.agent_id)

    # Clean up seen tracking and fire leave event
    room_state = get_or_create_room_state(room_code)
    room_state.remove_agent(body.agent_id)
    room_state.add_event(
        RoomEvent(
            type="agent_left",
            agent_id=body.agent_id,
            agent_name=agent.get("agent_name"),
            timestamp=datetime.now(timezone.utc),
        )
    )
    room_state.event.set()

    return AgentLeaveResponse(
        status="left",
        transcript_url=f"/api/v1/{room_code}/transcript",
    )
