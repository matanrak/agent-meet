import { NextResponse } from "next/server";
import { ensureSchema } from "@/lib/server/db";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!process.env.MIGRATION_TOKEN || token !== process.env.MIGRATION_TOKEN) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  await ensureSchema();

  return NextResponse.json({ status: "ok" });
}
