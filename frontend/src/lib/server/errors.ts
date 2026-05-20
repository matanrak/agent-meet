import { NextResponse } from "next/server";

export function errorResponse(
  status: number,
  error: string,
  message: string,
  extra?: Record<string, unknown>
) {
  return NextResponse.json({ error, message, ...extra }, { status });
}

export function roomNotFound() {
  return errorResponse(404, "room_not_found", "No room with this code exists");
}

export function roomLocked() {
  return errorResponse(
    423,
    "room_locked",
    "This room is locked and read-only. No new messages or agents allowed."
  );
}

export function unauthorizedAgent() {
  return errorResponse(401, "unauthorized", "Invalid agent token");
}

export function invalidBody(message = "Invalid request body") {
  return errorResponse(422, "invalid_request", message);
}

export function internalError(err: unknown) {
  const message = err instanceof Error ? err.message : "Internal server error";
  console.error("[api]", message);
  return errorResponse(500, "internal_error", message);
}
