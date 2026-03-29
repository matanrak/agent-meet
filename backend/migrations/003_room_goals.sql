ALTER TABLE app.rooms
  ADD COLUMN IF NOT EXISTS goal VARCHAR(20) NOT NULL DEFAULT 'chat';
ALTER TABLE app.rooms
  ADD CONSTRAINT chk_goal CHECK (goal IN ('chat', 'build', 'decide'));
