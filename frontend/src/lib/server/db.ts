import { Pool, type QueryResult, type QueryResultRow } from "pg";

declare global {
  var agentMeetPool: Pool | undefined;
}

function getConnectionString(): string {
  const connectionString =
    process.env.DATABASE_URL ??
    process.env.POSTGRES_URL ??
    process.env.POSTGRES_PRISMA_URL ??
    process.env.SUPABASE_DB_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL or POSTGRES_URL is required");
  }
  return connectionString;
}

function isRemote(url: string): boolean {
  return !url.includes("localhost") && !url.includes("127.0.0.1");
}

function stripSslMode(url: string): string {
  try {
    const parsed = new URL(url);
    parsed.searchParams.delete("sslmode");
    return parsed.toString();
  } catch {
    return url;
  }
}

export function getPool(): Pool {
  if (!globalThis.agentMeetPool) {
    const raw = getConnectionString();
    const usesSsl =
      process.env.PGSSLMODE !== "disable" && isRemote(raw);
    globalThis.agentMeetPool = new Pool({
      connectionString: usesSsl ? stripSslMode(raw) : raw,
      ssl: usesSsl ? { rejectUnauthorized: false } : undefined,
      max: Number(process.env.DB_POOL_MAX_SIZE ?? 20),
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
    });
  }

  return globalThis.agentMeetPool;
}

export async function query<T extends QueryResultRow>(
  text: string,
  values: unknown[] = []
): Promise<QueryResult<T>> {
  return getPool().query<T>(text, values);
}

let schemaReady: Promise<void> | null = null;

export function ensureSchemaReady(): Promise<void> {
  schemaReady ??= ensureSchema().catch((error: unknown) => {
    schemaReady = null;
    throw error;
  });
  return schemaReady;
}

export async function ensureSchema(): Promise<void> {
  const pool = getPool();
  await pool.query(`
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

    ALTER TABLE app.agents ADD COLUMN IF NOT EXISTS agent_token VARCHAR(12);
    UPDATE app.agents SET agent_token = 'at_' || substr(md5(random()::text), 1, 8) WHERE agent_token IS NULL;
    ALTER TABLE app.agents ALTER COLUMN agent_token SET NOT NULL;
    ALTER TABLE app.messages ADD COLUMN IF NOT EXISTS read_by VARCHAR(20)[] NOT NULL DEFAULT '{}';

    CREATE UNIQUE INDEX IF NOT EXISTS idx_rooms_room_code ON app.rooms (room_code);
    CREATE INDEX IF NOT EXISTS idx_rooms_state_activity ON app.rooms (state, last_activity_at) WHERE state = 'active';
    CREATE UNIQUE INDEX IF NOT EXISTS idx_agents_agent_id ON app.agents (agent_id);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_agents_agent_token ON app.agents (agent_token);
    CREATE INDEX IF NOT EXISTS idx_agents_room_status ON app.agents (room_code, status);
    CREATE INDEX IF NOT EXISTS idx_agents_pending_cleanup ON app.agents (status, created_at) WHERE status = 'pending';
    CREATE INDEX IF NOT EXISTS idx_messages_room_cursor ON app.messages (room_code, id);
    CREATE INDEX IF NOT EXISTS idx_messages_room_seq ON app.messages (room_code, room_seq);
    CREATE INDEX IF NOT EXISTS idx_messages_room_created ON app.messages (room_code, created_at);
  `);
}
