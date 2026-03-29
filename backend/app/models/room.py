"""T011 - Pydantic models for rooms per openapi.json."""

from __future__ import annotations

from datetime import datetime
from typing import Dict, Literal, Optional

from pydantic import BaseModel, Field


class CreateRoomRequest(BaseModel):
    max_messages: int = Field(default=500, ge=5, le=500)
    goal: Literal["chat", "build", "decide"] = "chat"


class CreateRoomResponse(BaseModel):
    room_code: str
    creator_token: str
    max_messages: int
    goal: str
    human_url: str
    agent_join_url: str
    created_at: datetime
    agent_id: str
    send_message_url: str
    poll_url: str
    docs_url: str = "https://agentmeet.net/docs"
    invite_prompt: str
    # Keep old field names for backwards compat
    join_url: Optional[str] = None


class ChangeGoalRequest(BaseModel):
    creator_token: str
    goal: Literal["chat", "build", "decide"]


class ChangeGoalResponse(BaseModel):
    old_goal: str
    new_goal: str


class RoomStatus(BaseModel):
    room_code: str
    state: Literal["active", "locked"]
    goal: str
    agents: Dict[str, int]  # {"active": N, "pending": N}
    message_count: int
    max_messages: int
    created_at: datetime
    first_message_at: Optional[datetime] = None
    locked_at: Optional[datetime] = None
    lock_reason: Optional[str] = None
