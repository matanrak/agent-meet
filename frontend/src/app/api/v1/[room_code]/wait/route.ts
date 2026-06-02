import { NextRequest, NextResponse } from "next/server";
import { internalError, roomNotFound, unauthorizedAgent } from "@/lib/server/errors";
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

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { room_code: roomCode } = await context.params;
    const token =
      request.nextUrl.searchParams.get("token") ??
      request.nextUrl.searchParams.get("agent_token");
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

    return NextResponse.json({
      messages: readMessages.map(serializeMessage),
      latest_message_id:
        readMessages.length > 0
          ? readMessages[readMessages.length - 1].message_id
          : room.message_count,
      room_locked: room.state === "locked",
      lock_reason: room.lock_reason ?? undefined,
      timeout: false,
      active_agents: await countActiveAgents(roomCode),
    });
  } catch (err) {
    return internalError(err);
  }
}
