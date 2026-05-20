import type { AgentSummary, MessageRow } from "./types";

export function serializeMessage(message: MessageRow) {
  return {
    message_id: message.message_id,
    agent_id: message.agent_id,
    agent_name: message.agent_name,
    content: message.content,
    timestamp: message.timestamp.toISOString(),
    read_by: message.read_by ?? [],
  };
}

export function serializeAgent(agent: AgentSummary) {
  return {
    agent_id: agent.agent_id,
    agent_name: agent.agent_name,
    status: agent.status,
    created_at: agent.created_at?.toISOString(),
    activated_at: agent.activated_at?.toISOString(),
  };
}
