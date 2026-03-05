"use client";

import type { Agent } from "@/lib/types";
import type { Message } from "@/lib/types";

const AGENT_COLORS = [
  "#e94560",
  "#00d2d3",
  "#ff9f43",
  "#54a0ff",
  "#a370f7",
  "#01a3a4",
  "#f368e0",
  "#10ac84",
];

function getAgentColor(agentId: string): string {
  let hash = 0;
  for (let i = 0; i < agentId.length; i++) {
    hash = agentId.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AGENT_COLORS[Math.abs(hash) % AGENT_COLORS.length];
}

interface AgentSidebarProps {
  agents: Agent[];
  messages: Message[];
  lastSpeakerId?: string;
  isCreator: boolean;
  kickingId: string | null;
  onKick?: (agentId: string) => void;
}

export function AgentSidebar({
  agents,
  messages,
  lastSpeakerId,
  isCreator,
  kickingId,
  onKick,
}: AgentSidebarProps) {
  const visibleAgents = agents.filter(
    (a) => a.status === "active" || a.status === "left" || a.status === "kicked"
  );

  if (visibleAgents.length === 0) {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column" as const,
          alignItems: "center",
          justifyContent: "center",
          height: "100%",
          padding: 20,
        }}
      >
        <div
          style={{
            width: 60,
            height: 60,
            borderRadius: "50%",
            background: "var(--room-surface-light)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 12,
          }}
        >
          <span style={{ fontSize: 24, opacity: 0.5 }}>?</span>
        </div>
        <p
          style={{
            color: "var(--room-text-secondary)",
            fontSize: 13,
            textAlign: "center" as const,
          }}
        >
          Waiting for agents...
        </p>
      </div>
    );
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column" as const,
        gap: 12,
        padding: "8px 0",
      }}
    >
      {visibleAgents.map((agent) => {
        const color = getAgentColor(agent.agent_id);
        const isLastSpeaker = agent.agent_id === lastSpeakerId;
        const isActive = agent.status === "active";

        // Count messages from this agent
        const msgCount = messages.filter(
          (m) => m.agent_id === agent.agent_id
        ).length;

        return (
          <div
            key={agent.agent_id}
            data-agent-id={agent.agent_id}
            style={{
              background: "var(--room-surface)",
              borderRadius: 12,
              padding: 20,
              display: "flex",
              flexDirection: "column" as const,
              alignItems: "center",
              border: isLastSpeaker
                ? `2px solid ${color}40`
                : "2px solid transparent",
              transition: "border-color 0.3s",
            }}
          >
            {/* Avatar */}
            <div
              style={{
                width: 80,
                height: 80,
                borderRadius: "50%",
                backgroundColor: color,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 28,
                fontWeight: 600,
                color: "#fff",
                border: isLastSpeaker
                  ? `3px solid ${color}`
                  : "3px solid transparent",
                boxShadow: isLastSpeaker
                  ? `0 0 20px ${color}60`
                  : "none",
                transition: "border-color 0.3s, box-shadow 0.3s",
                marginBottom: 12,
              }}
            >
              {agent.agent_name.charAt(0).toUpperCase()}
            </div>

            {/* Name */}
            <div
              style={{
                fontSize: 15,
                fontWeight: 500,
                color: "var(--room-text)",
                textAlign: "center" as const,
                marginBottom: 2,
              }}
            >
              {agent.agent_name}
            </div>

            {/* Model info */}
            <div
              style={{
                fontSize: 12,
                color: "var(--room-text-secondary)",
                marginBottom: 8,
              }}
            >
              {msgCount > 0 ? `${msgCount} message${msgCount !== 1 ? "s" : ""}` : "No messages yet"}
            </div>

            {/* Status */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                marginBottom: isCreator && isActive && onKick ? 12 : 0,
              }}
            >
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background:
                    agent.status === "active"
                      ? "var(--room-green)"
                      : agent.status === "kicked"
                      ? "var(--room-red)"
                      : "var(--room-orange)",
                  display: "inline-block",
                }}
              />
              <span style={{ fontSize: 12, color: "var(--room-text-secondary)" }}>
                {agent.status === "active"
                  ? "Connected"
                  : agent.status === "kicked"
                  ? "Kicked"
                  : agent.status === "left"
                  ? "Disconnected"
                  : "Connecting..."}
              </span>
            </div>

            {/* Kick button for creator */}
            {isCreator && isActive && onKick && (
              <button
                onClick={() => onKick(agent.agent_id)}
                disabled={kickingId === agent.agent_id}
                style={{
                  fontSize: 11,
                  color: "var(--room-red)",
                  background: "rgba(234, 67, 53, 0.1)",
                  border: "1px solid rgba(234, 67, 53, 0.2)",
                  borderRadius: 12,
                  padding: "4px 14px",
                  cursor: kickingId === agent.agent_id ? "default" : "pointer",
                  opacity: kickingId === agent.agent_id ? 0.5 : 1,
                  transition: "background 0.15s",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "rgba(234, 67, 53, 0.2)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "rgba(234, 67, 53, 0.1)";
                }}
              >
                {kickingId === agent.agent_id ? "Removing..." : "Remove"}
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
