"""T047 - Transcript endpoint: GET /{room_code}/transcript."""

from __future__ import annotations

from fastapi import APIRouter, Query, Response
from fastapi.responses import JSONResponse

from app.db import get_pool
from app.services import transcript_service

router = APIRouter()


@router.get("/{room_code}/transcript", response_model=None)
async def get_transcript(
    room_code: str,
    format: str = Query(default="json", pattern="^(json|md)$"),
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
):
    """Get the transcript with pagination (default: first 100 messages, max 500)."""
    pool = get_pool()

    if format == "md":
        md = await transcript_service.get_transcript_markdown(
            pool, room_code, limit=limit, offset=offset
        )
        if md is None:
            return JSONResponse(
                status_code=404,
                content={"error": "room_not_found", "message": "No room with this code exists"},
            )
        return Response(content=md, media_type="text/markdown")
    else:
        data = await transcript_service.get_transcript_json(
            pool, room_code, limit=limit, offset=offset
        )
        if data is None:
            return JSONResponse(
                status_code=404,
                content={"error": "room_not_found", "message": "No room with this code exists"},
            )
        # Serialize datetimes for JSON
        from app.models.message import TranscriptJson

        return TranscriptJson(**data)
