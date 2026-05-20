import { query } from "./db";
import {
  generateAgentId,
  generateAgentToken,
  generateCreatorToken,
  generateRoomCode,
} from "./ids";
import type { AgentRow, AgentSummary, MessageRow, RoomRow } from "./types";

const MAX_ACTIVE_AGENTS = 20;

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public extra: Record<string, unknown> = {}
  ) {
    super(message);
  }
}

export async function createRoom(maxMessages = 500): Promise<RoomRow> {
  const roomCode = generateRoomCode();
  const creatorToken = generateCreatorToken();
  const result = await query<RoomRow>(
    `INSERT INTO app.rooms (room_code, creator_token, max_messages)
     VALUES ($1, $2, $3)
     RETURNING room_code, creator_token, state, max_messages, message_count, lock_reason,
       locked_at, first_message_at, last_activity_at, created_at`,
    [roomCode, creatorToken, maxMessages]
  );
  return result.rows[0];
}

export async function getRoom(roomCode: string): Promise<RoomRow | null> {
  const result = await query<RoomRow>(
    `SELECT room_code, creator_token, state, max_messages, message_count, lock_reason,
       locked_at, first_message_at, last_activity_at, created_at
     FROM app.rooms
     WHERE room_code = $1`,
    [roomCode]
  );
  return result.rows[0] ?? null;
}

export async function registerAgent(roomCode: string): Promise<AgentRow> {
  const agentId = generateAgentId();
  const agentToken = generateAgentToken();
  const result = await query<AgentRow>(
    `INSERT INTO app.agents (agent_id, agent_token, room_code, status)
     VALUES ($1, $2, $3, 'pending')
     RETURNING agent_id, agent_token, room_code, agent_name, status, created_at, activated_at, left_at`,
    [agentId, agentToken, roomCode]
  );
  return result.rows[0];
}


export async function getAgentByToken(
  roomCode: string,
  agentToken: string
): Promise<AgentRow | null> {
  const result = await query<AgentRow>(
    `SELECT agent_id, agent_token, room_code, agent_name, status, created_at, activated_at, left_at
     FROM app.agents
     WHERE room_code = $1 AND agent_token = $2`,
    [roomCode, agentToken]
  );
  return result.rows[0] ?? null;
}

export async function countActiveAgents(roomCode: string): Promise<number> {
  const result = await query<{ count: string }>(
    "SELECT COUNT(*) AS count FROM app.agents WHERE room_code = $1 AND status = 'active'",
    [roomCode]
  );
  return Number(result.rows[0]?.count ?? 0);
}

export async function getRoomStatus(roomCode: string) {
  const room = await getRoom(roomCode);
  if (!room) return null;

  const counts = await query<{ active: string; pending: string }>(
    `SELECT
       COALESCE(SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END), 0) AS active,
       COALESCE(SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END), 0) AS pending
     FROM app.agents
     WHERE room_code = $1`,
    [roomCode]
  );

  return {
    room_code: room.room_code,
    state: room.state,
    agents: {
      active: Number(counts.rows[0]?.active ?? 0),
      pending: Number(counts.rows[0]?.pending ?? 0),
    },
    message_count: room.message_count,
    max_messages: room.max_messages,
    created_at: room.created_at.toISOString(),
    first_message_at: room.first_message_at?.toISOString(),
    locked_at: room.locked_at?.toISOString(),
    lock_reason: room.lock_reason ?? undefined,
  };
}

export async function getRecentMessages(
  roomCode: string,
  limit?: number
): Promise<MessageRow[]> {
  if (limit === 0) return [];

  if (limit != null) {
    const result = await query<MessageRow>(
      `SELECT room_seq AS message_id, agent_id, agent_name, content, created_at AS timestamp, read_by
       FROM (
         SELECT room_seq, agent_id, agent_name, content, created_at, read_by
         FROM app.messages
         WHERE room_code = $1
         ORDER BY room_seq DESC
         LIMIT $2
       ) recent
       ORDER BY room_seq`,
      [roomCode, limit]
    );
    return result.rows;
  }

  const result = await query<MessageRow>(
    `SELECT room_seq AS message_id, agent_id, agent_name, content, created_at AS timestamp, read_by
     FROM app.messages
     WHERE room_code = $1
     ORDER BY room_seq`,
    [roomCode]
  );
  return result.rows;
}

export async function getUnreadMessages(
  roomCode: string,
  agentId: string
): Promise<MessageRow[]> {
  const result = await query<MessageRow>(
    `SELECT room_seq AS message_id, agent_id, agent_name, content, created_at AS timestamp, read_by
     FROM app.messages
     WHERE room_code = $1
       AND agent_id <> $2
       AND NOT (read_by @> ARRAY[$2]::varchar[])
     ORDER BY room_seq`,
    [roomCode, agentId]
  );
  return result.rows;
}

export async function markMessagesRead(
  roomCode: string,
  agentId: string,
  messageIds: number[]
): Promise<MessageRow[]> {
  if (messageIds.length === 0) return [];

  const result = await query<MessageRow>(
    `UPDATE app.messages
     SET read_by = CASE
       WHEN read_by @> ARRAY[$2]::varchar[] THEN read_by
       ELSE array_append(read_by, $2)
     END
     WHERE room_code = $1 AND room_seq = ANY($3::int[])
     RETURNING room_seq AS message_id, agent_id, agent_name, content, created_at AS timestamp, read_by`,
    [roomCode, agentId, messageIds]
  );
  return result.rows.sort((a, b) => a.message_id - b.message_id);
}

export async function sendMessage(
  roomCode: string,
  agentToken: string,
  agentName: string,
  content: string
) {
  const room = await getRoom(roomCode);
  if (!room) {
    throw new ApiError(404, "room_not_found", "No room with this code exists");
  }
  if (room.state === "locked") {
    throw new ApiError(
      423,
      "room_locked",
      "This room is locked and read-only. No new messages or agents allowed."
    );
  }

  const agent = await getAgentByToken(roomCode, agentToken);
  if (!agent) {
    throw new ApiError(401, "unauthorized", "Invalid agent token");
  }
  if (agent.status === "left" || agent.status === "kicked") {
    throw new ApiError(403, "agent_inactive", "Agent has been kicked or has left the room");
  }

  if (agent.status === "pending") {
    const activated = await query<{ agent_id: string }>(
      `WITH lock AS (
         SELECT 1 FROM app.rooms WHERE room_code = $3 FOR UPDATE
       ),
       active_count AS (
         SELECT COUNT(*) AS n
         FROM app.agents
         WHERE room_code = $3 AND status = 'active'
       )
       UPDATE app.agents
       SET status = 'active', agent_name = $2, activated_at = now()
       FROM active_count, lock
       WHERE agent_id = $1
         AND status = 'pending'
         AND active_count.n < $4
       RETURNING app.agents.agent_id`,
      [agent.agent_id, agentName, roomCode, MAX_ACTIVE_AGENTS]
    );
    if (!activated.rows[0]) {
      throw new ApiError(409, "room_full", "Room has reached the maximum of 20 active agents", {
        max_agents: MAX_ACTIVE_AGENTS,
      });
    }
  } else if (agent.agent_name !== agentName) {
    await query("UPDATE app.agents SET agent_name = $2 WHERE agent_id = $1", [
      agent.agent_id,
      agentName,
    ]);
  }

  const inserted = await query<{
    message_id: number;
    timestamp: Date;
    room_message_count: number;
    max_messages: number;
  }>(
    `WITH seq AS (
       UPDATE app.rooms
       SET message_count = message_count + 1,
         last_activity_at = now(),
         first_message_at = COALESCE(first_message_at, now())
       WHERE room_code = $1
       RETURNING message_count, max_messages
     )
     INSERT INTO app.messages (room_code, agent_id, agent_name, content, room_seq)
     SELECT $1, $2, $3, $4, seq.message_count
     FROM seq
     RETURNING room_seq AS message_id, created_at AS timestamp,
       (SELECT message_count FROM seq) AS room_message_count,
       (SELECT max_messages FROM seq) AS max_messages`,
    [roomCode, agent.agent_id, agentName, content]
  );

  const row = inserted.rows[0];
  if (row.room_message_count >= row.max_messages) {
    await lockRoom(roomCode, "max_messages_reached");
  }

  return {
    message_id: row.message_id,
    timestamp: row.timestamp.toISOString(),
    room_message_count: row.room_message_count,
    max_messages: row.max_messages,
  };
}

export async function leaveRoom(roomCode: string, agentToken: string): Promise<boolean> {
  const agent = await getAgentByToken(roomCode, agentToken);
  if (!agent) return false;

  await query("UPDATE app.agents SET status = 'left', left_at = now() WHERE agent_id = $1", [
    agent.agent_id,
  ]);
  return true;
}

export async function validateCreatorToken(roomCode: string, creatorToken: string): Promise<boolean> {
  const result = await query<{ valid: boolean }>(
    "SELECT creator_token = $2 AS valid FROM app.rooms WHERE room_code = $1",
    [roomCode, creatorToken]
  );
  return Boolean(result.rows[0]?.valid);
}

export async function getAgentById(agentId: string): Promise<AgentRow | null> {
  const result = await query<AgentRow>(
    `SELECT agent_id, agent_token, room_code, agent_name, status, created_at, activated_at, left_at
     FROM app.agents
     WHERE agent_id = $1`,
    [agentId]
  );
  return result.rows[0] ?? null;
}

export async function kickAgent(roomCode: string, targetAgentId: string): Promise<AgentRow | null> {
  const agent = await getAgentById(targetAgentId);
  if (!agent || agent.room_code !== roomCode || !["active", "pending"].includes(agent.status)) {
    return null;
  }

  await query("UPDATE app.agents SET status = 'kicked', left_at = now() WHERE agent_id = $1", [
    targetAgentId,
  ]);
  return agent;
}

export async function lockRoom(roomCode: string, reason: string) {
  const result = await query<RoomRow>(
    `UPDATE app.rooms
     SET state = 'locked', lock_reason = $2, locked_at = now()
     WHERE room_code = $1
     RETURNING room_code, creator_token, state, max_messages, message_count, lock_reason,
       locked_at, first_message_at, last_activity_at, created_at`,
    [roomCode, reason]
  );
  return result.rows[0] ?? null;
}

export async function getAgentsInRoom(roomCode: string): Promise<AgentSummary[]> {
  const result = await query<AgentSummary>(
    `SELECT agent_id, COALESCE(agent_name, '') AS agent_name, status, created_at, activated_at
     FROM app.agents
     WHERE room_code = $1 AND status != 'pending'
     ORDER BY activated_at`,
    [roomCode]
  );
  return result.rows;
}

export async function getPaginatedMessages(roomCode: string, limit: number, offset: number) {
  const total = await query<{ total: number }>(
    "SELECT count(*)::int AS total FROM app.messages WHERE room_code = $1",
    [roomCode]
  );
  const messages = await query<MessageRow>(
    `SELECT room_seq AS message_id, agent_id, agent_name, content, created_at AS timestamp, read_by
     FROM app.messages
     WHERE room_code = $1
     ORDER BY room_seq
     LIMIT $2 OFFSET $3`,
    [roomCode, limit, offset]
  );

  const totalMessages = total.rows[0]?.total ?? 0;
  return {
    messages: messages.rows,
    total_messages: totalMessages,
    limit,
    offset,
    has_more: offset + limit < totalMessages,
  };
}
