-- Data migration: move existing data from app.* to public.* WITHOUT data loss.
-- Run this in the Supabase SQL Editor AFTER running migration.sql.
-- This script is idempotent — safe to run multiple times.

-- 1. Copy rooms (skip duplicates based on room_code)
INSERT INTO public.rooms (id, room_code, creator_token, state, max_messages, message_count, lock_reason, locked_at, first_message_at, last_activity_at, created_at)
SELECT id, room_code, creator_token, state, max_messages, message_count, lock_reason, locked_at, first_message_at, last_activity_at, created_at
FROM app.rooms
ON CONFLICT (room_code) DO NOTHING;

-- 2. Copy agents (skip duplicates based on agent_id)
INSERT INTO public.agents (id, agent_id, agent_token, room_code, agent_name, status, created_at, activated_at, left_at)
SELECT id, agent_id, agent_token, room_code, agent_name, status, created_at, activated_at, left_at
FROM app.agents
ON CONFLICT (agent_id) DO NOTHING;

-- 3. Copy messages (skip duplicates based on id)
INSERT INTO public.messages (id, room_code, agent_id, agent_name, content, room_seq, read_by, created_at)
SELECT id, room_code, agent_id, agent_name, content, room_seq, read_by, created_at
FROM app.messages
ON CONFLICT (id) DO NOTHING;

-- 4. Sync the messages serial sequence to avoid ID collisions
SELECT setval('public.messages_id_seq', COALESCE((SELECT MAX(id) FROM public.messages), 0) + 1, false);

-- 5. Verify row counts match
DO $$
DECLARE
  app_rooms INT; pub_rooms INT;
  app_agents INT; pub_agents INT;
  app_messages INT; pub_messages INT;
BEGIN
  SELECT COUNT(*) INTO app_rooms FROM app.rooms;
  SELECT COUNT(*) INTO pub_rooms FROM public.rooms;
  SELECT COUNT(*) INTO app_agents FROM app.agents;
  SELECT COUNT(*) INTO pub_agents FROM public.agents;
  SELECT COUNT(*) INTO app_messages FROM app.messages;
  SELECT COUNT(*) INTO pub_messages FROM public.messages;

  RAISE NOTICE 'Rooms: app=% public=%', app_rooms, pub_rooms;
  RAISE NOTICE 'Agents: app=% public=%', app_agents, pub_agents;
  RAISE NOTICE 'Messages: app=% public=%', app_messages, pub_messages;

  IF app_rooms <> pub_rooms OR app_agents <> pub_agents OR app_messages <> pub_messages THEN
    RAISE WARNING 'Row counts do not match! Check for issues before dropping app schema.';
  ELSE
    RAISE NOTICE 'All counts match. Safe to drop app schema when ready.';
  END IF;
END $$;

-- 6. (Optional) Drop the old app schema once you've verified the data.
-- Uncomment only after confirming everything works.
-- DROP SCHEMA app CASCADE;
