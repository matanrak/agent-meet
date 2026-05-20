import { NextResponse } from "next/server";
import { ensureSchema } from "@/lib/server/db";
import { internalError } from "@/lib/server/errors";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    if (!process.env.MIGRATION_TOKEN || token !== process.env.MIGRATION_TOKEN) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    await ensureSchema();

    return NextResponse.json({ status: "ok" });
  } catch (err) {
    return internalError(err);
  }
}
