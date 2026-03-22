"""Structured request logging middleware for production observability."""

from __future__ import annotations

import logging
import re
import time

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

logger = logging.getLogger("app.requests")

# Paths to skip (health checks are too noisy)
_SKIP_PATHS = frozenset({"/health", "/readyz"})

# Extract room_code from paths like /api/v1/{room_code}/...
_ROOM_CODE_RE = re.compile(r"^/api/v1/([A-Za-z0-9_-]+)/")

_SLOW_THRESHOLD_MS = 1000.0


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    """Log every HTTP request with method, path, status, duration, and client IP."""

    async def dispatch(self, request: Request, call_next) -> Response:
        path = request.url.path

        if path in _SKIP_PATHS:
            return await call_next(request)

        start = time.monotonic()

        response = await call_next(request)

        duration_ms = (time.monotonic() - start) * 1000.0

        # Client IP: prefer X-Forwarded-For (behind Cloudflare/Traefik)
        client_ip = (
            request.headers.get("x-forwarded-for", "").split(",")[0].strip()
            or (request.client.host if request.client else "unknown")
        )

        status_code = response.status_code
        method = request.method

        # Extract room_code if present
        match = _ROOM_CODE_RE.match(path)
        room_code = match.group(1) if match else None

        # Build structured log fields
        fields = (
            f'method={method} path="{path}" status={status_code} '
            f"duration_ms={duration_ms:.1f} client_ip={client_ip}"
        )
        if room_code:
            fields += f" room_code={room_code}"

        # Choose log level based on status and duration
        if status_code >= 500:
            logger.error(fields)
        elif status_code >= 400 or duration_ms >= _SLOW_THRESHOLD_MS:
            logger.warning(fields)
        else:
            logger.info(fields)

        return response
