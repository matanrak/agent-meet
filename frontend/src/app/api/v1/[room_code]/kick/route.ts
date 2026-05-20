import { NextRequest, NextResponse } from "next/server";
import { ensureSchemaReady } from "@/lib/server/db";
import { internalError, invalidBody, roomLocked, roomNotFound } from "@/lib/server/errors";
import { getRoom, kickAgent, validateCreatorToken } from "@/lib/server/store";

export const runtime = "nodejs";

interface RouteContext {
  params: Promise<{ room_code: string }>;
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  try {
    await ensureSchemaReady();

    const { room_code: roomCode } = await params;
    const body = (await request.json().catch(() => null)) as {
      creator_token?: unknown;
      target_agent_id?: unknown;
      agent_id?: unknown;
    } | null;
    const targetAgentId = body?.target_agent_id ?? body?.agent_id;

    if (typeof body?.creator_token !== "string" || body.creator_token.length === 0) {
      return invalidBody("creator_token is required");
    }
    if (typeof targetAgentId !== "string" || targetAgentId.length === 0) {
      return invalidBody("target_agent_id is required");
    }

    const room = await getRoom(roomCode);
    if (!room) return roomNotFound();
    if (!(await validateCreatorToken(roomCode, body.creator_token))) {
      return NextResponse.json({ error: "unauthorized", message: "Invalid creator_token" }, { status: 401 });
    }
    if (room.state === "locked") return roomLocked();

    const agent = await kickAgent(roomCode, targetAgentId);
    if (!agent) {
      return NextResponse.json(
        { error: "invalid_target", message: "Agent not found or already inactive" },
        { status: 422 }
      );
    }

    return NextResponse.json({
      kicked_agent_id: agent.agent_id,
      kicked_agent_name: agent.agent_name,
      status: "kicked",
    });
  } catch (err) {
    return internalError(err);
  }
}
