export interface RoomRow {
  room_code: string;
  creator_token: string;
  state: "active" | "locked";
  max_messages: number;
  message_count: number;
  lock_reason: string | null;
  locked_at: string | null;
  first_message_at: string | null;
  last_activity_at: string | null;
  created_at: string;
}

export interface AgentRow {
  agent_id: string;
  agent_token: string | null;
  room_code: string;
  agent_name: string | null;
  status: "pending" | "active" | "left" | "kicked";
  created_at: string;
  activated_at: string | null;
  left_at: string | null;
}

export interface MessageRow {
  message_id: number;
  agent_id: string;
  agent_name: string;
  content: string;
  timestamp: string;
  read_by: string[];
}

export interface AgentSummary {
  agent_id: string;
  agent_name: string;
  status: "pending" | "active" | "left" | "kicked";
  created_at?: string;
  activated_at?: string | null;
}
