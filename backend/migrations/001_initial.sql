-- AgentMeet Platform: Initial Schema
-- Tables: rooms, agents, messages
-- Per data-model.md specification

-- Rooms
CREATE TABLE IF NOT EXISTS rooms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_code VARCHAR(14) UNIQUE NOT NULL,
    creator_token VARCHAR(32) NOT NULL,
    state VARCHAR(10) NOT NULL DEFAULT 'active',
    max_messages INTEGER NOT NULL DEFAULT 50,
    message_count INTEGER NOT NULL DEFAULT 0,
    lock_reason VARCHAR(30),
    locked_at TIMESTAMPTZ,
    first_message_at TIMESTAMPTZ,
    last_activity_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_state CHECK (state IN ('active', 'locked')),
    CONSTRAINT chk_max_messages CHECK (max_messages BETWEEN 5 AND 500),
    CONSTRAINT chk_lock_reason CHECK (lock_reason IN ('max_messages_reached', 'creator_locked', 'inactivity_timeout'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_rooms_room_code ON rooms (room_code);
CREATE INDEX IF NOT EXISTS idx_rooms_state_activity ON rooms (state, last_activity_at) WHERE state = 'active';

-- Agents
CREATE TABLE IF NOT EXISTS agents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id VARCHAR(20) UNIQUE NOT NULL,
    room_code VARCHAR(14) NOT NULL REFERENCES rooms(room_code),
    agent_name VARCHAR(100),
    status VARCHAR(10) NOT NULL DEFAULT 'pending',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    activated_at TIMESTAMPTZ,
    left_at TIMESTAMPTZ,
    CONSTRAINT chk_agent_status CHECK (status IN ('pending', 'active', 'left', 'kicked'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_agents_agent_id ON agents (agent_id);
CREATE INDEX IF NOT EXISTS idx_agents_room_status ON agents (room_code, status);
CREATE INDEX IF NOT EXISTS idx_agents_pending_cleanup ON agents (status, created_at) WHERE status = 'pending';

-- Messages
CREATE TABLE IF NOT EXISTS messages (
    id SERIAL PRIMARY KEY,
    room_code VARCHAR(14) NOT NULL REFERENCES rooms(room_code),
    agent_id VARCHAR(20) NOT NULL REFERENCES agents(agent_id),
    agent_name VARCHAR(100) NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_messages_room_cursor ON messages (room_code, id);
CREATE INDEX IF NOT EXISTS idx_messages_room_created ON messages (room_code, created_at);

-- Enable Supabase Realtime on all three tables
ALTER PUBLICATION supabase_realtime ADD TABLE messages;
ALTER PUBLICATION supabase_realtime ADD TABLE agents;
ALTER PUBLICATION supabase_realtime ADD TABLE rooms;
