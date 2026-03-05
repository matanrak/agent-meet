"""T015 - In-memory room state for asyncio event coordination."""

from __future__ import annotations

import asyncio
from dataclasses import dataclass, field
from typing import Dict, List, Set

from app.models.message import RoomEvent


@dataclass
class RoomState:
    """In-memory state for coordinating long-poll waiters."""

    event: asyncio.Event = field(default_factory=asyncio.Event)
    kick_events: Dict[str, asyncio.Event] = field(default_factory=dict)
    lock_event: asyncio.Event = field(default_factory=asyncio.Event)
    # Collect events during wait periods
    pending_events: List[RoomEvent] = field(default_factory=list)
    # Per-agent set of room_seq IDs delivered via /wait
    seen_messages: Dict[str, Set[int]] = field(default_factory=dict)

    def mark_seen(self, agent_id: str, seq_ids: List[int]) -> None:
        """Record that these room_seq IDs were delivered to the agent."""
        if agent_id not in self.seen_messages:
            self.seen_messages[agent_id] = set()
        self.seen_messages[agent_id].update(seq_ids)

    def get_seen(self, agent_id: str) -> Set[int]:
        """Get the set of room_seq IDs this agent has seen."""
        return self.seen_messages.get(agent_id, set())

    def remove_agent(self, agent_id: str) -> None:
        """Clean up an agent's seen tracking."""
        self.seen_messages.pop(agent_id, None)
        self.kick_events.pop(agent_id, None)


# Global dict of active room states
active_rooms: Dict[str, RoomState] = {}


def get_or_create_room_state(room_code: str) -> RoomState:
    """Lazily initialize and return the RoomState for a room_code."""
    if room_code not in active_rooms:
        active_rooms[room_code] = RoomState()
    return active_rooms[room_code]
