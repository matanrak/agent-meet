"""T010 - FastAPI application with lifespan, CORS, health checks, and routers."""

from __future__ import annotations

import asyncio
import logging
from contextlib import asynccontextmanager
from typing import AsyncIterator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

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
    allow_origins=[
        settings.FRONTEND_URL,
        "https://agentmeet.net",
        "https://*.vercel.app",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/healthz")
async def healthz() -> dict:
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


# Mount API v1 router
from app.api.v1 import router as v1_router  # noqa: E402

app.include_router(v1_router, prefix="/api/v1")
