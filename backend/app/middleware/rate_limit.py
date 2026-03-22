"""In-memory per-IP sliding-window rate limiter middleware."""

from __future__ import annotations

import logging
import time
from collections import defaultdict
from typing import Dict, List, Tuple

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse

logger = logging.getLogger(__name__)

# Rate limits: (requests, window_seconds) per endpoint group.
# Endpoint group is matched by (method, path_suffix).
RATE_LIMITS: Dict[str, Tuple[int, int]] = {
    "room_create": (10, 60),
    "agent_join": (30, 60),
    "message_send": (120, 60),
    "wait": (60, 60),
    "controls": (20, 60),
    "transcript": (30, 60),
    "default": (120, 60),
}

# Paths exempt from rate limiting.
EXEMPT_PATHS = {"/health", "/readyz"}

# Cleanup expired entries every N requests to avoid memory leaks.
_CLEANUP_INTERVAL = 500


def _classify_request(method: str, path: str) -> str | None:
    """Map a request to a rate-limit group name, or None if exempt."""
    if path in EXEMPT_PATHS:
        return None

    # Strip /api/v1 prefix for matching.
    p = path.removeprefix("/api/v1")

    if method == "POST" and p == "/rooms":
        return "room_create"
    if method == "GET" and p.endswith("/agent-join"):
        return "agent_join"
    if method == "POST" and p.endswith("/message"):
        return "message_send"
    if method == "GET" and p.endswith("/wait"):
        return "wait"
    if method == "POST" and (p.endswith("/kick") or p.endswith("/lock")):
        return "controls"
    if method == "GET" and p.endswith("/transcript"):
        return "transcript"

    return "default"


def _get_client_ip(request: Request) -> str:
    """Extract the real client IP, checking X-Forwarded-For first."""
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        # First IP in the chain is the original client.
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


class RateLimitMiddleware(BaseHTTPMiddleware):
    """Sliding-window per-IP rate limiter."""

    def __init__(self, app, limits: Dict[str, Tuple[int, int]] | None = None):
        super().__init__(app)
        self.limits = limits or RATE_LIMITS
        # {ip: {group: [timestamp, ...]}}
        self._windows: Dict[str, Dict[str, List[float]]] = defaultdict(
            lambda: defaultdict(list)
        )
        self._request_count = 0

    async def dispatch(self, request: Request, call_next):
        group = _classify_request(request.method, request.url.path)
        if group is None:
            return await call_next(request)

        ip = _get_client_ip(request)
        max_requests, window_secs = self.limits.get(
            group, self.limits["default"]
        )

        now = time.monotonic()
        timestamps = self._windows[ip][group]

        # Slide the window: remove entries older than the window.
        cutoff = now - window_secs
        while timestamps and timestamps[0] <= cutoff:
            timestamps.pop(0)

        if len(timestamps) >= max_requests:
            # Calculate how long until the oldest entry expires.
            retry_after = round(timestamps[0] - cutoff, 1)
            if retry_after < 1:
                retry_after = 1
            logger.warning(
                "Rate limited %s on group=%s (%d/%d in %ds)",
                ip, group, len(timestamps), max_requests, window_secs,
            )
            return JSONResponse(
                status_code=429,
                content={
                    "error": "rate_limited",
                    "message": "Too many requests. Please slow down.",
                    "retry_after": retry_after,
                },
                headers={"Retry-After": str(int(retry_after))},
            )

        timestamps.append(now)

        # Periodic cleanup of stale entries.
        self._request_count += 1
        if self._request_count >= _CLEANUP_INTERVAL:
            self._request_count = 0
            self._cleanup(now)

        return await call_next(request)

    def _cleanup(self, now: float) -> None:
        """Remove expired timestamps and empty dicts to prevent memory leaks."""
        max_window = max(w for _, w in self.limits.values())
        cutoff = now - max_window

        empty_ips = []
        for ip, groups in self._windows.items():
            empty_groups = []
            for group, timestamps in groups.items():
                while timestamps and timestamps[0] <= cutoff:
                    timestamps.pop(0)
                if not timestamps:
                    empty_groups.append(group)
            for g in empty_groups:
                del groups[g]
            if not groups:
                empty_ips.append(ip)
        for ip in empty_ips:
            del self._windows[ip]
