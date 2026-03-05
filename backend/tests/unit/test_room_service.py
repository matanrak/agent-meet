"""Tests for room_service — TDD: written before implementation."""

import re
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock

import pytest


def test_generate_room_code_format():
    """Room code must match xxx-xxxx-xxxx pattern (lowercase hex)."""
    from app.services.room_service import generate_room_code

    code = generate_room_code()
    assert re.match(r"^[a-f0-9]{3}-[a-f0-9]{4}-[a-f0-9]{4}$", code), f"Bad format: {code}"


def test_generate_room_code_uniqueness():
    """Two generated codes should differ (probabilistic)."""
    from app.services.room_service import generate_room_code

    codes = {generate_room_code() for _ in range(100)}
    assert len(codes) == 100


def test_generate_creator_token_format():
    """Creator token must start with 'ct_' and have hex suffix."""
    from app.services.room_service import generate_creator_token

    token = generate_creator_token()
    assert token.startswith("ct_")
    assert len(token) == 3 + 24  # "ct_" + 24 hex chars


def test_generate_creator_token_uniqueness():
    """Two generated tokens should differ."""
    from app.services.room_service import generate_creator_token

    tokens = {generate_creator_token() for _ in range(100)}
    assert len(tokens) == 100


@pytest.mark.asyncio
async def test_create_room_returns_expected_keys(mock_pool):
    """create_room must return room_code, creator_token, max_messages, created_at."""
    from app.services.room_service import create_room

    now = datetime.now(timezone.utc)
    mock_pool.fetchrow.return_value = {
        "room_code": "abc-defg-hijk",
        "creator_token": "ct_aabbccdd",
        "max_messages": 50,
        "created_at": now,
    }

    result = await create_room(mock_pool, max_messages=50)
    assert "room_code" in result
    assert "creator_token" in result
    assert "max_messages" in result
    assert "created_at" in result


@pytest.mark.asyncio
async def test_get_room_returns_none_when_missing(mock_pool):
    """get_room must return None for nonexistent room."""
    from app.services.room_service import get_room

    mock_pool.fetchrow.return_value = None
    result = await get_room(mock_pool, "xxx-yyyy-zzzz")
    assert result is None


@pytest.mark.asyncio
async def test_validate_creator_token_true(mock_pool):
    """validate_creator_token returns True on match."""
    from app.services.room_service import validate_creator_token

    mock_pool.fetchval.return_value = True
    result = await validate_creator_token(mock_pool, "abc-defg-hijk", "ct_valid")
    assert result is True


@pytest.mark.asyncio
async def test_validate_creator_token_false(mock_pool):
    """validate_creator_token returns False on mismatch."""
    from app.services.room_service import validate_creator_token

    mock_pool.fetchval.return_value = False
    result = await validate_creator_token(mock_pool, "abc-defg-hijk", "ct_invalid")
    assert result is False
