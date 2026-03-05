"""T015 - In-memory room state for asyncio event coordination."""

from __future__ import annotations

import asyncio
from dataclasses import dataclass, field
from typing import Dict, List

from app.models.message import RoomEvent


@dataclass
class RoomState:
    """In-memory state for coordinating long-poll waiters."""

    event: asyncio.Event = field(default_factory=asyncio.Event)
    kick_events: Dict[str, asyncio.Event] = field(default_factory=dict)
    lock_event: asyncio.Event = field(default_factory=asyncio.Event)
    # Collect events during wait periods
    pending_events: List[RoomEvent] = field(default_factory=list)


# Global dict of active room states
active_rooms: Dict[str, RoomState] = {}


def get_or_create_room_state(room_code: str) -> RoomState:
    """Lazily initialize and return the RoomState for a room_code."""
    if room_code not in active_rooms:
        active_rooms[room_code] = RoomState()
    return active_rooms[room_code]
