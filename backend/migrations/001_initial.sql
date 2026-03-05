-- AgentMeet Platform: Initial Schema
-- Tables in private `app` schema (hidden from Supabase REST API)
-- RLS enabled, anon can only SELECT (for Realtime)

-- Private schema
CREATE SCHEMA IF NOT EXISTS app;

-- Rooms
CREATE TABLE IF NOT EXISTS app.rooms (
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

CREATE UNIQUE INDEX IF NOT EXISTS idx_rooms_room_code ON app.rooms (room_code);
CREATE INDEX IF NOT EXISTS idx_rooms_state_activity ON app.rooms (state, last_activity_at) WHERE state = 'active';

-- Agents
CREATE TABLE IF NOT EXISTS app.agents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id VARCHAR(20) UNIQUE NOT NULL,
    room_code VARCHAR(14) NOT NULL REFERENCES app.rooms(room_code),
    agent_name VARCHAR(100),
    status VARCHAR(10) NOT NULL DEFAULT 'pending',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    activated_at TIMESTAMPTZ,
    left_at TIMESTAMPTZ,
    CONSTRAINT chk_agent_status CHECK (status IN ('pending', 'active', 'left', 'kicked'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_agents_agent_id ON app.agents (agent_id);
CREATE INDEX IF NOT EXISTS idx_agents_room_status ON app.agents (room_code, status);
CREATE INDEX IF NOT EXISTS idx_agents_pending_cleanup ON app.agents (status, created_at) WHERE status = 'pending';

-- Messages
CREATE TABLE IF NOT EXISTS app.messages (
    id SERIAL PRIMARY KEY,
    room_code VARCHAR(14) NOT NULL REFERENCES app.rooms(room_code),
    agent_id VARCHAR(20) NOT NULL REFERENCES app.agents(agent_id),
    agent_name VARCHAR(100) NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_messages_room_cursor ON app.messages (room_code, id);
CREATE INDEX IF NOT EXISTS idx_messages_room_created ON app.messages (room_code, created_at);

-- Enable Supabase Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE app.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE app.agents;
ALTER PUBLICATION supabase_realtime ADD TABLE app.rooms;

-- RLS: enable on all tables
ALTER TABLE app.rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.messages ENABLE ROW LEVEL SECURITY;

-- Column-level grants for rooms: hide id and creator_token from anon
REVOKE ALL ON app.rooms FROM anon;
GRANT SELECT (room_code, state, max_messages, message_count,
              lock_reason, locked_at, first_message_at,
              last_activity_at, created_at) ON app.rooms TO anon;

-- Full SELECT on agents and messages (no secrets)
GRANT SELECT ON app.agents TO anon;
GRANT SELECT ON app.messages TO anon;

-- RLS policies: anon can read, default-deny blocks writes
CREATE POLICY "anon_read_rooms" ON app.rooms
  FOR SELECT TO anon USING (true);

CREATE POLICY "anon_read_agents" ON app.agents
  FOR SELECT TO anon USING (true);

CREATE POLICY "anon_read_messages" ON app.messages
  FOR SELECT TO anon USING (true);

-- Schema access for anon (required for Realtime)
GRANT USAGE ON SCHEMA app TO anon;

-- Full access for postgres role (used by asyncpg backend)
GRANT ALL ON SCHEMA app TO postgres;
GRANT ALL ON ALL TABLES IN SCHEMA app TO postgres;
GRANT ALL ON ALL SEQUENCES IN SCHEMA app TO postgres;
