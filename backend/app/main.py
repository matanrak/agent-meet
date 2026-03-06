"""T010 - FastAPI application with lifespan, CORS, health checks, and routers."""

from __future__ import annotations

import asyncio
import logging
from contextlib import asynccontextmanager
from typing import AsyncIterator

import json

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.requests import ClientDisconnect

from app.config import settings
from app.db import close_pool, get_pool, init_pool
from app.services.background import run_background_tasks

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    """Startup: init DB pool + background tasks. Shutdown: cleanup."""
    # Startup
    pool = await init_pool()
    logger.info("Database pool initialized")

    # Start background tasks
    bg_task = asyncio.create_task(run_background_tasks(pool))

    yield

    # Shutdown
    bg_task.cancel()
    try:
        await bg_task
    except asyncio.CancelledError:
        pass
    await close_pool()
    logger.info("Database pool closed")


app = FastAPI(
    title="AgentMeet API",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health() -> dict:
    """Basic health check."""
    return {"status": "ok"}


@app.get("/readyz", response_model=None)
async def readyz():
    """Readiness check — verifies DB pool connectivity."""
    try:
        pool = get_pool()
        result = await pool.fetchval("SELECT 1")
        if result == 1:
            return {"status": "ok"}
        return JSONResponse(
            status_code=503,
            content={"status": "error", "message": "Database check failed"},
        )
    except Exception as e:
        return JSONResponse(
            status_code=503,
            content={"status": "error", "message": str(e)},
        )


@app.exception_handler(RequestValidationError)
async def validation_error_handler(request: Request, exc: RequestValidationError):
    """Return agent-friendly validation errors instead of raw Pydantic output."""
    # Check if this is a JSON decode error (common with shell escaping)
    is_json_error = any("JSON" in str(err.get("msg", "")) for err in exc.errors())

    if is_json_error:
        try:
            raw = await request.body()
            body_preview = raw.decode("utf-8", errors="replace")[:300]
        except (ClientDisconnect, Exception):
            body_preview = "(could not read body)"

        return JSONResponse(
            status_code=422,
            content={
                "error": "json_parse_error",
                "message": "Could not parse request body as JSON. This usually happens when shell escaping mangles the JSON in curl commands.",
                "hint": "Use double quotes for the -d flag and escape inner quotes: curl -d \"{\\\"agent_id\\\": ...}\" or use a heredoc: curl -d @- <<< '{\"agent_id\": ...}'",
                "received_body": body_preview,
            },
        )

    missing = []
    invalid = []
    for err in exc.errors():
        field = ".".join(str(p) for p in err["loc"] if p != "body")
        if err["type"] == "missing":
            missing.append(field)
        else:
            invalid.append(f"{field}: {err['msg']}")

    if missing:
        msg = f"Missing required field(s): {', '.join(missing)}"
    elif invalid:
        msg = "; ".join(invalid)
    else:
        msg = "Invalid request body"

    return JSONResponse(
        status_code=422,
        content={"error": "validation_error", "message": msg},
    )


# Mount API v1 router
from app.api.v1 import router as v1_router  # noqa: E402

app.include_router(v1_router, prefix="/api/v1")
