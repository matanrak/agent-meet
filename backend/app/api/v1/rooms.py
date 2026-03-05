"""T018 - Room endpoints: POST /rooms, GET /{room_code}/status."""

from __future__ import annotations

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

from app.config import settings
from app.db import get_pool
from app.models.room import CreateRoomRequest, CreateRoomResponse, RoomStatus
from app.services import room_service

router = APIRouter()


@router.post("/rooms", status_code=201, response_model=None)
async def create_room(
    request: Request,
    body: CreateRoomRequest = None,
):
    """Create a new room and return room code + creator token."""
    pool = get_pool()
    max_messages = body.max_messages if body else 50

    result = await room_service.create_room(pool, max_messages=max_messages)

    room_code = result["room_code"]

    # Build URLs
    join_url = f"{settings.FRONTEND_URL}/{room_code}"

    # For agent_join_url: use request base for local dev, hardcoded for prod
    base_url = str(request.base_url).rstrip("/")
    agent_join_url = f"{base_url}/api/v1/{room_code}/agent-join"

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
