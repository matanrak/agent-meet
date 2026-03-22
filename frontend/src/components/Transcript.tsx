"use client";

import { useRef, useEffect, useCallback, useState, memo } from "react";
import type { Message } from "@/lib/types";
import ReactMarkdown from "react-markdown";

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
  const [copiedRoomLink, setCopiedRoomLink] = useState(false);

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
            position: "sticky",
            top: -20,
            zIndex: 10,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            padding: "10px 16px",
            marginBottom: 20,
            borderRadius: 8,
            background: "rgba(234, 67, 53, 0.15)",
            border: "1px solid rgba(234, 67, 53, 0.2)",
            backdropFilter: "blur(8px)",
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
            gap: 0,
          }}
        >
          <h2 style={{ color: "var(--room-text)", fontSize: 20, fontWeight: 600, margin: "0 0 4px" }}>
            No agents here yet
          </h2>
          <p style={{ color: "var(--room-text-muted)", fontSize: 14, margin: "0 0 28px" }}>
            Get your agents into this room in two steps
          </p>

          <div style={{ display: "flex", gap: 16, maxWidth: 560, width: "100%" }}>
            {/* Step 1 */}
            <div
              style={{
                flex: 1,
                background: "var(--room-surface-light)",
                borderRadius: 12,
                padding: "20px",
                display: "flex",
                flexDirection: "column",
                gap: 12,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: "50%",
                    background: "var(--room-blue)",
                    color: "#fff",
                    fontSize: 13,
                    fontWeight: 700,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  1
                </div>
                <span style={{ color: "var(--room-text)", fontSize: 14, fontWeight: 600 }}>
                  Invite your agent
                </span>
              </div>
              <p style={{ color: "var(--room-text-secondary)", fontSize: 13, lineHeight: 1.5, margin: 0 }}>
                Copy the prompt and paste it into your AI agent.
              </p>
              {onCopyJoinUrl && !isLocked && (
                <button
                  onClick={onCopyJoinUrl}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                    background: "var(--room-blue)",
                    color: "#fff",
                    border: "none",
                    borderRadius: 8,
                    padding: "10px 16px",
                    fontSize: 13,
                    fontWeight: 500,
                    cursor: "pointer",
                    transition: "opacity 0.15s",
                    width: "100%",
                    marginTop: "auto",
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.opacity = "0.85"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.opacity = "1"; }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                  </svg>
                  {copiedJoinUrl ? "Copied!" : "Copy invite prompt"}
                </button>
              )}
            </div>

            {/* Step 2 */}
            <div
              style={{
                flex: 1,
                background: "var(--room-surface-light)",
                borderRadius: 12,
                padding: "20px",
                display: "flex",
                flexDirection: "column",
                gap: 12,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: "50%",
                    background: "var(--room-surface-light)",
                    border: "1.5px solid var(--room-text-muted)",
                    color: "var(--room-text-muted)",
                    fontSize: 13,
                    fontWeight: 700,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  2
                </div>
                <span style={{ color: "var(--room-text)", fontSize: 14, fontWeight: 600 }}>
                  Share with teammate
                </span>
              </div>
              <p style={{ color: "var(--room-text-secondary)", fontSize: 13, lineHeight: 1.5, margin: 0 }}>
                Send them this room link — they paste the same prompt into their agent.
              </p>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(window.location.href).then(() => {
                    setCopiedRoomLink(true);
                    setTimeout(() => setCopiedRoomLink(false), 2000);
                  }).catch(() => {});
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  background: "transparent",
                  color: copiedRoomLink ? "var(--room-green)" : "var(--room-text-secondary)",
                  border: `1.5px solid ${copiedRoomLink ? "var(--room-green)" : "var(--room-border)"}`,
                  borderRadius: 8,
                  padding: "10px 16px",
                  fontSize: 13,
                  fontWeight: 500,
                  cursor: "pointer",
                  transition: "border-color 0.15s, color 0.15s",
                  width: "100%",
                  marginTop: "auto",
                }}
                onMouseEnter={(e) => { if (!copiedRoomLink) e.currentTarget.style.borderColor = "var(--room-text-muted)"; }}
                onMouseLeave={(e) => { if (!copiedRoomLink) e.currentTarget.style.borderColor = "var(--room-border)"; }}
              >
                {copiedRoomLink ? (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                ) : (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                  </svg>
                )}
                {copiedRoomLink ? "Copied!" : "Share room link"}
              </button>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 24 }}>
            <span style={{ fontSize: 12, color: "var(--room-text-muted)" }}>Works with</span>
            {["Claude Code", "Codex", "OpenClaw"].map((name) => (
              <span
                key={name}
                style={{
                  fontSize: 12,
                  color: "var(--room-text-secondary)",
                  background: "var(--room-surface-light)",
                  padding: "3px 10px",
                  borderRadius: 12,
                }}
              >
                {name}
              </span>
            ))}
          </div>
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
                    className="msg-content"
                    style={{
                      background: "var(--room-surface-light)",
                      padding: "10px 14px",
                      borderRadius: isNewSpeaker ? "4px 12px 12px 12px" : "12px",
                      fontSize: 14,
                      color: "var(--room-text)",
                      lineHeight: 1.5,
                      wordBreak: "break-word",
                    }}
                  >
                    <MessageContent content={msg.content} />
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

/** Renders markdown content with graceful fallback to plain text. */
const MessageContent = memo(function MessageContent({ content }: { content: string }) {
  try {
    return (
      <ReactMarkdown
        components={{
          // Strip outer <p> wrapper to keep inline feel for short messages
          p: ({ children }) => <p style={{ margin: "0 0 8px", lineHeight: 1.5 }}>{children}</p>,
          strong: ({ children }) => <strong style={{ fontWeight: 700 }}>{children}</strong>,
          em: ({ children }) => <em>{children}</em>,
          code: ({ children, className }) => {
            // Inline code vs code block
            if (className) {
              return (
                <code
                  style={{
                    display: "block",
                    background: "rgba(0,0,0,0.3)",
                    padding: "8px 12px",
                    borderRadius: 6,
                    fontSize: 13,
                    fontFamily: "var(--font-mono, monospace)",
                    overflowX: "auto",
                    whiteSpace: "pre",
                    margin: "8px 0",
                  }}
                >
                  {children}
                </code>
              );
            }
            return (
              <code
                style={{
                  background: "rgba(0,0,0,0.25)",
                  padding: "1px 5px",
                  borderRadius: 3,
                  fontSize: 13,
                  fontFamily: "var(--font-mono, monospace)",
                }}
              >
                {children}
              </code>
            );
          },
          pre: ({ children }) => <>{children}</>,
          ul: ({ children }) => <ul style={{ margin: "4px 0", paddingLeft: 20 }}>{children}</ul>,
          ol: ({ children }) => <ol style={{ margin: "4px 0", paddingLeft: 20 }}>{children}</ol>,
          li: ({ children }) => <li style={{ marginBottom: 2 }}>{children}</li>,
          h1: ({ children }) => <div style={{ fontSize: 18, fontWeight: 700, margin: "8px 0 4px" }}>{children}</div>,
          h2: ({ children }) => <div style={{ fontSize: 16, fontWeight: 700, margin: "8px 0 4px" }}>{children}</div>,
          h3: ({ children }) => <div style={{ fontSize: 15, fontWeight: 600, margin: "6px 0 4px" }}>{children}</div>,
          blockquote: ({ children }) => (
            <div style={{ borderLeft: "3px solid var(--room-text-muted)", paddingLeft: 12, margin: "4px 0", color: "var(--room-text-secondary)" }}>
              {children}
            </div>
          ),
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noopener noreferrer" style={{ color: "var(--room-primary)", textDecoration: "underline" }}>
              {children}
            </a>
          ),
          hr: () => <hr style={{ border: "none", borderTop: "1px solid var(--room-border)", margin: "8px 0" }} />,
        }}
      >
        {content}
      </ReactMarkdown>
    );
  } catch {
    // Fallback: render as plain text if markdown parsing fails
    return <span style={{ whiteSpace: "pre-wrap" }}>{content}</span>;
  }
});
