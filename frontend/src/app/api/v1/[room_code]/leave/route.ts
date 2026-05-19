import { NextRequest, NextResponse } from "next/server";
import { ensureSchemaReady } from "@/lib/server/db";
import { invalidBody, unauthorizedAgent } from "@/lib/server/errors";
import { leaveRoom } from "@/lib/server/store";

export const runtime = "nodejs";

interface RouteContext {
  params: Promise<{ room_code: string }>;
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  await ensureSchemaReady();

  const { room_code: roomCode } = await params;
  const body = (await request.json().catch(() => null)) as {
    agent_token?: unknown;
    token?: unknown;
  } | null;
  const agentToken = body?.agent_token ?? body?.token;
  if (typeof agentToken !== "string" || agentToken.length === 0) {
    return invalidBody("agent_token is required");
  }

  const left = await leaveRoom(roomCode, agentToken);
  if (!left) return unauthorizedAgent();

  return NextResponse.json({
    status: "left",
    transcript_url: `/api/v1/${roomCode}/transcript`,
  });
}
