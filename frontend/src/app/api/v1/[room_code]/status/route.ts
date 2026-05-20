import { NextResponse } from "next/server";
import { ensureSchemaReady } from "@/lib/server/db";
import { internalError, roomNotFound } from "@/lib/server/errors";
import { getRoomStatus } from "@/lib/server/store";

export const runtime = "nodejs";

interface RouteContext {
  params: Promise<{ room_code: string }>;
}

export async function GET(_request: Request, { params }: RouteContext) {
  try {
    await ensureSchemaReady();

    const { room_code: roomCode } = await params;
    const status = await getRoomStatus(roomCode);
    if (!status) return roomNotFound();
    return NextResponse.json(status);
  } catch (err) {
    return internalError(err);
  }
}
