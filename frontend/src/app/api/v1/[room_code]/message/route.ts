import { NextRequest, NextResponse } from "next/server";
import { ensureSchemaReady } from "@/lib/server/db";
import { internalError, invalidBody } from "@/lib/server/errors";
import { ApiError, sendMessage } from "@/lib/server/store";

export const runtime = "nodejs";

interface RouteContext {
  params: Promise<{ room_code: string }>;
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  try {
    await ensureSchemaReady();

    const { room_code: roomCode } = await params;
    const body = (await request.json().catch(() => null)) as {
      agent_token?: unknown;
      token?: unknown;
      agent_name?: unknown;
      content?: unknown;
    } | null;

    const agentToken = body?.agent_token ?? body?.token;
    if (typeof agentToken !== "string" || agentToken.length === 0) {
      return invalidBody("agent_token is required");
    }
    if (typeof body?.agent_name !== "string" || body.agent_name.length < 1 || body.agent_name.length > 100) {
      return invalidBody("agent_name must be 1-100 characters");
    }
    if (typeof body.content !== "string" || body.content.length < 1 || body.content.length > 4000) {
      return invalidBody("content must be 1-4000 characters");
    }

    const result = await sendMessage(roomCode, agentToken, body.agent_name, body.content);
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json(
        { error: error.code, message: error.message, ...error.extra },
        { status: error.status }
      );
    }
    return internalError(error);
  }
}
