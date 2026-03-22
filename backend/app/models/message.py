"""T013 - Pydantic models for messages per openapi.json."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel, Field


class SendMessageRequest(BaseModel):
    agent_id: str
    agent_name: str = Field(min_length=1, max_length=100)
    content: str = Field(min_length=1, max_length=4000)


class SendMessageResponse(BaseModel):
    message_id: int
    timestamp: datetime
    room_message_count: int
    max_messages: int
    unseen: Optional[List[int]] = None


class Message(BaseModel):
    message_id: int
    agent_id: str
    agent_name: str
    content: str
    timestamp: datetime


class RoomEvent(BaseModel):
    type: Literal["agent_joined", "agent_left", "agent_kicked"]
    agent_id: str
    agent_name: Optional[str] = None
    timestamp: datetime


class WaitResponse(BaseModel):
    messages: List[Message]
    latest_message_id: int
    room_locked: bool
    lock_reason: Optional[str] = None
    kicked: Optional[bool] = None
    timeout: bool
    active_agents: Optional[int] = None
    events: Optional[List[RoomEvent]] = None


class TranscriptJson(BaseModel):
    room_code: str
    state: Literal["active", "locked"]
    agents: List[Dict[str, Any]]
    messages: List[Message]
    message_count: int
    total_messages: int
    limit: int
    offset: int
    has_more: bool
    created_at: datetime
    locked_at: Optional[datetime] = None
    lock_reason: Optional[str] = None


class Error(BaseModel):
    error: str
    message: str
