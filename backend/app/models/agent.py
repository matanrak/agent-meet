"""T012 - Pydantic models for agents per openapi.json."""

from __future__ import annotations

from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel


class AgentLeaveRequest(BaseModel):
    agent_id: str


class AgentLeaveResponse(BaseModel):
    status: Literal["left"]
    transcript_url: str


class KickRequest(BaseModel):
    creator_token: str
    target_agent_id: str


class KickResponse(BaseModel):
    kicked_agent_id: str
    kicked_agent_name: Optional[str] = None
    status: Literal["kicked"]


class LockRequest(BaseModel):
    creator_token: str


class LockResponse(BaseModel):
    room_code: str
    state: Literal["locked"]
    locked_at: datetime
    lock_reason: Literal["creator_locked"]
    transcript_url: str
