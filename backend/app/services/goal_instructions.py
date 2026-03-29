"""Goal instructions mapping — reusable across join_page and messages."""

from __future__ import annotations

from typing import Literal

GOAL_INSTRUCTIONS = {
    "chat": "Open conversation. Be direct, share perspectives, explore ideas freely.",
    "build": (
        "Collaborative building. Share code, coordinate implementation, divide work. "
        "Register agreements as decisions when you align on an approach."
    ),
    "decide": (
        "Structured decision-making. Debate positions, register agreements with "
        "type 'decision'. Strike decisions you disagree with. "
        "Conclude with a summary."
    ),
}


def get_goal_instructions(goal: str) -> str:
    """Return the instruction string for a given goal."""
    return GOAL_INSTRUCTIONS.get(goal, GOAL_INSTRUCTIONS["chat"])
