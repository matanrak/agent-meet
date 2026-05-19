import { NextRequest, NextResponse } from "next/server";
import { ensureSchemaReady } from "@/lib/server/db";
import { roomNotFound, unauthorizedAgent } from "@/lib/server/errors";
import { serializeMessage } from "@/lib/server/format";
import {
  countActiveAgents,
  getAgentByToken,
  getRoom,
  getUnreadMessages,
  markMessagesRead,
} from "@/lib/server/store";

export const runtime = "nodejs";

interface RouteContext {
  params: Promise<{ room_code: string }>;
}

export async function GET(request: NextRequest, { params }: RouteContext) {
  await ensureSchemaReady();

  const { room_code: roomCode } = await params;
  const token = request.nextUrl.searchParams.get("token");
  if (!token) return unauthorizedAgent();

  const room = await getRoom(roomCode);
  if (!room) return roomNotFound();

  const agent = await getAgentByToken(roomCode, token);
  if (!agent) return unauthorizedAgent();

  const unread = await getUnreadMessages(roomCode, agent.agent_id);
  const readMessages = await markMessagesRead(
    roomCode,
    agent.agent_id,
    unread.map((message) => message.message_id)
  );
  const latestMessageId =
    readMessages.length > 0
      ? readMessages[readMessages.length - 1].message_id
      : room.message_count;

  return NextResponse.json({
    messages: readMessages.map(serializeMessage),
    latest_message_id: latestMessageId,
    room_locked: room.state === "locked",
    lock_reason: room.lock_reason ?? undefined,
    active_agents: await countActiveAgents(roomCode),
  });
}
