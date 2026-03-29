"use client";

import type { Agent, Decision, Message } from "@/lib/types";

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
  isCreator: boolean;
  kickingId: string | null;
  onKick?: (agentId: string) => void;
  onClose?: () => void;
  decisions?: Decision[];
}

export function AgentSidebar({
  agents,
  messages,
  isCreator,
  kickingId,
  onKick,
  onClose,
  decisions = [],
}: AgentSidebarProps) {
  const visibleAgents = agents.filter(
    (a) => a.status === "active" || a.status === "left" || a.status === "kicked"
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Panel header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "16px 20px",
          flexShrink: 0,
        }}
      >
        <span style={{ fontSize: 15, fontWeight: 600, color: "var(--room-text)" }}>
          Agents
        </span>
        {onClose && (
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              color: "var(--room-text-secondary)",
              cursor: "pointer",
              padding: 4,
              borderRadius: 20,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        )}
      </div>

      {/* Scrollable content: agents + decisions */}
      <div style={{ flex: 1, overflowY: "auto", padding: "0 12px 12px" }}>
        {/* Agent list */}
        {visibleAgents.length === 0 ? (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              padding: "40px 20px",
              gap: 8,
            }}
          >
            <div style={{ display: "flex", gap: 6 }}>
              {["#4285f4", "#ea4335", "#fbbc04"].map((color, i) => (
                <span
                  key={i}
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    background: color,
                    display: "inline-block",
                    animation: `pulse 1.4s ease-in-out ${i * 0.2}s infinite`,
                  }}
                />
              ))}
            </div>
            <p style={{ color: "var(--room-text-secondary)", fontSize: 13, textAlign: "center" }}>
              Waiting for agents...
            </p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <div
              style={{
                fontSize: 11,
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: "0.5px",
                color: "var(--room-text-muted)",
                padding: "8px 8px 6px",
              }}
            >
              In the call ({visibleAgents.filter(a => a.status === "active").length})
            </div>
            {visibleAgents.map((agent) => {
              const color = getAgentColor(agent.agent_id);
              const isActive = agent.status === "active";
              const msgCount = messages.filter(
                (m) => m.agent_id === agent.agent_id
              ).length;

              return (
                <div
                  key={agent.agent_id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "8px",
                    borderRadius: 8,
                    background: "transparent",
                    transition: "background 0.2s",
                  }}
                >
                  {/* Compact avatar */}
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: "50%",
                      backgroundColor: color,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 13,
                      fontWeight: 700,
                      color: "#fff",
                      flexShrink: 0,
                      position: "relative",
                    }}
                  >
                    {agent.agent_name.charAt(0).toUpperCase()}
                    {/* Status dot */}
                    <span
                      style={{
                        position: "absolute",
                        bottom: -1,
                        right: -1,
                        width: 10,
                        height: 10,
                        borderRadius: "50%",
                        background:
                          agent.status === "active"
                            ? "var(--room-green)"
                            : agent.status === "kicked"
                            ? "var(--room-red)"
                            : "var(--room-text-muted)",
                        border: "2px solid var(--room-bg)",
                      }}
                    />
                  </div>

                  {/* Name + info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 500,
                        color: isActive ? "var(--room-text)" : "var(--room-text-secondary)",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {agent.agent_name}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--room-text-muted)" }}>
                      {!isActive
                        ? agent.status === "kicked" ? "Removed" : "Left"
                        : msgCount > 0
                        ? `${msgCount} msg${msgCount !== 1 ? "s" : ""}`
                        : "Joined"}
                    </div>
                  </div>

                  {/* Kick button */}
                  {isCreator && isActive && onKick && (
                    <button
                      onClick={() => onKick(agent.agent_id)}
                      disabled={kickingId === agent.agent_id}
                      title="Remove from call"
                      style={{
                        background: "none",
                        border: "none",
                        color: "var(--room-text-muted)",
                        cursor: kickingId === agent.agent_id ? "default" : "pointer",
                        opacity: kickingId === agent.agent_id ? 0.4 : 1,
                        padding: 4,
                        borderRadius: 4,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                        transition: "color 0.15s",
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.color = "var(--room-red)"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.color = "var(--room-text-muted)"; }}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                        <circle cx="8.5" cy="7" r="4" />
                        <line x1="18" y1="8" x2="23" y2="13" />
                        <line x1="23" y1="8" x2="18" y2="13" />
                      </svg>
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Decisions section */}
        {decisions.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "8px 8px 10px",
                borderTop: "1px solid var(--room-border)",
              }}
            >
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: "0.5px",
                  color: "var(--room-text-muted)",
                }}
              >
                Decisions
              </span>
              <span style={{ fontSize: 11, color: "var(--room-text-muted)" }}>
                {decisions.filter((d) => d.status === "active").length} active
              </span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {decisions.map((decision) => (
                <div
                  key={decision.seq}
                  style={{
                    padding: "12px",
                    borderRadius: 8,
                    background: "var(--room-surface-light)",
                    opacity: decision.status === "struck" ? 0.5 : 1,
                    position: "relative",
                  }}
                >
                  <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                    {/* Status icon */}
                    <div style={{ flexShrink: 0, marginTop: 2 }}>
                      {decision.status === "active" ? (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="12" cy="12" r="10" stroke="var(--room-green)" />
                          <polyline points="9 12 11.5 14.5 16 10" stroke="var(--room-green)" />
                        </svg>
                      ) : (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="12" cy="12" r="10" stroke="var(--room-red)" />
                          <line x1="15" y1="9" x2="9" y2="15" stroke="var(--room-red)" />
                          <line x1="9" y1="9" x2="15" y2="15" stroke="var(--room-red)" />
                        </svg>
                      )}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: 13,
                          color: "var(--room-text)",
                          lineHeight: 1.45,
                          textDecoration: decision.status === "struck" ? "line-through" : "none",
                        }}
                      >
                        {decision.text}
                      </div>
                      <div style={{ fontSize: 11, color: "var(--room-text-muted)", marginTop: 6 }}>
                        by {decision.by}
                        {decision.struck_by && (
                          <span> &middot; struck by {decision.struck_by}</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
