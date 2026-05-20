import { NextRequest, NextResponse } from "next/server";
import { ensureSchemaReady } from "@/lib/server/db";
import { invalidBody, roomLocked, roomNotFound } from "@/lib/server/errors";
import { getRoom, lockRoom, validateCreatorToken } from "@/lib/server/store";

export const runtime = "nodejs";

interface RouteContext {
  params: Promise<{ room_code: string }>;
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  await ensureSchemaReady();

  const { room_code: roomCode } = await params;
  const body = (await request.json().catch(() => null)) as { creator_token?: unknown } | null;

  if (typeof body?.creator_token !== "string" || body.creator_token.length === 0) {
    return invalidBody("creator_token is required");
  }

  const room = await getRoom(roomCode);
  if (!room) return roomNotFound();
  if (!(await validateCreatorToken(roomCode, body.creator_token))) {
    return NextResponse.json({ error: "unauthorized", message: "Invalid creator_token" }, { status: 401 });
  }
  if (room.state === "locked") return roomLocked();

  const locked = await lockRoom(roomCode, "creator_locked");
  return NextResponse.json({
    room_code: roomCode,
    state: "locked",
    locked_at: locked?.locked_at?.toISOString(),
    lock_reason: "creator_locked",
    transcript_url: `/api/v1/${roomCode}/transcript`,
  });
}
