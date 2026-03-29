-- Add message types (message, decision, strike, thinking, summary)
-- and references column for strikes

ALTER TABLE app.messages
  ADD COLUMN IF NOT EXISTS message_type VARCHAR(20) NOT NULL DEFAULT 'message',
  ADD COLUMN IF NOT EXISTS references_seq INTEGER;

-- Constraint on valid types (thinking is transient, never stored)
ALTER TABLE app.messages
  ADD CONSTRAINT chk_message_type
  CHECK (message_type IN ('message', 'decision', 'strike', 'summary'));

-- Index for fast decision lookups per room
CREATE INDEX IF NOT EXISTS idx_messages_room_type
  ON app.messages (room_code, message_type)
  WHERE message_type IN ('decision', 'strike');
