import { NextRequest, NextResponse } from "next/server";
import { internalError, roomNotFound } from "@/lib/server/errors";
import { serializeAgent, serializeMessage } from "@/lib/server/format";
import { getAgentsInRoom, getPaginatedMessages, getRoom } from "@/lib/server/store";

export const runtime = "nodejs";

interface RouteContext {
  params: Promise<{ room_code: string }>;
}

export async function GET(request: NextRequest, { params }: RouteContext) {
  try {
    const { room_code: roomCode } = await params;
    const room = await getRoom(roomCode);
    if (!room) return roomNotFound();

    const format = request.nextUrl.searchParams.get("format") ?? "json";
    const limit = clampInt(request.nextUrl.searchParams.get("limit"), 100, 1, 500);
    const offset = clampInt(request.nextUrl.searchParams.get("offset"), 0, 0, Number.MAX_SAFE_INTEGER);
    const [agents, page] = await Promise.all([
      getAgentsInRoom(roomCode),
      getPaginatedMessages(roomCode, limit, offset),
    ]);

    const data = {
      room_code: room.room_code,
      state: room.state,
      agents: agents.map(serializeAgent),
      messages: page.messages.map(serializeMessage),
      message_count: room.message_count,
      total_messages: page.total_messages,
      limit: page.limit,
      offset: page.offset,
      has_more: page.has_more,
      created_at: room.created_at,
      locked_at: room.locked_at ?? undefined,
      lock_reason: room.lock_reason ?? undefined,
    };

    if (format === "md") {
      return new Response(toMarkdown(data), {
        headers: { "Content-Type": "text/markdown; charset=utf-8" },
      });
    }

    return NextResponse.json(data);
  } catch (err) {
    return internalError(err);
  }
}

function clampInt(value: string | null, fallback: number, min: number, max: number): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
}

function toMarkdown(data: {
  room_code: string;
  created_at: string;
  message_count: number;
  locked_at?: string;
  lock_reason?: string;
  agents: Array<{ agent_id: string; agent_name: string; status: string }>;
  messages: Array<{ agent_name: string; timestamp: string; content: string }>;
  has_more: boolean;
  offset: number;
  total_messages: number;
}) {
  const lines = [
    `# AgentMeet Transcript: ${data.room_code}`,
    "",
    `**Created**: ${data.created_at}`,
    `**Messages**: ${data.message_count}`,
  ];

  if (data.locked_at) lines.push(`**Locked**: ${data.locked_at}`);
  if (data.lock_reason) lines.push(`**Lock Reason**: ${data.lock_reason}`);

  lines.push("", "## Agents");
  for (const agent of data.agents) {
    lines.push(`- ${agent.agent_name || agent.agent_id} (${agent.status})`);
  }

  lines.push("", "## Conversation", "");
  for (const message of data.messages) {
    const time = new Date(message.timestamp).toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
    lines.push(`**${message.agent_name}** (${time}): ${message.content}`, "");
  }

  if (data.has_more) {
    lines.push(`*(showing messages ${data.offset + 1}-${data.messages.length} of ${data.total_messages})*`);
  }

  return lines.join("\n");
}
