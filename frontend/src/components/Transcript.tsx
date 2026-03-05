"use client";

import { useRef, useEffect, useCallback, useState } from "react";
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
  isLocked?: boolean;
  lockReason?: string;
  onCopyJoinUrl?: () => void;
  copiedJoinUrl?: boolean;
}

function humanizeReason(reason?: string): string {
  switch (reason) {
    case "max_messages_reached":
      return "Maximum message limit reached";
    case "creator_locked":
      return "Ended by host";
    case "inactivity_timeout":
      return "Ended due to inactivity";
    default:
      return reason || "This conversation has ended";
  }
}

export function Transcript({ messages, isLocked, lockReason, onCopyJoinUrl, copiedJoinUrl }: TranscriptProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);

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

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      style={{
        flex: 1,
        overflowY: "auto",
        padding: "20px 24px",
      }}
    >
      {/* Inline locked banner */}
      {isLocked && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            padding: "10px 16px",
            marginBottom: 20,
            borderRadius: 8,
            background: "rgba(234, 67, 53, 0.1)",
            border: "1px solid rgba(234, 67, 53, 0.2)",
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--room-red)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
          <span style={{ fontSize: 13, color: "var(--room-text-secondary)" }}>
            {humanizeReason(lockReason)}
          </span>
        </div>
      )}

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
          <p style={{ color: "var(--room-text-secondary)", fontSize: 14, marginBottom: 16 }}>
            Waiting for agents to start talking...
          </p>
          {onCopyJoinUrl && !isLocked && (
            <button
              onClick={onCopyJoinUrl}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                background: "var(--room-blue)",
                color: "#fff",
                border: "none",
                borderRadius: 24,
                padding: "10px 20px",
                fontSize: 13,
                fontWeight: 500,
                cursor: "pointer",
                transition: "opacity 0.15s",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.opacity = "0.85"; }}
              onMouseLeave={(e) => { e.currentTarget.style.opacity = "1"; }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="8.5" cy="7" r="4" />
                <line x1="20" y1="8" x2="20" y2="14" />
                <line x1="23" y1="11" x2="17" y2="11" />
              </svg>
              {copiedJoinUrl ? "Copied to clipboard!" : "Copy join link to invite agents"}
            </button>
          )}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {messages.map((msg, idx) => {
            const color = getAgentColor(msg.agent_id);
            const isSystemMessage =
              msg.agent_name === "system" || msg.agent_name === "System";
            const prevMsg = idx > 0 ? messages[idx - 1] : null;
            const isNewSpeaker = !prevMsg || prevMsg.agent_id !== msg.agent_id;

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
                  {isNewSpeaker && (
                    <div
                      style={{
                        display: "flex",
                        alignItems: "baseline",
                        gap: 8,
                        marginBottom: 4,
                      }}
                    >
                      <span style={{ color, fontSize: 13, fontWeight: 600 }}>
                        {msg.agent_name}
                      </span>
                      <span style={{ color: "var(--room-text-muted)", fontSize: 11 }}>
                        {formatTimestamp(msg.timestamp)}
                      </span>
                    </div>
                  )}
                  <div
                    style={{
                      background: "var(--room-surface-light)",
                      padding: "10px 14px",
                      borderRadius: isNewSpeaker ? "4px 12px 12px 12px" : "12px",
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
  );
}
