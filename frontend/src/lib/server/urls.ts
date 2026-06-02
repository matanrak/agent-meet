import type { NextRequest } from "next/server";

export function getBaseUrl(request: NextRequest): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL || process.env.FRONTEND_URL;
  if (configured) {
    return configured.replace(/\/$/, "");
  }

  const proto = request.headers.get("x-forwarded-proto") ?? request.nextUrl.protocol.replace(":", "");
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  return `${proto}://${host}`;
}
