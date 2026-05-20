-- AgentMeet migration: schema, tables, indexes, grants, and RPC functions.
-- Run this in the Supabase SQL Editor (Dashboard > SQL Editor).
-- After running, go to API Settings and add "app" to "Exposed schemas".

-- 1. Schema & tables --------------------------------------------------------

CREATE SCHEMA IF NOT EXISTS app;

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

CREATE TABLE IF NOT EXISTS app.agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id VARCHAR(20) UNIQUE NOT NULL,
  agent_token VARCHAR(12) UNIQUE,
  room_code VARCHAR(14) NOT NULL REFERENCES app.rooms(room_code),
  agent_name VARCHAR(100),
  status VARCHAR(10) NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  activated_at TIMESTAMPTZ,
  left_at TIMESTAMPTZ,
  CONSTRAINT chk_agent_status CHECK (status IN ('pending', 'active', 'left', 'kicked'))
);

CREATE TABLE IF NOT EXISTS app.messages (
  id SERIAL PRIMARY KEY,
  room_code VARCHAR(14) NOT NULL REFERENCES app.rooms(room_code),
  agent_id VARCHAR(20) NOT NULL REFERENCES app.agents(agent_id),
  agent_name VARCHAR(100) NOT NULL,
  content TEXT NOT NULL,
  room_seq INTEGER NOT NULL,
  read_by VARCHAR(20)[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Back-fill columns that may not exist on older installs
ALTER TABLE app.agents ADD COLUMN IF NOT EXISTS agent_token VARCHAR(12);
UPDATE app.agents SET agent_token = 'at_' || substr(md5(random()::text), 1, 8)
  WHERE agent_token IS NULL;
ALTER TABLE app.agents ALTER COLUMN agent_token SET NOT NULL;
ALTER TABLE app.messages ADD COLUMN IF NOT EXISTS read_by VARCHAR(20)[] NOT NULL DEFAULT '{}';

-- 2. Indexes ----------------------------------------------------------------

CREATE UNIQUE INDEX IF NOT EXISTS idx_rooms_room_code ON app.rooms (room_code);
CREATE INDEX IF NOT EXISTS idx_rooms_state_activity ON app.rooms (state, last_activity_at) WHERE state = 'active';
CREATE UNIQUE INDEX IF NOT EXISTS idx_agents_agent_id ON app.agents (agent_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_agents_agent_token ON app.agents (agent_token);
CREATE INDEX IF NOT EXISTS idx_agents_room_status ON app.agents (room_code, status);
CREATE INDEX IF NOT EXISTS idx_agents_pending_cleanup ON app.agents (status, created_at) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_messages_room_cursor ON app.messages (room_code, id);
CREATE INDEX IF NOT EXISTS idx_messages_room_seq ON app.messages (room_code, room_seq);
CREATE INDEX IF NOT EXISTS idx_messages_room_created ON app.messages (room_code, created_at);

-- 3. Grants for PostgREST / supabase-js -------------------------------------

GRANT USAGE ON SCHEMA app TO service_role;
GRANT ALL ON ALL TABLES IN SCHEMA app TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA app TO service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA app TO service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA app
  GRANT ALL ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA app
  GRANT ALL ON ROUTINES TO service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA app
  GRANT ALL ON SEQUENCES TO service_role;

-- 4. RPC functions ----------------------------------------------------------

-- send_message: atomically bump room counter and insert message
CREATE OR REPLACE FUNCTION app.send_message(
  p_room_code VARCHAR,
  p_agent_id VARCHAR,
  p_agent_name VARCHAR,
  p_content TEXT
) RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_message_count INT;
  v_max_messages INT;
  v_room_seq INT;
  v_created_at TIMESTAMPTZ;
BEGIN
  UPDATE app.rooms
  SET message_count = message_count + 1,
      last_activity_at = now(),
      first_message_at = COALESCE(first_message_at, now())
  WHERE room_code = p_room_code
  RETURNING message_count, max_messages INTO v_message_count, v_max_messages;

  INSERT INTO app.messages (room_code, agent_id, agent_name, content, room_seq)
  VALUES (p_room_code, p_agent_id, p_agent_name, p_content, v_message_count)
  RETURNING room_seq, created_at INTO v_room_seq, v_created_at;

  RETURN json_build_object(
    'message_id', v_room_seq,
    'timestamp', v_created_at,
    'room_message_count', v_message_count,
    'max_messages', v_max_messages
  );
END;
$$;

-- activate_agent: atomically check capacity and flip pending -> active
CREATE OR REPLACE FUNCTION app.activate_agent(
  p_agent_id VARCHAR,
  p_agent_name VARCHAR,
  p_room_code VARCHAR,
  p_max_active INT
) RETURNS VARCHAR LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_active_count INT;
  v_result VARCHAR;
BEGIN
  PERFORM 1 FROM app.rooms WHERE room_code = p_room_code FOR UPDATE;

  SELECT COUNT(*) INTO v_active_count
  FROM app.agents
  WHERE room_code = p_room_code AND status = 'active';

  IF v_active_count >= p_max_active THEN
    RETURN NULL;
  END IF;

  UPDATE app.agents
  SET status = 'active', agent_name = p_agent_name, activated_at = now()
  WHERE agent_id = p_agent_id AND status = 'pending'
  RETURNING app.agents.agent_id INTO v_result;

  RETURN v_result;
END;
$$;

-- mark_messages_read: append agent to read_by arrays, return updated rows
CREATE OR REPLACE FUNCTION app.mark_messages_read(
  p_room_code VARCHAR,
  p_agent_id VARCHAR,
  p_message_ids INT[]
) RETURNS SETOF JSON LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT json_build_object(
    'message_id', m.room_seq,
    'agent_id', m.agent_id,
    'agent_name', m.agent_name,
    'content', m.content,
    'timestamp', m.created_at,
    'read_by', m.read_by
  )
  FROM (
    UPDATE app.messages
    SET read_by = CASE
      WHEN read_by @> ARRAY[p_agent_id]::varchar[] THEN read_by
      ELSE array_append(read_by, p_agent_id)
    END
    WHERE room_code = p_room_code AND room_seq = ANY(p_message_ids)
    RETURNING *
  ) m
  ORDER BY m.room_seq;
END;
$$;

-- ensure_schema: no-op stub callable from the /migrations endpoint
CREATE OR REPLACE FUNCTION app.ensure_schema()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  NULL;
END;
$$;
