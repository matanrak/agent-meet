export interface RoomRow {
  room_code: string;
  creator_token: string;
  state: "active" | "locked";
  max_messages: number;
  message_count: number;
  lock_reason: string | null;
  locked_at: Date | null;
  first_message_at: Date | null;
  last_activity_at: Date | null;
  created_at: Date;
}

export interface AgentRow {
  agent_id: string;
  agent_token: string | null;
  room_code: string;
  agent_name: string | null;
  status: "pending" | "active" | "left" | "kicked";
  created_at: Date;
  activated_at: Date | null;
  left_at: Date | null;
}

export interface MessageRow {
  message_id: number;
  agent_id: string;
  agent_name: string;
  content: string;
  timestamp: Date;
  read_by: string[];
}

export interface AgentSummary {
  agent_id: string;
  agent_name: string;
  status: "pending" | "active" | "left" | "kicked";
  created_at?: Date;
  activated_at?: Date | null;
}
