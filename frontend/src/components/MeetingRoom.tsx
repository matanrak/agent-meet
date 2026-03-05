"use client";

import { useMemo, useState, useCallback } from "react";
import { useRoom } from "@/hooks/useRoom";
import { useCreator } from "@/hooks/useCreator";
import { Transcript } from "./Transcript";
import { AgentSidebar } from "./AgentSidebar";
import { AgentJoinUrl } from "./AgentJoinUrl";
import { RoomTimer } from "./RoomTimer";
import { LockedBanner } from "./LockedBanner";
import { LockConfirmDialog } from "./LockConfirmDialog";
import { getAgentJoinUrl, kickAgent, lockRoom } from "@/lib/api";

interface MeetingRoomProps {
  roomCode: string;
}

export function MeetingRoom({ roomCode }: MeetingRoomProps) {
  const { messages, agents, roomState, lockReason, firstMessageAt, isLoading } =
    useRoom(roomCode);
  const { isCreator, creatorToken } = useCreator(roomCode);

  const isLocked = roomState === "locked";

  // Creator controls state
  const [showLockDialog, setShowLockDialog] = useState(false);
  const [isLocking, setIsLocking] = useState(false);
  const [kickingId, setKickingId] = useState<string | null>(null);
  const [copiedJoinUrl, setCopiedJoinUrl] = useState(false);
  const [copiedCurl, setCopiedCurl] = useState(false);

  const handleKick = useCallback(
    async (agentId: string) => {
      if (!creatorToken) return;
      setKickingId(agentId);
      try {
        await kickAgent(roomCode, creatorToken, agentId);
      } catch (err) {
        console.error("Failed to kick agent:", err);
      } finally {
        setKickingId(null);
      }
    },
    [roomCode, creatorToken]
  );

  const handleLock = useCallback(async () => {
    if (!creatorToken) return;
    setIsLocking(true);
    try {
      await lockRoom(roomCode, creatorToken);
      setShowLockDialog(false);
    } catch (err) {
      console.error("Failed to lock room:", err);
    } finally {
      setIsLocking(false);
    }
  }, [roomCode, creatorToken]);

  // Determine last speaker
  const lastSpeakerId = useMemo(() => {
    if (messages.length === 0) return undefined;
    return messages[messages.length - 1]?.agent_id;
  }, [messages]);

  const activeAgentCount = agents.filter((a) => a.status === "active").length;

  const joinUrl = getAgentJoinUrl(roomCode);

  const handleCopyJoinUrl = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(joinUrl);
      setCopiedJoinUrl(true);
      setTimeout(() => setCopiedJoinUrl(false), 2000);
    } catch {}
  }, [joinUrl]);

  const handleCopyCurl = useCallback(async () => {
    const curl = `curl -X POST ${joinUrl} \\\n  -H "Content-Type: application/json" \\\n  -d '{"agent_name": "my-agent", "message": "Hello"}'`;
    try {
      await navigator.clipboard.writeText(curl);
      setCopiedCurl(true);
      setTimeout(() => setCopiedCurl(false), 2000);
    } catch {}
  }, [joinUrl]);

  if (isLoading) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "100vh",
          background: "var(--room-bg)",
        }}
      >
        <div style={{ textAlign: "center" }}>
          <div style={{ display: "flex", gap: 6, justifyContent: "center", marginBottom: 12 }}>
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
          <p style={{ color: "var(--room-text-secondary)", fontSize: 14 }}>
            Loading room...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        background: "var(--room-bg)",
        color: "var(--room-text)",
      }}
    >
      {/* ===== TOP BAR ===== */}
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "12px 20px",
          flexShrink: 0,
          borderBottom: "1px solid var(--room-border)",
        }}
      >
        {/* Left: Logo + Room code */}
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 18 }}>
            <span style={{ fontWeight: 400, color: "var(--room-text)" }}>
              Agent
            </span>
            <span style={{ fontWeight: 600, color: "var(--room-text)" }}>
              Meet
            </span>
          </span>
          <span
            style={{
              color: "var(--room-text-muted)",
              fontSize: 18,
              fontWeight: 200,
            }}
          >
            |
          </span>
          <span
            style={{
              fontFamily: "monospace",
              color: "var(--room-text-secondary)",
              fontSize: 14,
              letterSpacing: "0.5px",
            }}
          >
            {roomCode}
          </span>
        </div>

        {/* Right: Timer + agent count */}
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <RoomTimer firstMessageAt={firstMessageAt} />
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              background: "var(--room-surface)",
              borderRadius: 16,
              padding: "4px 12px",
            }}
          >
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background:
                  activeAgentCount > 0
                    ? "var(--room-green)"
                    : "var(--room-text-muted)",
                display: "inline-block",
              }}
            />
            <span
              style={{
                fontSize: 13,
                color: "var(--room-text-secondary)",
              }}
            >
              {activeAgentCount} agent{activeAgentCount !== 1 ? "s" : ""}
            </span>
          </div>
        </div>
      </header>

      {/* ===== LOCKED BANNER ===== */}
      {isLocked && (
        <div style={{ padding: "12px 20px 0", flexShrink: 0 }}>
          <LockedBanner lockReason={lockReason} />
        </div>
      )}

      {/* ===== MAIN CONTENT (3 columns) ===== */}
      <div
        style={{
          display: "flex",
          flex: 1,
          minHeight: 0,
          overflow: "hidden",
        }}
      >
        {/* LEFT SIDEBAR - Agent panels */}
        <aside
          style={{
            width: 220,
            flexShrink: 0,
            overflowY: "auto",
            padding: "8px 10px",
            borderRight: "1px solid var(--room-border)",
          }}
        >
          <AgentSidebar
            agents={agents}
            messages={messages}
            lastSpeakerId={lastSpeakerId}
            isCreator={isCreator && !isLocked}
            kickingId={kickingId}
            onKick={isCreator && creatorToken && !isLocked ? handleKick : undefined}
          />
        </aside>

        {/* CENTER - Transcript */}
        <main
          style={{
            flex: 1,
            minWidth: 0,
            display: "flex",
            flexDirection: "column",
          }}
        >
          <Transcript messages={messages} roomCode={roomCode} />
        </main>

        {/* RIGHT SIDEBAR - Info panels */}
        <aside
          style={{
            width: 260,
            flexShrink: 0,
            overflowY: "auto",
            padding: 16,
            borderLeft: "1px solid var(--room-border)",
            display: "flex",
            flexDirection: "column",
            gap: 12,
          }}
        >
          {/* Call Info card */}
          <InfoCard title="Call info">
            {!isLocked && (
              <AgentJoinUrl roomCode={roomCode} isLocked={isLocked} />
            )}
            <InfoRow
              label="API Endpoint"
              value={`POST /api/v1/${roomCode}/agent-join`}
              mono
            />
            <InfoRow label="Room State" value={isLocked ? "Locked" : "Active"} />
          </InfoCard>

          {/* Quick Connect card */}
          {!isLocked && (
            <InfoCard title="Quick connect">
              <div style={{ marginBottom: 12 }}>
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 600,
                    textTransform: "uppercase",
                    letterSpacing: "0.5px",
                    color: "var(--room-text-muted)",
                    display: "block",
                    marginBottom: 6,
                  }}
                >
                  HTTP API
                </span>
                <div
                  style={{
                    background: "var(--room-surface-light)",
                    borderRadius: 8,
                    padding: "8px 10px",
                    position: "relative",
                  }}
                >
                  <code
                    style={{
                      fontSize: 10,
                      fontFamily: "monospace",
                      color: "var(--room-text-secondary)",
                      lineHeight: 1.5,
                      display: "block",
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-all",
                    }}
                  >
                    {`curl -X POST ${joinUrl} \\\n  -H "Content-Type: application/json" \\\n  -d '{"agent_name":"my-agent"}'`}
                  </code>
                  <button
                    onClick={handleCopyCurl}
                    style={{
                      position: "absolute",
                      top: 6,
                      right: 6,
                      fontSize: 10,
                      color: copiedCurl
                        ? "var(--room-green)"
                        : "var(--room-primary)",
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                    }}
                  >
                    {copiedCurl ? "Copied!" : "Copy"}
                  </button>
                </div>
              </div>

              <div>
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 600,
                    textTransform: "uppercase",
                    letterSpacing: "0.5px",
                    color: "var(--room-text-muted)",
                    display: "block",
                    marginBottom: 6,
                  }}
                >
                  Join Link
                </span>
                <button
                  onClick={handleCopyJoinUrl}
                  style={{
                    width: "100%",
                    background: "var(--room-surface-light)",
                    border: "none",
                    borderRadius: 8,
                    padding: "8px 10px",
                    color: copiedJoinUrl
                      ? "var(--room-green)"
                      : "var(--room-primary)",
                    fontFamily: "monospace",
                    fontSize: 11,
                    cursor: "pointer",
                    textAlign: "left",
                    wordBreak: "break-all",
                  }}
                >
                  {copiedJoinUrl ? "Copied to clipboard!" : joinUrl}
                </button>
              </div>
            </InfoCard>
          )}

          {/* Guardrails card */}
          <InfoCard title="Guardrails">
            <GuardrailRow label="Auto-pause" value="Enabled" />
            <GuardrailRow label="Transcript visible" value="Yes" />
            <GuardrailRow label="Auto-summary" value="On lock" />
            <GuardrailRow
              label="Room state"
              value={isLocked ? "Locked" : "Active"}
              color={isLocked ? "var(--room-red)" : "var(--room-green)"}
            />
          </InfoCard>
        </aside>
      </div>

      {/* ===== BOTTOM CONTROL BAR ===== */}
      <footer
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "12px 20px",
          background: "var(--room-surface)",
          borderTop: "1px solid var(--room-border)",
          flexShrink: 0,
          gap: 12,
        }}
      >
        {/* Circular control buttons */}
        <ControlButton
          icon={
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
              <polyline points="10 17 15 12 10 7" />
              <line x1="15" y1="12" x2="3" y2="12" />
            </svg>
          }
          label="Share"
          onClick={handleCopyJoinUrl}
        />
        <ControlButton
          icon={
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
            </svg>
          }
          label="Copy URL"
          onClick={handleCopyJoinUrl}
        />
        <ControlButton
          icon={
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          }
          label="Settings"
        />

        {/* End call button */}
        {isCreator && creatorToken && !isLocked && (
          <button
            onClick={() => setShowLockDialog(true)}
            style={{
              background: "var(--room-red)",
              color: "#fff",
              border: "none",
              borderRadius: 24,
              padding: "12px 32px",
              fontSize: 14,
              fontWeight: 500,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 8,
              transition: "opacity 0.15s",
              marginLeft: 8,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.opacity = "0.9";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.opacity = "1";
            }}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7 2 2 0 0 1 1.72 2v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91" />
              <line x1="23" y1="1" x2="1" y2="23" />
            </svg>
            End call
          </button>
        )}
      </footer>

      {/* Lock confirm dialog */}
      <LockConfirmDialog
        isOpen={showLockDialog}
        isLocking={isLocking}
        onCancel={() => setShowLockDialog(false)}
        onConfirm={handleLock}
      />
    </div>
  );
}

/* ===== Helper sub-components ===== */

function InfoCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        background: "var(--room-surface)",
        borderRadius: 12,
        padding: 16,
      }}
    >
      <h3
        style={{
          fontSize: 13,
          fontWeight: 600,
          color: "var(--room-text)",
          margin: "0 0 12px 0",
        }}
      >
        {title}
      </h3>
      {children}
    </div>
  );
}

function InfoRow({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div style={{ marginBottom: 8 }}>
      <span
        style={{
          fontSize: 10,
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: "0.5px",
          color: "var(--room-text-muted)",
          display: "block",
          marginBottom: 4,
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontSize: 12,
          color: "var(--room-text-secondary)",
          fontFamily: mono ? "monospace" : "inherit",
          wordBreak: "break-all",
        }}
      >
        {value}
      </span>
    </div>
  );
}

function GuardrailRow({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "4px 0",
      }}
    >
      <span style={{ fontSize: 12, color: "var(--room-text-secondary)" }}>
        {label}
      </span>
      <span
        style={{
          fontSize: 12,
          color: color || "var(--room-text-muted)",
          fontWeight: 500,
        }}
      >
        {value}
      </span>
    </div>
  );
}

function ControlButton({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      style={{
        width: 48,
        height: 48,
        borderRadius: "50%",
        background: "var(--room-surface-light)",
        color: "var(--room-text)",
        border: "none",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        transition: "background 0.15s",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = "#4e5154";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "var(--room-surface-light)";
      }}
    >
      {icon}
    </button>
  );
}
