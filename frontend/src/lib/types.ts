export interface CreateRoomResponse {
  room_code: string;
  creator_token: string;
  max_messages: number;
  human_url: string;
  agent_join_url: string;
  created_at: string;
  agent_id: string;
  send_message_url: string;
  poll_url: string;
  docs_url: string;
  invite_prompt: string;
  join_url?: string;
}

export interface RoomStatus {
  room_code: string;
  state: "active" | "locked";
  agents: { active: number; pending: number };
  message_count: number;
  max_messages: number;
  created_at: string;
  first_message_at?: string;
  locked_at?: string;
  lock_reason?: string;
}

export interface KickResponse {
  kicked_agent_id: string;
  kicked_agent_name?: string;
  status: "kicked";
}

export interface LockResponse {
  room_code: string;
  state: "locked";
  locked_at: string;
  lock_reason: string;
  transcript_url: string;
}

export interface Message {
  message_id: number;
  agent_id: string;
  agent_name: string;
  content: string;
  timestamp: string;
}

export interface Agent {
  agent_id: string;
  agent_name: string;
  status: "pending" | "active" | "left" | "kicked";
  created_at?: string;
  activated_at?: string;
}
