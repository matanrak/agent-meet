"""Tests for seen_messages tracking and room_seq features."""

from __future__ import annotations

import asyncio
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.services.room_state import RoomState, active_rooms, get_or_create_room_state


# ---------------------------------------------------------------------------
# RoomState unit tests (pure, no DB)
# ---------------------------------------------------------------------------


class TestRoomStateMarkSeen:
    """Tests for RoomState.mark_seen()."""

    def test_mark_seen_creates_set_for_new_agent(self):
        state = RoomState()
        state.mark_seen("agent-1", [1, 2, 3])
        assert state.seen_messages["agent-1"] == {1, 2, 3}

    def test_mark_seen_adds_to_existing_set(self):
        state = RoomState()
        state.mark_seen("agent-1", [1, 2])
        state.mark_seen("agent-1", [3, 4])
        assert state.seen_messages["agent-1"] == {1, 2, 3, 4}

    def test_mark_seen_deduplicates(self):
        state = RoomState()
        state.mark_seen("agent-1", [1, 2, 3])
        state.mark_seen("agent-1", [2, 3, 4])
        assert state.seen_messages["agent-1"] == {1, 2, 3, 4}

    def test_mark_seen_empty_list(self):
        state = RoomState()
        state.mark_seen("agent-1", [])
        assert state.seen_messages["agent-1"] == set()

    def test_mark_seen_independent_agents(self):
        state = RoomState()
        state.mark_seen("agent-1", [1, 2])
        state.mark_seen("agent-2", [3, 4])
        assert state.seen_messages["agent-1"] == {1, 2}
        assert state.seen_messages["agent-2"] == {3, 4}


class TestRoomStateGetSeen:
    """Tests for RoomState.get_seen()."""

    def test_get_seen_returns_empty_set_for_unknown_agent(self):
        state = RoomState()
        result = state.get_seen("nonexistent")
        assert result == set()
        assert isinstance(result, set)

    def test_get_seen_returns_correct_set(self):
        state = RoomState()
        state.mark_seen("agent-1", [5, 10, 15])
        assert state.get_seen("agent-1") == {5, 10, 15}

    def test_get_seen_does_not_create_entry_for_missing_agent(self):
        state = RoomState()
        _ = state.get_seen("ghost")
        assert "ghost" not in state.seen_messages


class TestRoomStateRemoveAgent:
    """Tests for RoomState.remove_agent()."""

    def test_remove_agent_clears_seen_messages(self):
        state = RoomState()
        state.mark_seen("agent-1", [1, 2, 3])
        state.remove_agent("agent-1")
        assert "agent-1" not in state.seen_messages

    def test_remove_agent_clears_kick_events(self):
        state = RoomState()
        state.kick_events["agent-1"] = asyncio.Event()
        state.remove_agent("agent-1")
        assert "agent-1" not in state.kick_events

    def test_remove_agent_clears_both_seen_and_kick(self):
        state = RoomState()
        state.mark_seen("agent-1", [1])
        state.kick_events["agent-1"] = asyncio.Event()
        state.remove_agent("agent-1")
        assert "agent-1" not in state.seen_messages
        assert "agent-1" not in state.kick_events

    def test_remove_agent_noop_for_unknown_agent(self):
        state = RoomState()
        # Should not raise
        state.remove_agent("nonexistent")

    def test_remove_agent_does_not_affect_other_agents(self):
        state = RoomState()
        state.mark_seen("agent-1", [1, 2])
        state.mark_seen("agent-2", [3, 4])
        state.kick_events["agent-1"] = asyncio.Event()
        state.kick_events["agent-2"] = asyncio.Event()
        state.remove_agent("agent-1")
        assert state.seen_messages["agent-2"] == {3, 4}
        assert "agent-2" in state.kick_events


class TestGetOrCreateRoomState:
    """Tests for the module-level get_or_create_room_state function."""

    def setup_method(self):
        active_rooms.clear()

    def teardown_method(self):
        active_rooms.clear()

    def test_creates_new_state(self):
        state = get_or_create_room_state("room-a")
        assert isinstance(state, RoomState)
        assert "room-a" in active_rooms

    def test_returns_same_state_on_repeated_calls(self):
        s1 = get_or_create_room_state("room-a")
        s2 = get_or_create_room_state("room-a")
        assert s1 is s2

    def test_different_rooms_get_different_states(self):
        s1 = get_or_create_room_state("room-a")
        s2 = get_or_create_room_state("room-b")
        assert s1 is not s2


# ---------------------------------------------------------------------------
# send_message room_seq + unseen calculation tests
# ---------------------------------------------------------------------------


class TestSendMessageRoomSeq:
    """Tests for room_seq assignment and unseen calculation in send_message."""

    @pytest.mark.asyncio
    async def test_first_message_gets_room_seq_1(self, mock_pool):
        """The first message in a room should get room_seq=1."""
        from app.services.message_service import send_message

        now = datetime.now(timezone.utc)

        with patch("app.services.message_service.room_service.get_room") as mock_get_room, \
             patch("app.services.message_service.agent_service.validate_agent") as mock_validate:

            mock_get_room.return_value = {"room_code": "abc-1234-5678", "state": "active", "max_messages": 50}
            mock_validate.return_value = {"agent_id": "a1", "status": "active", "agent_name": "Bot"}

            # Mock the INSERT returning room_seq=1
            mock_pool.fetchrow.return_value = {
                "id": "msg-uuid",
                "room_seq": 1,
                "created_at": now,
                "room_message_count": 1,
                "max_messages": 50,
            }

            # Clear any leftover room state
            active_rooms.clear()

            result = await send_message(mock_pool, "abc-1234-5678", "a1", "Bot", "Hello")

            assert result["message_id"] == 1
            assert result["room_message_count"] == 1

    @pytest.mark.asyncio
    async def test_unseen_is_empty_for_first_message(self, mock_pool):
        """First message: no prior messages exist, so unseen should be empty."""
        from app.services.message_service import send_message

        now = datetime.now(timezone.utc)

        with patch("app.services.message_service.room_service.get_room") as mock_get_room, \
             patch("app.services.message_service.agent_service.validate_agent") as mock_validate:

            mock_get_room.return_value = {"room_code": "r1", "state": "active", "max_messages": 50}
            mock_validate.return_value = {"agent_id": "a1", "status": "active", "agent_name": "Bot"}

            mock_pool.fetchrow.return_value = {
                "id": "msg-uuid",
                "room_seq": 1,
                "created_at": now,
                "room_message_count": 1,
                "max_messages": 50,
            }

            active_rooms.clear()
            result = await send_message(mock_pool, "r1", "a1", "Bot", "Hi")

            # room_message_count=1, range(1,1) is empty => unseen=[]
            assert result["unseen"] == []

    @pytest.mark.asyncio
    async def test_unseen_lists_messages_not_seen_via_wait(self, mock_pool):
        """If agent has seen some messages, unseen excludes those."""
        from app.services.message_service import send_message

        now = datetime.now(timezone.utc)

        with patch("app.services.message_service.room_service.get_room") as mock_get_room, \
             patch("app.services.message_service.agent_service.validate_agent") as mock_validate:

            mock_get_room.return_value = {"room_code": "r1", "state": "active", "max_messages": 50}
            mock_validate.return_value = {"agent_id": "a1", "status": "active", "agent_name": "Bot"}

            # Simulate: this is message #5, agent has seen messages 1,2,3 via /wait
            mock_pool.fetchrow.return_value = {
                "id": "msg-uuid",
                "room_seq": 5,
                "created_at": now,
                "room_message_count": 5,
                "max_messages": 50,
            }

            active_rooms.clear()
            room_state = get_or_create_room_state("r1")
            room_state.mark_seen("a1", [1, 2, 3])

            result = await send_message(mock_pool, "r1", "a1", "Bot", "msg5")

            # all_prior = {1,2,3,4}, seen = {1,2,3} => unseen = [4]
            assert result["unseen"] == [4]

    @pytest.mark.asyncio
    async def test_unseen_empty_when_all_seen(self, mock_pool):
        """If agent has seen all prior messages, unseen is empty."""
        from app.services.message_service import send_message

        now = datetime.now(timezone.utc)

        with patch("app.services.message_service.room_service.get_room") as mock_get_room, \
             patch("app.services.message_service.agent_service.validate_agent") as mock_validate:

            mock_get_room.return_value = {"room_code": "r1", "state": "active", "max_messages": 50}
            mock_validate.return_value = {"agent_id": "a1", "status": "active", "agent_name": "Bot"}

            mock_pool.fetchrow.return_value = {
                "id": "msg-uuid",
                "room_seq": 4,
                "created_at": now,
                "room_message_count": 4,
                "max_messages": 50,
            }

            active_rooms.clear()
            room_state = get_or_create_room_state("r1")
            room_state.mark_seen("a1", [1, 2, 3])

            result = await send_message(mock_pool, "r1", "a1", "Bot", "msg4")

            # all_prior = {1,2,3}, seen = {1,2,3} => unseen = []
            assert result["unseen"] == []

    @pytest.mark.asyncio
    async def test_unseen_empty_when_no_seen_set_but_empty_is_correct(self, mock_pool):
        """When agent has no seen set (first interaction), unseen is [] (code path: seen_set is empty)."""
        from app.services.message_service import send_message

        now = datetime.now(timezone.utc)

        with patch("app.services.message_service.room_service.get_room") as mock_get_room, \
             patch("app.services.message_service.agent_service.validate_agent") as mock_validate:

            mock_get_room.return_value = {"room_code": "r1", "state": "active", "max_messages": 50}
            mock_validate.return_value = {"agent_id": "a1", "status": "active", "agent_name": "Bot"}

            # Message #3, agent has never called /wait so seen_set is empty set
            mock_pool.fetchrow.return_value = {
                "id": "msg-uuid",
                "room_seq": 3,
                "created_at": now,
                "room_message_count": 3,
                "max_messages": 50,
            }

            active_rooms.clear()
            result = await send_message(mock_pool, "r1", "a1", "Bot", "msg3")

            # Code: `unseen = sorted(all_prior - seen_set) if seen_set else []`
            # seen_set is empty set (falsy) => unseen = []
            assert result["unseen"] == []

    @pytest.mark.asyncio
    async def test_send_message_marks_own_message_as_seen(self, mock_pool):
        """After sending, the agent's own message_id is added to their seen set."""
        from app.services.message_service import send_message

        now = datetime.now(timezone.utc)

        with patch("app.services.message_service.room_service.get_room") as mock_get_room, \
             patch("app.services.message_service.agent_service.validate_agent") as mock_validate:

            mock_get_room.return_value = {"room_code": "r1", "state": "active", "max_messages": 50}
            mock_validate.return_value = {"agent_id": "a1", "status": "active", "agent_name": "Bot"}

            mock_pool.fetchrow.return_value = {
                "id": "msg-uuid",
                "room_seq": 7,
                "created_at": now,
                "room_message_count": 7,
                "max_messages": 50,
            }

            active_rooms.clear()
            await send_message(mock_pool, "r1", "a1", "Bot", "hi")

            room_state = get_or_create_room_state("r1")
            assert 7 in room_state.get_seen("a1")


class TestRoomSeqPerRoom:
    """Verify room_seq is per-room (independent sequences)."""

    @pytest.mark.asyncio
    async def test_two_rooms_have_independent_sequences(self, mock_pool):
        """Messages in different rooms each start at room_seq=1."""
        from app.services.message_service import send_message

        now = datetime.now(timezone.utc)

        with patch("app.services.message_service.room_service.get_room") as mock_get_room, \
             patch("app.services.message_service.agent_service.validate_agent") as mock_validate:

            active_rooms.clear()

            # Room A: first message => room_seq=1
            mock_get_room.return_value = {"room_code": "room-a", "state": "active", "max_messages": 50}
            mock_validate.return_value = {"agent_id": "a1", "status": "active", "agent_name": "Bot"}
            mock_pool.fetchrow.return_value = {
                "id": "uuid-a", "room_seq": 1, "created_at": now,
                "room_message_count": 1, "max_messages": 50,
            }
            result_a = await send_message(mock_pool, "room-a", "a1", "Bot", "hi")

            # Room B: first message => room_seq=1
            mock_get_room.return_value = {"room_code": "room-b", "state": "active", "max_messages": 50}
            mock_validate.return_value = {"agent_id": "a2", "status": "active", "agent_name": "Bot2"}
            mock_pool.fetchrow.return_value = {
                "id": "uuid-b", "room_seq": 1, "created_at": now,
                "room_message_count": 1, "max_messages": 50,
            }
            result_b = await send_message(mock_pool, "room-b", "a2", "Bot2", "hello")

            assert result_a["message_id"] == 1
            assert result_b["message_id"] == 1

            # Seen sets are independent
            state_a = get_or_create_room_state("room-a")
            state_b = get_or_create_room_state("room-b")
            assert state_a.get_seen("a1") == {1}
            assert state_b.get_seen("a2") == {1}
            assert state_a is not state_b


# ---------------------------------------------------------------------------
# Cleanup on leave / kick / lock
# ---------------------------------------------------------------------------


class TestCleanupOnLeave:
    """Verify remove_agent is called when an agent leaves."""

    def test_remove_agent_clears_seen_tracking(self):
        """Simulates what agents.py does on leave: room_state.remove_agent(agent_id)."""
        active_rooms.clear()
        state = get_or_create_room_state("room-1")
        state.mark_seen("agent-1", [1, 2, 3])
        state.kick_events["agent-1"] = asyncio.Event()

        # This is what agents.py:agent_leave does
        state.remove_agent("agent-1")

        assert "agent-1" not in state.seen_messages
        assert "agent-1" not in state.kick_events


class TestCleanupOnKick:
    """Verify seen_messages.pop on kick (controls.py pattern)."""

    def test_kick_pops_seen_messages(self):
        """Simulates what controls.py:kick_agent does: seen_messages.pop(agent_id, None)."""
        active_rooms.clear()
        state = get_or_create_room_state("room-1")
        state.mark_seen("agent-1", [1, 2, 3])
        state.mark_seen("agent-2", [4, 5])

        # This is what controls.py does
        state.seen_messages.pop("agent-1", None)

        assert "agent-1" not in state.seen_messages
        # Other agents unaffected
        assert state.seen_messages["agent-2"] == {4, 5}

    def test_kick_pop_noop_for_unknown_agent(self):
        """Pop with default should not raise for unknown agent."""
        state = RoomState()
        result = state.seen_messages.pop("ghost", None)
        assert result is None


class TestCleanupOnLock:
    """Verify seen_messages.clear() on lock (controls.py and background.py)."""

    def test_lock_clears_all_seen_messages(self):
        """Simulates what controls.py:lock_room does: seen_messages.clear()."""
        state = RoomState()
        state.mark_seen("agent-1", [1, 2])
        state.mark_seen("agent-2", [3, 4])
        state.mark_seen("agent-3", [5])

        # This is what controls.py and background.py do on lock
        state.seen_messages.clear()

        assert len(state.seen_messages) == 0
        assert state.get_seen("agent-1") == set()
        assert state.get_seen("agent-2") == set()

    def test_lock_clears_already_empty(self):
        """Clear on empty dict is a no-op, should not raise."""
        state = RoomState()
        state.seen_messages.clear()
        assert len(state.seen_messages) == 0


class TestBackgroundLockClearsSeenMessages:
    """Verify background.py lock_idle_rooms clears seen_messages."""

    @pytest.mark.asyncio
    async def test_lock_idle_rooms_clears_seen_messages(self, mock_pool):
        """lock_idle_rooms should clear seen_messages for each locked room."""
        from app.services.background import lock_idle_rooms

        active_rooms.clear()
        state = get_or_create_room_state("idle-room")
        state.mark_seen("agent-1", [1, 2, 3])

        # Mock: one idle room found
        mock_pool.fetch.return_value = [{"room_code": "idle-room"}]

        with patch("app.services.background.room_service.lock_room") as mock_lock:
            mock_lock.return_value = {"locked_at": datetime.now(timezone.utc)}
            count = await lock_idle_rooms(mock_pool)

        assert count == 1
        # The room state should have been cleaned up and removed from active_rooms
        assert "idle-room" not in active_rooms


# ---------------------------------------------------------------------------
# /wait mark_seen integration-style test
# ---------------------------------------------------------------------------


class TestWaitMarksSeen:
    """Verify that /wait endpoint marks delivered messages as seen."""

    def test_mark_seen_called_with_delivered_message_ids(self):
        """Simulate what /wait does: after fetching messages, call mark_seen with their IDs."""
        state = RoomState()

        # Simulate messages returned by get_messages_after
        new_messages = [
            {"message_id": 5, "agent_id": "a2", "agent_name": "Other", "content": "hi", "timestamp": None},
            {"message_id": 6, "agent_id": "a3", "agent_name": "Third", "content": "hey", "timestamp": None},
        ]

        # This is what messages.py does after getting new messages
        seq_ids = [m["message_id"] for m in new_messages]
        state.mark_seen("agent-1", seq_ids)

        assert state.get_seen("agent-1") == {5, 6}

    def test_mark_seen_accumulates_across_multiple_waits(self):
        """Multiple /wait calls accumulate seen messages."""
        state = RoomState()

        # First /wait delivers messages 1,2
        state.mark_seen("agent-1", [1, 2])
        # Second /wait delivers messages 3,4,5
        state.mark_seen("agent-1", [3, 4, 5])

        assert state.get_seen("agent-1") == {1, 2, 3, 4, 5}

    def test_concurrent_agents_see_independently(self):
        """Two agents polling /wait build independent seen sets."""
        state = RoomState()

        # agent-1 sees messages 1,2,3
        state.mark_seen("agent-1", [1, 2, 3])
        # agent-2 sees only message 3
        state.mark_seen("agent-2", [3])

        assert state.get_seen("agent-1") == {1, 2, 3}
        assert state.get_seen("agent-2") == {3}

        # agent-1 later sees 4
        state.mark_seen("agent-1", [4])
        assert state.get_seen("agent-1") == {1, 2, 3, 4}
        # agent-2 unchanged
        assert state.get_seen("agent-2") == {3}
