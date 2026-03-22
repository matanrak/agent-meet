"""Tests for Pydantic models — TDD: written before implementation."""

from datetime import datetime, timezone

import pytest
from pydantic import ValidationError


def test_create_room_request_defaults():
    """CreateRoomRequest should default max_messages to 50."""
    from app.models.room import CreateRoomRequest

    req = CreateRoomRequest()
    assert req.max_messages == 50


def test_create_room_request_min_max():
    """max_messages must be between 5 and 500."""
    from app.models.room import CreateRoomRequest

    with pytest.raises(ValidationError):
        CreateRoomRequest(max_messages=4)
    with pytest.raises(ValidationError):
        CreateRoomRequest(max_messages=501)

    req = CreateRoomRequest(max_messages=5)
    assert req.max_messages == 5
    req = CreateRoomRequest(max_messages=500)
    assert req.max_messages == 500


def test_create_room_response_required_fields():
    """CreateRoomResponse needs all required fields."""
    from app.models.room import CreateRoomResponse

    now = datetime.now(timezone.utc)
    resp = CreateRoomResponse(
        room_code="abc-defg-hijk",
        creator_token="ct_abc123",
        max_messages=50,
        join_url="https://agentmeet.net/abc-defg-hijk",
        agent_join_url="https://api.agentmeet.net/api/v1/abc-defg-hijk/agent-join",
        created_at=now,
    )
    assert resp.room_code == "abc-defg-hijk"


def test_send_message_request_validation():
    """SendMessageRequest requires agent_id, agent_name, content."""
    from app.models.message import SendMessageRequest

    with pytest.raises(ValidationError):
        SendMessageRequest()

    req = SendMessageRequest(agent_id="ag_test", agent_name="Test", content="Hello")
    assert req.content == "Hello"


def test_send_message_request_content_length():
    """Content must be 1-4000 chars."""
    from app.models.message import SendMessageRequest

    with pytest.raises(ValidationError):
        SendMessageRequest(agent_id="ag_test", agent_name="Test", content="")

    with pytest.raises(ValidationError):
        SendMessageRequest(agent_id="ag_test", agent_name="Test", content="x" * 4001)


def test_send_message_request_agent_name_length():
    """agent_name must be 1-100 chars."""
    from app.models.message import SendMessageRequest

    with pytest.raises(ValidationError):
        SendMessageRequest(agent_id="ag_test", agent_name="", content="Hello")

    with pytest.raises(ValidationError):
        SendMessageRequest(agent_id="ag_test", agent_name="x" * 101, content="Hello")


def test_agent_leave_request_requires_agent_id():
    """AgentLeaveRequest requires agent_id."""
    from app.models.agent import AgentLeaveRequest

    with pytest.raises(ValidationError):
        AgentLeaveRequest()

    req = AgentLeaveRequest(agent_id="ag_test")
    assert req.agent_id == "ag_test"


def test_agent_leave_response_literal():
    """AgentLeaveResponse status must be 'left'."""
    from app.models.agent import AgentLeaveResponse

    resp = AgentLeaveResponse(status="left", transcript_url="/api/v1/abc/transcript")
    assert resp.status == "left"


def test_kick_request_fields():
    """KickRequest needs creator_token and target_agent_id."""
    from app.models.agent import KickRequest

    with pytest.raises(ValidationError):
        KickRequest(creator_token="ct_abc")  # missing target_agent_id

    req = KickRequest(creator_token="ct_abc", target_agent_id="ag_test")
    assert req.target_agent_id == "ag_test"


def test_lock_response_fields():
    """LockResponse must contain expected fields."""
    from app.models.agent import LockResponse

    now = datetime.now(timezone.utc)
    resp = LockResponse(
        room_code="abc-defg-hijk",
        state="locked",
        locked_at=now,
        lock_reason="creator_locked",
        transcript_url="/api/v1/abc/transcript",
    )
    assert resp.state == "locked"
    assert resp.lock_reason == "creator_locked"


def test_wait_response_fields():
    """WaitResponse required fields."""
    from app.models.message import WaitResponse

    resp = WaitResponse(
        messages=[],
        latest_message_id=0,
        room_locked=False,
        timeout=True,
    )
    assert resp.timeout is True
    assert resp.messages == []


def test_message_model():
    """Message model with all required fields."""
    from app.models.message import Message

    now = datetime.now(timezone.utc)
    msg = Message(
        message_id=1,
        agent_id="ag_test",
        agent_name="Test Agent",
        content="Hello world",
        timestamp=now,
    )
    assert msg.message_id == 1


def test_room_event_model():
    """RoomEvent model with literal type."""
    from app.models.message import RoomEvent

    now = datetime.now(timezone.utc)
    evt = RoomEvent(type="agent_joined", agent_id="ag_test", timestamp=now)
    assert evt.type == "agent_joined"


def test_error_model():
    """Error model with required fields."""
    from app.models.message import Error

    err = Error(error="room_not_found", message="No room with this code exists")
    assert err.error == "room_not_found"


def test_room_status_model():
    """RoomStatus model with nested agents object."""
    from app.models.room import RoomStatus

    now = datetime.now(timezone.utc)
    status = RoomStatus(
        room_code="abc-defg-hijk",
        state="active",
        agents={"active": 2, "pending": 1},
        message_count=5,
        max_messages=50,
        created_at=now,
    )
    assert status.agents["active"] == 2


def test_transcript_json_model():
    """TranscriptJson model."""
    from app.models.message import TranscriptJson

    now = datetime.now(timezone.utc)
    tj = TranscriptJson(
        room_code="abc-defg-hijk",
        state="active",
        agents=[{"agent_id": "ag_1", "agent_name": "Test", "status": "active"}],
        messages=[],
        message_count=0,
        total_messages=0,
        limit=100,
        offset=0,
        has_more=False,
        created_at=now,
    )
    assert tj.room_code == "abc-defg-hijk"
    assert tj.total_messages == 0
    assert tj.limit == 100
    assert tj.offset == 0
    assert tj.has_more is False
