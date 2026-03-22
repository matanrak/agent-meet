"""Tests for the in-memory rate limiting middleware."""

from __future__ import annotations

import time
from unittest.mock import AsyncMock, MagicMock

import pytest

from app.middleware.rate_limit import (
    RateLimitMiddleware,
    _classify_request,
    _get_client_ip,
)


# ---------------------------------------------------------------------------
# _classify_request
# ---------------------------------------------------------------------------


class TestClassifyRequest:
    def test_health_exempt(self):
        assert _classify_request("GET", "/health") is None

    def test_readyz_exempt(self):
        assert _classify_request("GET", "/readyz") is None

    def test_room_create(self):
        assert _classify_request("POST", "/api/v1/rooms") == "room_create"

    def test_agent_join(self):
        assert _classify_request("GET", "/api/v1/abc-defg/agent-join") == "agent_join"

    def test_message_send(self):
        assert _classify_request("POST", "/api/v1/abc-defg/message") == "message_send"

    def test_wait(self):
        assert _classify_request("GET", "/api/v1/abc-defg/wait") == "wait"

    def test_kick(self):
        assert _classify_request("POST", "/api/v1/abc-defg/kick") == "controls"

    def test_lock(self):
        assert _classify_request("POST", "/api/v1/abc-defg/lock") == "controls"

    def test_transcript(self):
        assert _classify_request("GET", "/api/v1/abc-defg/transcript") == "transcript"

    def test_unknown_falls_to_default(self):
        assert _classify_request("GET", "/api/v1/something-else") == "default"

    def test_leave_is_default(self):
        assert _classify_request("POST", "/api/v1/abc/leave") == "default"

    def test_status_is_default(self):
        assert _classify_request("GET", "/api/v1/abc/status") == "default"


# ---------------------------------------------------------------------------
# _get_client_ip
# ---------------------------------------------------------------------------


class TestGetClientIp:
    def _make_request(self, headers=None, client_host="127.0.0.1"):
        req = MagicMock()
        req.headers = headers or {}
        client = MagicMock()
        client.host = client_host
        req.client = client
        return req

    def test_uses_x_forwarded_for(self):
        req = self._make_request(headers={"x-forwarded-for": "1.2.3.4, 10.0.0.1"})
        assert _get_client_ip(req) == "1.2.3.4"

    def test_falls_back_to_client_host(self):
        req = self._make_request(client_host="192.168.1.1")
        assert _get_client_ip(req) == "192.168.1.1"

    def test_no_client(self):
        req = MagicMock()
        req.headers = {}
        req.client = None
        assert _get_client_ip(req) == "unknown"


# ---------------------------------------------------------------------------
# RateLimitMiddleware (direct dispatch tests)
# ---------------------------------------------------------------------------


def _make_request(method="GET", path="/api/v1/rooms", ip="10.0.0.1", forwarded_for=None):
    """Build a mock Request with the fields the middleware reads."""
    scope = {
        "type": "http",
        "method": method,
        "path": path,
        "headers": [],
        "query_string": b"",
    }
    req = MagicMock(spec=["method", "url", "headers", "client"])
    req.method = method
    url = MagicMock()
    url.path = path
    req.url = url
    headers = {}
    if forwarded_for:
        headers["x-forwarded-for"] = forwarded_for
    req.headers = headers
    client = MagicMock()
    client.host = ip
    req.client = client
    return req


@pytest.fixture
def middleware():
    """Middleware with tight limits for testing."""
    limits = {
        "room_create": (2, 60),
        "agent_join": (3, 60),
        "default": (50, 60),
    }
    inner_app = AsyncMock()
    mw = RateLimitMiddleware(inner_app, limits=limits)
    return mw


class TestMiddlewareDispatch:
    @pytest.mark.asyncio
    async def test_allows_under_limit(self, middleware):
        call_next = AsyncMock(return_value=MagicMock(status_code=200))
        req = _make_request(method="POST", path="/api/v1/rooms")

        resp = await middleware.dispatch(req, call_next)
        assert call_next.called

    @pytest.mark.asyncio
    async def test_blocks_over_limit(self, middleware):
        call_next = AsyncMock(return_value=MagicMock(status_code=200))

        for _ in range(2):
            req = _make_request(method="POST", path="/api/v1/rooms")
            resp = await middleware.dispatch(req, call_next)

        req = _make_request(method="POST", path="/api/v1/rooms")
        resp = await middleware.dispatch(req, call_next)
        assert resp.status_code == 429
        assert resp.body is not None

    @pytest.mark.asyncio
    async def test_429_body_format(self, middleware):
        call_next = AsyncMock(return_value=MagicMock(status_code=200))
        import json

        for _ in range(2):
            req = _make_request(method="POST", path="/api/v1/rooms")
            await middleware.dispatch(req, call_next)

        req = _make_request(method="POST", path="/api/v1/rooms")
        resp = await middleware.dispatch(req, call_next)
        body = json.loads(resp.body.decode())
        assert body["error"] == "rate_limited"
        assert "retry_after" in body
        assert body["retry_after"] >= 1
        assert body["message"] == "Too many requests. Please slow down."

    @pytest.mark.asyncio
    async def test_429_has_retry_after_header(self, middleware):
        call_next = AsyncMock(return_value=MagicMock(status_code=200))

        for _ in range(2):
            req = _make_request(method="POST", path="/api/v1/rooms")
            await middleware.dispatch(req, call_next)

        req = _make_request(method="POST", path="/api/v1/rooms")
        resp = await middleware.dispatch(req, call_next)
        # JSONResponse stores headers; check it exists
        assert any(k.lower() == b"retry-after" for k, v in resp.raw_headers)

    @pytest.mark.asyncio
    async def test_health_exempt(self, middleware):
        call_next = AsyncMock(return_value=MagicMock(status_code=200))

        for _ in range(100):
            req = _make_request(method="GET", path="/health")
            resp = await middleware.dispatch(req, call_next)
        # All should pass through (call_next should be called every time).
        assert call_next.call_count == 100

    @pytest.mark.asyncio
    async def test_separate_ips(self, middleware):
        call_next = AsyncMock(return_value=MagicMock(status_code=200))

        # Exhaust limit for IP-A.
        for _ in range(2):
            req = _make_request(method="POST", path="/api/v1/rooms", ip="1.1.1.1")
            await middleware.dispatch(req, call_next)

        # IP-A blocked.
        req = _make_request(method="POST", path="/api/v1/rooms", ip="1.1.1.1")
        resp = await middleware.dispatch(req, call_next)
        assert resp.status_code == 429

        # IP-B still allowed.
        req = _make_request(method="POST", path="/api/v1/rooms", ip="2.2.2.2")
        resp = await middleware.dispatch(req, call_next)
        assert call_next.call_count == 3  # 2 for A + 1 for B

    @pytest.mark.asyncio
    async def test_separate_groups(self, middleware):
        call_next = AsyncMock(return_value=MagicMock(status_code=200))

        # Exhaust room_create (limit 2).
        for _ in range(2):
            req = _make_request(method="POST", path="/api/v1/rooms")
            await middleware.dispatch(req, call_next)

        # room_create blocked.
        req = _make_request(method="POST", path="/api/v1/rooms")
        resp = await middleware.dispatch(req, call_next)
        assert resp.status_code == 429

        # agent_join (limit 3) still fine.
        req = _make_request(method="GET", path="/api/v1/test/agent-join")
        resp = await middleware.dispatch(req, call_next)
        assert call_next.call_count == 3

    @pytest.mark.asyncio
    async def test_x_forwarded_for_ip(self, middleware):
        call_next = AsyncMock(return_value=MagicMock(status_code=200))

        for _ in range(2):
            req = _make_request(
                method="POST", path="/api/v1/rooms", forwarded_for="9.9.9.9"
            )
            await middleware.dispatch(req, call_next)

        req = _make_request(
            method="POST", path="/api/v1/rooms", forwarded_for="9.9.9.9"
        )
        resp = await middleware.dispatch(req, call_next)
        assert resp.status_code == 429

        # Different forwarded IP is fine.
        req = _make_request(
            method="POST", path="/api/v1/rooms", forwarded_for="8.8.8.8"
        )
        resp = await middleware.dispatch(req, call_next)
        assert call_next.call_count == 3


# ---------------------------------------------------------------------------
# Cleanup
# ---------------------------------------------------------------------------


class TestCleanup:
    @pytest.mark.asyncio
    async def test_window_expires(self):
        """After the window elapses, requests are allowed again."""
        limits = {"room_create": (1, 1), "default": (50, 1)}
        mw = RateLimitMiddleware(AsyncMock(), limits=limits)
        call_next = AsyncMock(return_value=MagicMock(status_code=200))

        req = _make_request(method="POST", path="/api/v1/rooms")
        await mw.dispatch(req, call_next)

        req = _make_request(method="POST", path="/api/v1/rooms")
        resp = await mw.dispatch(req, call_next)
        assert resp.status_code == 429

        time.sleep(1.1)

        req = _make_request(method="POST", path="/api/v1/rooms")
        resp = await mw.dispatch(req, call_next)
        # call_next called again after window expired
        assert call_next.call_count == 2

    def test_cleanup_removes_stale_entries(self):
        limits = {"room_create": (10, 1), "default": (50, 1)}
        mw = RateLimitMiddleware(AsyncMock(), limits=limits)

        # Manually populate with old timestamps.
        old = time.monotonic() - 10
        mw._windows["old-ip"]["room_create"] = [old, old + 0.1]
        mw._windows["recent-ip"]["room_create"] = [time.monotonic()]

        mw._cleanup(time.monotonic())

        assert "old-ip" not in mw._windows
        assert "recent-ip" in mw._windows
