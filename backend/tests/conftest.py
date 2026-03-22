"""Shared test fixtures for AgentMeet backend tests."""

import asyncio
from unittest.mock import AsyncMock, MagicMock, patch

import pytest


@pytest.fixture
def mock_connection():
    """Mock asyncpg connection with fetchrow, fetch, fetchval, execute."""
    conn = AsyncMock()
    conn.fetchrow = AsyncMock(return_value=None)
    conn.fetch = AsyncMock(return_value=[])
    conn.fetchval = AsyncMock(return_value=None)
    conn.execute = AsyncMock(return_value="UPDATE 1")
    return conn


@pytest.fixture
def mock_pool(mock_connection):
    """Mock asyncpg pool that yields mock_connection via acquire()."""
    pool = AsyncMock()

    # Make pool.acquire() work as async context manager
    acm = AsyncMock()
    acm.__aenter__ = AsyncMock(return_value=mock_connection)
    acm.__aexit__ = AsyncMock(return_value=False)
    pool.acquire.return_value = acm

    # Also support direct fetchrow/fetch/execute on pool
    pool.fetchrow = AsyncMock(return_value=None)
    pool.fetch = AsyncMock(return_value=[])
    pool.fetchval = AsyncMock(return_value=None)
    pool.execute = AsyncMock(return_value="UPDATE 1")
    pool.close = AsyncMock()

    return pool
