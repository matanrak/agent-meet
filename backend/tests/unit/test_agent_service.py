"""Tests for agent_service — TDD: written before implementation."""

import re

import pytest


def test_generate_agent_id_format():
    """Agent ID must start with 'ag_' followed by 8 hex chars."""
    from app.services.agent_service import generate_agent_id

    agent_id = generate_agent_id()
    assert agent_id.startswith("ag_")
    assert re.match(r"^ag_[a-f0-9]{8}$", agent_id), f"Bad format: {agent_id}"


def test_generate_agent_id_uniqueness():
    """Generated agent IDs should be unique."""
    from app.services.agent_service import generate_agent_id

    ids = {generate_agent_id() for _ in range(100)}
    assert len(ids) == 100


@pytest.mark.asyncio
async def test_register_agent_returns_id(mock_pool):
    """register_agent must return agent_id string."""
    from app.services.agent_service import register_agent

    mock_pool.fetchval.return_value = "ag_12345678"

    result = await register_agent(mock_pool, "abc-defg-hijk")
    assert isinstance(result, str)
    assert result.startswith("ag_")


@pytest.mark.asyncio
async def test_get_agent_returns_none_missing(mock_pool):
    """get_agent returns None for nonexistent agent."""
    from app.services.agent_service import get_agent

    mock_pool.fetchrow.return_value = None
    result = await get_agent(mock_pool, "ag_nonexist")
    assert result is None


@pytest.mark.asyncio
async def test_leave_room_calls_update(mock_pool):
    """leave_room should execute an UPDATE query."""
    from app.services.agent_service import leave_room

    await leave_room(mock_pool, "ag_12345678")
    mock_pool.execute.assert_called_once()
