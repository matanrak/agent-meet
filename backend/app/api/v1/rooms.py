"""T018 - Room endpoints: POST /rooms, GET /{room_code}/status."""

from __future__ import annotations

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse, PlainTextResponse

from app.config import settings
from app.db import get_pool
from app.join_page import render_join_page
from app.models.room import CreateRoomRequest, CreateRoomResponse, RoomStatus
from app.services import agent_service, room_service

router = APIRouter()


@router.post("/rooms", status_code=201, response_model=None)
async def create_room(
    request: Request,
    body: CreateRoomRequest = None,
):
    """Create a new room, auto-register an agent, and return everything needed to start talking."""
    pool = get_pool()
    max_messages = body.max_messages if body else 500
    goal = body.goal if body else "chat"

    result = await room_service.create_room(pool, max_messages=max_messages, goal=goal)

    room_code = result["room_code"]

    # Build URLs
    human_url = f"{settings.FRONTEND_URL}/{room_code}"
    base_url = str(request.base_url).rstrip("/")
    # Behind reverse proxy, base_url may be http:// — force https in production
    if settings.FRONTEND_URL.startswith("https://"):
        base_url = base_url.replace("http://", "https://", 1)
    api_base = f"{base_url}/api/v1/{room_code}"
    agent_join_url = f"{api_base}/agent-join"

    # Always auto-register an agent for the room creator
    agent_id = await agent_service.register_agent(pool, room_code)

    # Build invite prompt (same content as join page)
    invite_prompt = render_join_page(
        room_code=room_code,
        agent_id="<THEIR_AGENT_ID>",
        base_url=base_url,
        messages=[],
        latest_message_id=0,
        goal=result.get("goal", "chat"),
    )

    return CreateRoomResponse(
        room_code=room_code,
        creator_token=result["creator_token"],
        max_messages=result["max_messages"],
        goal=result.get("goal", "chat"),
        human_url=human_url,
        join_url=human_url,
        agent_join_url=agent_join_url,
        created_at=result["created_at"],
        agent_id=agent_id,
        send_message_url=f"{api_base}/message",
        poll_url=f"{api_base}/wait",
        invite_prompt=invite_prompt,
    )


@router.get("/{room_code}/status", response_model=None)
async def get_room_status(room_code: str):
    """Get room status with agent counts."""
    pool = get_pool()
    result = await room_service.get_room_status(pool, room_code)

    if result is None:
        return JSONResponse(
            status_code=404,
            content={"error": "room_not_found", "message": "No room with this code exists"},
        )

    return RoomStatus(**result)
