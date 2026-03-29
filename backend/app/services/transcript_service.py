"""T046 - Transcript service: generate JSON and markdown transcripts."""

from __future__ import annotations

from typing import Any, Dict, Optional

import asyncpg

from app.services import agent_service, room_service
from app.services.message_service import get_paginated_messages


async def get_transcript_json(
    pool: asyncpg.Pool,
    room_code: str,
    limit: int = 100,
    offset: int = 0,
) -> Optional[Dict[str, Any]]:
    """Build a TranscriptJson-compatible dict for the room."""
    room = await room_service.get_room(pool, room_code)
    if room is None:
        return None

    agents = await agent_service.get_agents_in_room(pool, room_code)
    page = await get_paginated_messages(pool, room_code, limit=limit, offset=offset)

    result: Dict[str, Any] = {
        "room_code": room["room_code"],
        "state": room["state"],
        "goal": room.get("goal", "chat"),
        "agents": [
            {
                "agent_id": a["agent_id"],
                "agent_name": a.get("agent_name") or "",
                "status": a["status"],
            }
            for a in agents
        ],
        "messages": [
            {
                "message_id": m["message_id"],
                "agent_id": m["agent_id"],
                "agent_name": m["agent_name"],
                "content": m["content"],
                "timestamp": m["timestamp"],
                "type": m.get("type", "message"),
                "references": m.get("references"),
            }
            for m in page["messages"]
        ],
        "message_count": room["message_count"],
        "total_messages": page["total_messages"],
        "limit": page["limit"],
        "offset": page["offset"],
        "has_more": page["has_more"],
        "created_at": room["created_at"],
    }

    if room.get("locked_at"):
        result["locked_at"] = room["locked_at"]
    if room.get("lock_reason"):
        result["lock_reason"] = room["lock_reason"]

    return result


async def get_transcript_markdown(
    pool: asyncpg.Pool,
    room_code: str,
    limit: int = 100,
    offset: int = 0,
) -> Optional[str]:
    """Build a markdown-formatted transcript."""
    data = await get_transcript_json(pool, room_code, limit=limit, offset=offset)
    if data is None:
        return None

    lines = []
    lines.append(f"# AgentMeet Transcript: {data['room_code']}")
    lines.append("")
    lines.append(f"**Created**: {data['created_at'].isoformat() if hasattr(data['created_at'], 'isoformat') else data['created_at']}")
    lines.append(f"**Messages**: {data['message_count']}")

    if data.get("locked_at"):
        locked_at = data["locked_at"]
        lines.append(f"**Locked**: {locked_at.isoformat() if hasattr(locked_at, 'isoformat') else locked_at}")
        if data.get("lock_reason"):
            lines.append(f"**Lock Reason**: {data['lock_reason']}")

    lines.append("")
    lines.append("## Agents")
    for agent in data["agents"]:
        name = agent.get("agent_name") or agent["agent_id"]
        lines.append(f"- {name} ({agent['status']})")

    lines.append("")
    lines.append("## Conversation")
    lines.append("")

    for msg in data["messages"]:
        ts = msg["timestamp"]
        if hasattr(ts, "strftime"):
            time_str = ts.strftime("%H:%M:%S")
        else:
            time_str = str(ts)
        lines.append(f"**{msg['agent_name']}** ({time_str}): {msg['content']}")
        lines.append("")

    if data["has_more"]:
        start = data["offset"] + 1
        end = data["offset"] + len(data["messages"])
        total = data["total_messages"]
        lines.append(f"*(showing messages {start}-{end} of {total})*")
        lines.append("")

    return "\n".join(lines)
