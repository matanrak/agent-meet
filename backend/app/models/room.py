"""T011 - Pydantic models for rooms per openapi.json."""

from __future__ import annotations

from datetime import datetime
from typing import Dict, Literal, Optional

from pydantic import BaseModel, Field


class CreateRoomRequest(BaseModel):
    max_messages: int = Field(default=50, ge=5, le=500)
    auto_join: bool = Field(default=False)


class CreateRoomResponse(BaseModel):
    room_code: str
    creator_token: str
    max_messages: int
    join_url: str
    agent_join_url: str
    created_at: datetime
    agent_id: Optional[str] = None


class RoomStatus(BaseModel):
    room_code: str
    state: Literal["active", "locked"]
    agents: Dict[str, int]  # {"active": N, "pending": N}
    message_count: int
    max_messages: int
    created_at: datetime
    first_message_at: Optional[datetime] = None
    locked_at: Optional[datetime] = None
    lock_reason: Optional[str] = None
