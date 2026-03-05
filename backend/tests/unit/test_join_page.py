"""Tests for join_page — TDD: written before implementation."""

import pytest


def test_render_join_page_contains_header():
    """Join page must contain room header."""
    from app.join_page import render_join_page

    page = render_join_page(
        room_code="abc-defg-hijk",
        agent_id="ag_12345678",
        base_url="https://api.agentmeet.net",
        messages=[],
        latest_message_id=0,
    )
    assert "AGENTMEET" in page
    assert "abc-defg-hijk" in page


def test_render_join_page_contains_agent_id():
    """Join page must include the baked-in agent ID."""
    from app.join_page import render_join_page

    page = render_join_page(
        room_code="abc-defg-hijk",
        agent_id="ag_12345678",
        base_url="https://api.agentmeet.net",
        messages=[],
        latest_message_id=0,
    )
    assert "ag_12345678" in page


def test_render_join_page_contains_steps():
    """Join page must have STEP 1, STEP 2, STEP 3."""
    from app.join_page import render_join_page

    page = render_join_page(
        room_code="abc-defg-hijk",
        agent_id="ag_12345678",
        base_url="https://api.agentmeet.net",
        messages=[],
        latest_message_id=0,
    )
    assert "STEP 1" in page
    assert "STEP 2" in page
    assert "STEP 3" in page


def test_render_join_page_contains_rules():
    """Join page must include RULES section."""
    from app.join_page import render_join_page

    page = render_join_page(
        room_code="abc-defg-hijk",
        agent_id="ag_12345678",
        base_url="https://api.agentmeet.net",
        messages=[],
        latest_message_id=0,
    )
    assert "RULES" in page
    assert "4000" in page
    assert "/leave" in page


def test_render_join_page_contains_messages():
    """Join page must display messages when provided."""
    from app.join_page import render_join_page
    from datetime import datetime, timezone

    messages = [
        {"message_id": 1, "agent_name": "TestAgent", "content": "Hello!", "timestamp": datetime(2026, 3, 5, 14, 0, 0, tzinfo=timezone.utc)},
        {"message_id": 2, "agent_name": "OtherAgent", "content": "Hi there!", "timestamp": datetime(2026, 3, 5, 14, 1, 0, tzinfo=timezone.utc)},
    ]

    page = render_join_page(
        room_code="abc-defg-hijk",
        agent_id="ag_12345678",
        base_url="https://api.agentmeet.net",
        messages=messages,
        latest_message_id=2,
    )
    assert "[1]" in page
    assert "TestAgent" in page
    assert "Hello!" in page
    assert "latest_message_id: 2" in page


def test_render_join_page_contains_transcript_url():
    """Join page must include transcript URL."""
    from app.join_page import render_join_page

    page = render_join_page(
        room_code="abc-defg-hijk",
        agent_id="ag_12345678",
        base_url="https://api.agentmeet.net",
        messages=[],
        latest_message_id=0,
    )
    assert "/transcript" in page


def test_render_join_page_contains_endpoints():
    """Join page must include POST /message and GET /wait endpoints."""
    from app.join_page import render_join_page

    page = render_join_page(
        room_code="abc-defg-hijk",
        agent_id="ag_12345678",
        base_url="https://api.agentmeet.net",
        messages=[],
        latest_message_id=0,
    )
    assert "/message" in page
    assert "/wait" in page
