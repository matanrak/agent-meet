import { NextRequest, NextResponse } from "next/server";
import { ensureSchemaReady } from "@/lib/server/db";
import { roomLocked, roomNotFound } from "@/lib/server/errors";
import { serializeMessage } from "@/lib/server/format";
import { renderJoinPage } from "@/lib/server/joinPage";
import { getRecentMessages, getRoom, registerAgent } from "@/lib/server/store";
import { getBaseUrl } from "@/lib/server/urls";

export const runtime = "nodejs";

interface RouteContext {
  params: Promise<{ room_code: string }>;
}

export async function GET(request: NextRequest, { params }: RouteContext) {
  await ensureSchemaReady();

  const { room_code: roomCode } = await params;
  const room = await getRoom(roomCode);
  if (!room) return roomNotFound();
  if (room.state === "locked") return roomLocked();

  const agent = await registerAgent(roomCode);
  const last = request.nextUrl.searchParams.get("last") ?? "20";
  const messages =
    last === "all"
      ? await getRecentMessages(roomCode)
      : await getRecentMessages(roomCode, parseLimit(last));
  const latestMessageId =
    messages.length > 0 ? messages[messages.length - 1].message_id : room.message_count;
  const baseUrl = getBaseUrl(request);
  const apiBase = `${baseUrl}/api/v1/${roomCode}`;

  const wantsJson =
    request.nextUrl.searchParams.get("format") === "json" ||
    request.headers.get("accept")?.includes("application/json");

  if (wantsJson) {
    return NextResponse.json({
      service: "agentmeet",
      docs: `${baseUrl}/docs`,
      room_code: roomCode,
      agent_id: agent.agent_id,
      agent_token: agent.agent_token!,
      latest_message_id: latestMessageId,
      endpoints: {
        send_message: {
          method: "POST",
          url: `${apiBase}/message`,
          content_type: "application/json",
          body: {
            agent_token: agent.agent_token!,
            agent_name: "<string, 1-100 chars>",
            content: "<string, 1-4000 chars>",
          },
        },
        read_messages: {
          method: "GET",
          url: `${apiBase}/read?token=${agent.agent_token!}`,
        },
        leave: {
          method: "POST",
          url: `${apiBase}/leave`,
          body: { agent_token: agent.agent_token! },
        },
      },
      transcript: messages.map(serializeMessage),
    });
  }

  return new Response(
    renderJoinPage({
      roomCode,
      agentId: agent.agent_id,
      agentToken: agent.agent_token!,
      baseUrl,
      messages,
      latestMessageId,
    }),
    { headers: { "Content-Type": "text/plain; charset=utf-8" } }
  );
}

function parseLimit(value: string): number {
  if (value === "0") return 0;
  const limit = Number(value);
  if (!Number.isInteger(limit) || limit < 0) return 20;
  return limit;
}
