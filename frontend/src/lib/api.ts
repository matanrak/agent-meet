import type {
  Agent,
  CreateRoomResponse,
  RoomStatus,
  KickResponse,
  LockResponse,
  Message,
} from "./types";

// Same-origin: fetches go to the Next.js app serving this page.
// Override with NEXT_PUBLIC_API_URL only if pointing at an external backend.
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`API error ${res.status}: ${body}`);
  }
  return res.json() as Promise<T>;
}

export async function createRoom(
  maxMessages?: number
): Promise<CreateRoomResponse> {
  return request<CreateRoomResponse>("/api/v1/rooms", {
    method: "POST",
    body: JSON.stringify(maxMessages != null ? { max_messages: maxMessages } : {}),
  });
}

export async function getRoomStatus(roomCode: string): Promise<RoomStatus> {
  return request<RoomStatus>(`/api/v1/${roomCode}/status`);
}

export interface TranscriptResponse {
  messages: Message[];
  agents: Agent[];
}

export async function getTranscript(roomCode: string): Promise<TranscriptResponse> {
  const data = await request<TranscriptResponse>(`/api/v1/${roomCode}/transcript?format=json`);
  return { messages: data.messages ?? [], agents: data.agents ?? [] };
}

export async function kickAgent(
  roomCode: string,
  creatorToken: string,
  targetAgentId: string
): Promise<KickResponse> {
  return request<KickResponse>(`/api/v1/${roomCode}/kick`, {
    method: "POST",
    body: JSON.stringify({
      creator_token: creatorToken,
      agent_id: targetAgentId,
    }),
  });
}

export async function lockRoom(
  roomCode: string,
  creatorToken: string
): Promise<LockResponse> {
  return request<LockResponse>(`/api/v1/${roomCode}/lock`, {
    method: "POST",
    body: JSON.stringify({ creator_token: creatorToken }),
  });
}

export function getAgentJoinUrl(roomCode: string): string {
  return `${API_URL}/api/v1/${roomCode}/agent-join`;
}

export interface AgentJoinResponse {
  agent_id: string;
  room_code: string;
  latest_message_id: number;
  endpoints: {
    send_message: { method: string; url: string };
    poll_messages: { method: string; url: string };
    leave: { method: string; url: string };
  };
  transcript: Array<{
    message_id: number;
    agent_name: string;
    content: string;
  }>;
}

export async function agentJoin(roomCode: string): Promise<AgentJoinResponse> {
  return request<AgentJoinResponse>(`/api/v1/${roomCode}/agent-join?format=json`);
}
