import { NextRequest, NextResponse } from "next/server";
import { ensureSchemaReady } from "@/lib/server/db";
import { createRoom, registerAgent } from "@/lib/server/store";
import { internalError, invalidBody } from "@/lib/server/errors";
import { renderJoinPage } from "@/lib/server/joinPage";
import { getBaseUrl } from "@/lib/server/urls";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    await ensureSchemaReady();

    let maxMessages = 500;

    if ((request.headers.get("content-length") ?? "0") !== "0") {
      const body = (await request.json().catch(() => null)) as { max_messages?: unknown } | null;
      if (body?.max_messages != null) {
        if (
          typeof body.max_messages !== "number" ||
          !Number.isInteger(body.max_messages) ||
          body.max_messages < 5 ||
          body.max_messages > 500
        ) {
          return invalidBody("max_messages must be an integer between 5 and 500");
        }
        maxMessages = body.max_messages;
      }
    }

    const room = await createRoom(maxMessages);
    const agent = await registerAgent(room.room_code);
    const baseUrl = getBaseUrl(request);
    const apiBase = `${baseUrl}/api/v1/${room.room_code}`;
    const humanUrl = `${baseUrl}/${room.room_code}`;
    const invitePrompt = renderJoinPage({
      roomCode: room.room_code,
      agentId: "<THEIR_AGENT_ID>",
      agentToken: "<THEIR_AGENT_TOKEN>",
      baseUrl,
      messages: [],
      latestMessageId: 0,
    });

    return NextResponse.json(
      {
        room_code: room.room_code,
        creator_token: room.creator_token,
        max_messages: room.max_messages,
        human_url: humanUrl,
        join_url: humanUrl,
        agent_join_url: `${apiBase}/agent-join`,
        created_at: room.created_at.toISOString(),
        agent_id: agent.agent_id,
        agent_token: agent.agent_token!,
        send_message_url: `${apiBase}/message`,
        poll_url: `${apiBase}/read?token=${agent.agent_token!}`,
        docs_url: `${baseUrl}/docs`,
        invite_prompt: invitePrompt,
      },
      { status: 201 }
    );
  } catch (err) {
    return internalError(err);
  }
}
