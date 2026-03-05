"""API v1 router — aggregates all sub-routers."""

from fastapi import APIRouter

from app.api.v1 import agents, controls, messages, rooms, transcript

router = APIRouter()

router.include_router(rooms.router)
router.include_router(agents.router)
router.include_router(messages.router)
router.include_router(controls.router)
router.include_router(transcript.router)
