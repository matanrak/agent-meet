"use client";

import { useRef, useEffect, useCallback, useState } from "react";
import type { Message } from "@/lib/types";
import { getAgentJoinUrl } from "@/lib/api";

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

function formatTimestamp(timestamp: string): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

interface TranscriptProps {
  messages: Message[];
  roomCode: string;
}

export function Transcript({ messages, roomCode }: TranscriptProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const [copiedTranscript, setCopiedTranscript] = useState(false);
  const [copiedApi, setCopiedApi] = useState(false);

  const handleScroll = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    setAutoScroll(distanceFromBottom < 100);
  }, []);

  useEffect(() => {
    if (autoScroll && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [messages, autoScroll]);

  const handleExportTranscript = useCallback(async () => {
    const lines = messages.map(
      (m) =>
        `[${formatTimestamp(m.timestamp)}] ${m.agent_name}: ${m.content}`
    );
    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      setCopiedTranscript(true);
      setTimeout(() => setCopiedTranscript(false), 2000);
    } catch {
      // fallback
    }
  }, [messages]);

  const handleCopyApiContract = useCallback(async () => {
    const url = getAgentJoinUrl(roomCode);
    const contract = `POST ${url}\nContent-Type: application/json\n\n{\n  "agent_name": "my-agent",\n  "message": "Hello from my agent"\n}`;
    try {
      await navigator.clipboard.writeText(contract);
      setCopiedApi(true);
      setTimeout(() => setCopiedApi(false), 2000);
    } catch {
      // fallback
    }
  }, [roomCode]);

  const headerButtonStyle: React.CSSProperties = {
    background: "var(--room-surface-light)",
    color: "var(--room-text-secondary)",
    border: "none",
    borderRadius: 16,
    padding: "6px 14px",
    fontSize: 12,
    cursor: "pointer",
    transition: "color 0.15s",
    whiteSpace: "nowrap",
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        minHeight: 0,
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "14px 20px",
          borderBottom: "1px solid var(--room-border)",
          flexShrink: 0,
        }}
      >
        <h2
          style={{
            fontSize: 15,
            fontWeight: 600,
            color: "var(--room-text)",
            margin: 0,
          }}
        >
          Conversation
        </h2>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={handleExportTranscript}
            style={headerButtonStyle}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = "var(--room-text)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = "var(--room-text-secondary)";
            }}
          >
            {copiedTranscript ? "Copied!" : "Export transcript"}
          </button>
          <button
            onClick={handleCopyApiContract}
            style={headerButtonStyle}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = "var(--room-text)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = "var(--room-text-secondary)";
            }}
          >
            {copiedApi ? "Copied!" : "Copy API contract"}
          </button>
        </div>
      </div>

      {/* Messages */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "16px 20px",
        }}
      >
        {messages.length === 0 ? (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              height: "100%",
              gap: 8,
            }}
          >
            {/* Thinking indicator */}
            <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background: "var(--room-green)",
                    display: "inline-block",
                    animation: `pulse 1.4s ease-in-out ${i * 0.2}s infinite`,
                  }}
                />
              ))}
            </div>
            <p
              style={{
                color: "var(--room-text-secondary)",
                fontSize: 14,
              }}
            >
              Waiting for agents to join...
            </p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {messages.map((msg, idx) => {
              const color = getAgentColor(msg.agent_id);
              const isSystemMessage =
                msg.agent_name === "system" || msg.agent_name === "System";

              // Check if this is a new speaker group
              const prevMsg = idx > 0 ? messages[idx - 1] : null;
              const isNewSpeaker =
                !prevMsg || prevMsg.agent_id !== msg.agent_id;

              if (isSystemMessage) {
                return (
                  <div
                    key={msg.message_id}
                    style={{
                      display: "flex",
                      justifyContent: "center",
                      animation: "fadeIn 0.3s ease-out",
                    }}
                  >
                    <div
                      style={{
                        background: "rgba(52, 168, 83, 0.13)",
                        color: "var(--room-green)",
                        borderRadius: 20,
                        padding: "6px 16px",
                        fontSize: 12,
                      }}
                    >
                      {msg.content}
                    </div>
                  </div>
                );
              }

              return (
                <div
                  key={msg.message_id}
                  style={{
                    display: "flex",
                    gap: 12,
                    alignItems: "flex-start",
                    marginTop: !isNewSpeaker ? -8 : 0,
                    animation: "fadeIn 0.3s ease-out",
                  }}
                >
                  {/* Avatar - only show for new speaker */}
                  {isNewSpeaker ? (
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
                        marginTop: 2,
                      }}
                    >
                      {msg.agent_name.charAt(0).toUpperCase()}
                    </div>
                  ) : (
                    <div style={{ width: 32, flexShrink: 0 }} />
                  )}

                  <div style={{ minWidth: 0, flex: 1 }}>
                    {/* Name + timestamp - only for new speaker */}
                    {isNewSpeaker && (
                      <div
                        style={{
                          display: "flex",
                          alignItems: "baseline",
                          gap: 8,
                          marginBottom: 4,
                        }}
                      >
                        <span
                          style={{
                            color,
                            fontSize: 13,
                            fontWeight: 600,
                          }}
                        >
                          {msg.agent_name}
                        </span>
                        <span
                          style={{
                            color: "var(--room-text-muted)",
                            fontSize: 11,
                          }}
                        >
                          {formatTimestamp(msg.timestamp)}
                        </span>
                      </div>
                    )}

                    {/* Message bubble */}
                    <div
                      style={{
                        background: "var(--room-surface-light)",
                        padding: "10px 14px",
                        borderRadius: isNewSpeaker
                          ? "4px 12px 12px 12px"
                          : "12px",
                        fontSize: 14,
                        color: "var(--room-text)",
                        lineHeight: 1.5,
                        whiteSpace: "pre-wrap",
                        wordBreak: "break-word",
                      }}
                    >
                      {msg.content}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
