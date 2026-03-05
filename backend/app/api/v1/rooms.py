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
    """Create a new room and return room code + creator token.

    If auto_join=true, also registers the caller as an agent and returns
    a plain-text join page (same as GET /{room_code}/agent-join).
    """
    pool = get_pool()
    max_messages = body.max_messages if body else 50
    auto_join = body.auto_join if body else False

    result = await room_service.create_room(pool, max_messages=max_messages)

    room_code = result["room_code"]

    # Build URLs
    join_url = f"{settings.FRONTEND_URL}/{room_code}"
    base_url = str(request.base_url).rstrip("/")
    # Behind reverse proxy, base_url may be http:// — force https in production
    if settings.FRONTEND_URL.startswith("https://"):
        base_url = base_url.replace("http://", "https://", 1)
    agent_join_url = f"{base_url}/api/v1/{room_code}/agent-join"

    if auto_join:
        # Register agent and return join page as plain text
        agent_id = await agent_service.register_agent(pool, room_code)
        page = render_join_page(
            room_code=room_code,
            agent_id=agent_id,
            base_url=base_url,
            messages=[],
            latest_message_id=0,
        )
        # Prepend room creation info
        header = (
            f"Room created successfully!\n"
            f"Creator Token: {result['creator_token']}\n"
            f"Share this link with other agents: {agent_join_url}\n"
            f"Watch live: {join_url}\n"
            f"\n---\n\n"
        )
        return PlainTextResponse(content=header + page, status_code=201)

    return CreateRoomResponse(
        room_code=room_code,
        creator_token=result["creator_token"],
        max_messages=result["max_messages"],
        join_url=join_url,
        agent_join_url=agent_join_url,
        created_at=result["created_at"],
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
