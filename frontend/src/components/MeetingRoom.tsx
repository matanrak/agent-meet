"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useRoom } from "@/hooks/useRoom";
import { useCreator } from "@/hooks/useCreator";
import { useIsMobile } from "@/hooks/useIsMobile";
import { Transcript } from "./Transcript";
import { AgentSidebar } from "./AgentSidebar";
import { LockConfirmDialog } from "./LockConfirmDialog";
import { getAgentJoinUrl, kickAgent, lockRoom } from "@/lib/api";

interface MeetingRoomProps {
  roomCode: string;
}

type SidePanel = "people" | "info" | null;

export function MeetingRoom({ roomCode }: MeetingRoomProps) {
  const { messages, agents, roomState, lockReason, firstMessageAt, isLoading } =
    useRoom(roomCode);
  const { isCreator, creatorToken } = useCreator(roomCode);
  const isMobile = useIsMobile();

  const isLocked = roomState === "locked";

  const [showLockDialog, setShowLockDialog] = useState(false);
  const [isLocking, setIsLocking] = useState(false);
  const [kickingId, setKickingId] = useState<string | null>(null);
  const [sidePanel, setSidePanel] = useState<SidePanel>("people");
  const [copiedJoinUrl, setCopiedJoinUrl] = useState(false);
  const [copiedTranscript, setCopiedTranscript] = useState(false);
  const [showInvitePopover, setShowInvitePopover] = useState(false);
  const inviteButtonRef = useRef<HTMLButtonElement>(null);

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

  const activeAgentCount = agents.filter((a) => a.status === "active").length;

  const joinUrl = getAgentJoinUrl(roomCode);

  const handleCopyJoinUrl = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(joinUrl);
      setCopiedJoinUrl(true);
      setTimeout(() => setCopiedJoinUrl(false), 2000);
    } catch {}
  }, [joinUrl]);

  const handleExportTranscript = useCallback(async () => {
    const lines = messages.map(
      (m) => {
        const ts = new Date(m.timestamp).toLocaleTimeString("en-US", {
          hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
        });
        return `[${ts}] ${m.agent_name}: ${m.content}`;
      }
    );
    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      setCopiedTranscript(true);
      setTimeout(() => setCopiedTranscript(false), 2000);
    } catch {}
  }, [messages]);

  const togglePanel = useCallback((panel: "people" | "info") => {
    setSidePanel((prev) => (prev === panel ? null : panel));
  }, []);

  // Elapsed timer
  const elapsed = useElapsed(firstMessageAt);

  if (isLoading) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "100vh",
          background: "var(--room-bg)",
        }}
      >
        <div style={{ textAlign: "center" }}>
          <div style={{ display: "flex", gap: 6, justifyContent: "center", marginBottom: 12 }}>
            {["#4285f4", "#ea4335", "#fbbc04"].map((color, i) => (
              <span
                key={i}
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: color,
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

  // ===== MOBILE LAYOUT =====
  if (isMobile) {
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
        {/* Main area — transcript or side panel */}
        <div style={{ flex: 1, minHeight: 0, overflow: "hidden", display: "flex", flexDirection: "column" }}>
          {sidePanel === "people" ? (
            <AgentSidebar
              agents={agents}
              messages={messages}
              isCreator={isCreator && !isLocked}
              kickingId={kickingId}
              onKick={isCreator && creatorToken && !isLocked ? handleKick : undefined}
              onClose={() => setSidePanel(null)}
            />
          ) : sidePanel === "info" ? (
            <InfoPanel
              roomCode={roomCode}
              joinUrl={joinUrl}
              isLocked={isLocked}
              copiedJoinUrl={copiedJoinUrl}
              onCopyJoinUrl={handleCopyJoinUrl}
              onClose={() => setSidePanel(null)}
            />
          ) : (
            <Transcript messages={messages} isLocked={isLocked} lockReason={lockReason} onCopyJoinUrl={handleCopyJoinUrl} copiedJoinUrl={copiedJoinUrl} />
          )}
        </div>

        {/* Bottom bar */}
        <footer
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "8px 12px",
            background: "var(--room-surface)",
            borderTop: "1px solid var(--room-border)",
            flexShrink: 0,
          }}
        >
          {/* Left: timer + code */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
            {elapsed && (
              <span style={{ color: "var(--room-text-secondary)", fontFamily: "var(--font-mono, monospace)", fontSize: 12 }}>
                {elapsed}
              </span>
            )}
            <span style={{ color: "var(--room-text-muted)", fontSize: 11 }}>|</span>
            <span
              style={{
                fontFamily: "var(--font-mono, monospace)",
                color: "var(--room-text-muted)",
                fontSize: 11,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {roomCode}
            </span>
          </div>

          {/* Center: invite + end call */}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ position: "relative" }}>
              <button
                data-invite-toggle
                onClick={() => setShowInvitePopover((v) => !v)}
                style={{
                  background: "var(--room-blue)",
                  color: "#fff",
                  border: "none",
                  borderRadius: 24,
                  padding: "6px 14px",
                  fontSize: 12,
                  fontWeight: 500,
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                }}
              >
                Invite
              </button>
              {showInvitePopover && (
                <InvitePopover
                  joinUrl={joinUrl}
                  onClose={() => setShowInvitePopover(false)}
                  copiedJoinUrl={copiedJoinUrl}
                  onCopy={handleCopyJoinUrl}
                  mobile
                />
              )}
            </div>
            {isCreator && creatorToken && !isLocked && (
              <button
                onClick={() => setShowLockDialog(true)}
                style={{
                  background: "var(--room-red)",
                  color: "#fff",
                  border: "none",
                  borderRadius: 24,
                  width: 40,
                  height: 40,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  flexShrink: 0,
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7 2 2 0 0 1 1.72 2v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91" />
                  <line x1="23" y1="1" x2="1" y2="23" />
                </svg>
              </button>
            )}
          </div>

          {/* Right: toggle icons */}
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <BottomIcon
              active={sidePanel === "people"}
              badge={activeAgentCount > 0 ? activeAgentCount : undefined}
              onClick={() => togglePanel("people")}
              title="Agents"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            </BottomIcon>
            <BottomIcon
              active={sidePanel === "info"}
              onClick={() => togglePanel("info")}
              title="Info"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="16" x2="12" y2="12" />
                <line x1="12" y1="8" x2="12.01" y2="8" />
              </svg>
            </BottomIcon>
          </div>
        </footer>

        <LockConfirmDialog
          isOpen={showLockDialog}
          isLocking={isLocking}
          onCancel={() => setShowLockDialog(false)}
          onConfirm={handleLock}
        />
      </div>
    );
  }

  // ===== DESKTOP LAYOUT =====
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
      {/* Main area: stage + optional side panel */}
      <div style={{ flex: 1, display: "flex", minHeight: 0, padding: "8px 8px 0" }}>
        {/* Stage — the transcript area in a rounded container */}
        <div
          style={{
            flex: 1,
            minWidth: 0,
            borderRadius: 12,
            background: "var(--room-surface)",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          <Transcript messages={messages} isLocked={isLocked} lockReason={lockReason} onCopyJoinUrl={handleCopyJoinUrl} copiedJoinUrl={copiedJoinUrl} />
        </div>

        {/* Side panel (togglable) */}
        {sidePanel && (
          <div
            style={{
              width: 320,
              flexShrink: 0,
              marginLeft: 8,
              borderRadius: 12,
              background: "var(--room-surface)",
              overflow: "hidden",
              display: "flex",
              flexDirection: "column",
              animation: "slideIn 0.15s ease-out",
            }}
          >
            {sidePanel === "people" ? (
              <AgentSidebar
                agents={agents}
                messages={messages}
                  isCreator={isCreator && !isLocked}
                kickingId={kickingId}
                onKick={isCreator && creatorToken && !isLocked ? handleKick : undefined}
                onClose={() => setSidePanel(null)}
              />
            ) : (
              <InfoPanel
                roomCode={roomCode}
                joinUrl={joinUrl}
                isLocked={isLocked}
                copiedJoinUrl={copiedJoinUrl}
                onCopyJoinUrl={handleCopyJoinUrl}
                onClose={() => setSidePanel(null)}
              />
            )}
          </div>
        )}
      </div>

      {/* Bottom control bar — Google Meet style */}
      <footer
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "10px 16px",
          flexShrink: 0,
        }}
      >
        {/* Left: timer + code */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1 }}>
          {elapsed && (
            <>
              <span style={{ color: "var(--room-text-secondary)", fontFamily: "var(--font-mono, monospace)", fontSize: 13 }}>
                {elapsed}
              </span>
              <span style={{ color: "var(--room-text-muted)", fontSize: 13, fontWeight: 200 }}>|</span>
            </>
          )}
          <span style={{ fontFamily: "var(--font-mono, monospace)", color: "var(--room-text-muted)", fontSize: 13 }}>
            {roomCode}
          </span>
        </div>

        {/* Center: controls */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, position: "relative" }}>
          <div style={{ position: "relative" }}>
            <button
              ref={inviteButtonRef}
              data-invite-toggle
              onClick={() => setShowInvitePopover((v) => !v)}
              style={{
                background: "var(--room-blue)",
                color: "#fff",
                border: "none",
                borderRadius: 24,
                padding: "8px 16px",
                fontSize: 13,
                fontWeight: 500,
                cursor: "pointer",
                transition: "opacity 0.15s",
                whiteSpace: "nowrap",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.opacity = "0.85"; }}
              onMouseLeave={(e) => { e.currentTarget.style.opacity = "1"; }}
            >
              Invite Agent
            </button>
            {showInvitePopover && (
              <InvitePopover
                joinUrl={joinUrl}
                onClose={() => setShowInvitePopover(false)}
                copiedJoinUrl={copiedJoinUrl}
                onCopy={handleCopyJoinUrl}
              />
            )}
          </div>
          <BottomIcon
            onClick={handleExportTranscript}
            title={copiedTranscript ? "Copied!" : "Export transcript"}
          >
            {copiedTranscript ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--room-green)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
              </svg>
            )}
          </BottomIcon>
          {isCreator && creatorToken && !isLocked && (
            <button
              onClick={() => setShowLockDialog(true)}
              style={{
                background: "var(--room-red)",
                color: "#fff",
                border: "none",
                borderRadius: 24,
                width: 48,
                height: 48,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                transition: "opacity 0.15s",
                marginLeft: 4,
              }}
              onMouseEnter={(e) => { e.currentTarget.style.opacity = "0.85"; }}
              onMouseLeave={(e) => { e.currentTarget.style.opacity = "1"; }}
              title="End call"
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7 2 2 0 0 1 1.72 2v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91" />
                <line x1="23" y1="1" x2="1" y2="23" />
              </svg>
            </button>
          )}
        </div>

        {/* Right: panel toggles */}
        <div style={{ display: "flex", alignItems: "center", gap: 4, flex: 1, justifyContent: "flex-end" }}>
          <BottomIcon
            active={sidePanel === "info"}
            onClick={() => togglePanel("info")}
            title="Meeting details"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="16" x2="12" y2="12" />
              <line x1="12" y1="8" x2="12.01" y2="8" />
            </svg>
          </BottomIcon>
          <BottomIcon
            active={sidePanel === "people"}
            badge={activeAgentCount > 0 ? activeAgentCount : undefined}
            onClick={() => togglePanel("people")}
            title="Agents"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          </BottomIcon>
        </div>
      </footer>

      <LockConfirmDialog
        isOpen={showLockDialog}
        isLocking={isLocking}
        onCancel={() => setShowLockDialog(false)}
        onConfirm={handleLock}
      />
    </div>
  );
}

/* ===== Sub-components ===== */

function InvitePopover({
  joinUrl,
  onClose,
  copiedJoinUrl,
  onCopy,
  mobile,
}: {
  joinUrl: string;
  onClose: () => void;
  copiedJoinUrl: boolean;
  onCopy: () => void;
  mobile?: boolean;
}) {
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node) &&
        !(e.target as HTMLElement).closest?.("[data-invite-toggle]")
      ) {
        onClose();
      }
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [onClose]);

  return (
    <div
      ref={popoverRef}
      style={{
        position: "absolute",
        bottom: "calc(100% + 10px)",
        left: mobile ? "50%" : "50%",
        transform: "translateX(-50%)",
        background: "var(--room-surface)",
        border: "1px solid var(--room-border)",
        borderRadius: 10,
        padding: "14px 16px",
        width: mobile ? "calc(100vw - 32px)" : 340,
        maxWidth: mobile ? "calc(100vw - 32px)" : 340,
        boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
        animation: "popoverIn 0.15s ease-out",
        zIndex: 100,
      }}
    >
      <div
        style={{
          fontSize: 13,
          fontWeight: 600,
          color: "var(--room-text)",
          marginBottom: 10,
        }}
      >
        Send this link to your AI agent
      </div>
      <button
        onClick={onCopy}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          background: "var(--room-surface-light)",
          borderRadius: 6,
          padding: "8px 10px",
          width: "100%",
          border: "none",
          cursor: "pointer",
          textAlign: "left",
          transition: "background 0.15s",
        }}
        onMouseEnter={(e) => { e.currentTarget.style.background = "#4e5154"; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = "var(--room-surface-light)"; }}
      >
        <span
          style={{
            flex: 1,
            fontFamily: "var(--font-mono, monospace)",
            fontSize: 11,
            color: "var(--room-text-secondary)",
            wordBreak: "break-all",
            lineHeight: 1.4,
          }}
        >
          {joinUrl}
        </span>
        <span
          style={{
            color: copiedJoinUrl ? "var(--room-green)" : "var(--room-blue)",
            fontSize: 12,
            fontWeight: 500,
            whiteSpace: "nowrap",
            flexShrink: 0,
          }}
        >
          {copiedJoinUrl ? "Copied!" : "Copy"}
        </span>
      </button>
      <div
        style={{
          fontSize: 11,
          color: "var(--room-text-muted)",
          marginTop: 8,
          lineHeight: 1.4,
        }}
      >
        The agent will receive instructions when it fetches this URL
      </div>
    </div>
  );
}

function BottomIcon({
  children,
  active,
  badge,
  onClick,
  title,
  color,
}: {
  children: React.ReactNode;
  active?: boolean;
  badge?: number;
  onClick?: () => void;
  title?: string;
  color?: string;
}) {
  const bg = color || (active ? "var(--room-primary)" : "var(--room-surface-light)");
  const fg = color ? "#fff" : active ? "#202124" : "var(--room-text)";
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        width: 40,
        height: 40,
        borderRadius: "50%",
        background: bg,
        color: fg,
        border: "none",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        transition: "background 0.15s, opacity 0.15s",
        position: "relative",
        flexShrink: 0,
      }}
      onMouseEnter={(e) => {
        if (color) { e.currentTarget.style.opacity = "0.85"; }
        else if (!active) { e.currentTarget.style.background = "#4e5154"; }
      }}
      onMouseLeave={(e) => {
        if (color) { e.currentTarget.style.opacity = "1"; }
        else if (!active) { e.currentTarget.style.background = "var(--room-surface-light)"; }
      }}
    >
      {children}
      {badge !== undefined && (
        <span
          style={{
            position: "absolute",
            top: -2,
            right: -2,
            background: active ? "#202124" : "var(--room-primary)",
            color: active ? "var(--room-primary)" : "#202124",
            fontSize: 10,
            fontWeight: 700,
            borderRadius: 10,
            padding: "0 5px",
            minWidth: 16,
            height: 16,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            lineHeight: 1,
          }}
        >
          {badge}
        </span>
      )}
    </button>
  );
}

function InfoPanel({
  roomCode,
  joinUrl,
  isLocked,
  copiedJoinUrl,
  onCopyJoinUrl,
  onClose,
}: {
  roomCode: string;
  joinUrl: string;
  isLocked: boolean;
  copiedJoinUrl: boolean;
  onCopyJoinUrl: () => void;
  onClose: () => void;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Header */}
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
          Meeting details
        </span>
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
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: "auto", padding: "0 20px 20px" }}>
        {!isLocked && (
          <div style={{ marginBottom: 24 }}>
            <div
              style={{
                fontSize: 11,
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: "0.5px",
                color: "var(--room-text-muted)",
                marginBottom: 8,
              }}
            >
              Joining info
            </div>
            <div
              style={{
                background: "var(--room-surface-light)",
                borderRadius: 8,
                padding: "12px 14px",
              }}
            >
              <div style={{ fontSize: 12, color: "var(--room-text-secondary)", marginBottom: 8 }}>
                Share this link with an agent:
              </div>
              <button
                onClick={onCopyJoinUrl}
                style={{
                  width: "100%",
                  background: "none",
                  border: "none",
                  color: copiedJoinUrl ? "var(--room-green)" : "var(--room-primary)",
                  fontFamily: "var(--font-mono, monospace)",
                  fontSize: 12,
                  cursor: "pointer",
                  textAlign: "left",
                  wordBreak: "break-all",
                  padding: 0,
                  lineHeight: 1.5,
                }}
              >
                {copiedJoinUrl ? "Copied to clipboard!" : joinUrl}
              </button>
            </div>
          </div>
        )}

        <div>
          <div
            style={{
              fontSize: 11,
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.5px",
              color: "var(--room-text-muted)",
              marginBottom: 8,
            }}
          >
            Room
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <InfoRow label="Code" value={roomCode} mono />
            <InfoRow label="State" value={isLocked ? "Ended" : "Active"} color={isLocked ? "var(--room-red)" : "var(--room-green)"} />
            <InfoRow label="API" value={`/api/v1/${roomCode}/agent-join`} mono />
          </div>
        </div>
      </div>
    </div>
  );
}

function InfoRow({
  label,
  value,
  mono,
  color,
}: {
  label: string;
  value: string;
  mono?: boolean;
  color?: string;
}) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 0" }}>
      <span style={{ fontSize: 12, color: "var(--room-text-secondary)" }}>{label}</span>
      <span
        style={{
          fontSize: 12,
          color: color || "var(--room-text-muted)",
          fontFamily: mono ? "var(--font-mono, monospace)" : "inherit",
          fontWeight: color ? 600 : 400,
        }}
      >
        {value}
      </span>
    </div>
  );
}

function useElapsed(firstMessageAt?: string): string | null {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!firstMessageAt) return;
    const startTime = new Date(firstMessageAt).getTime();

    function tick() {
      setElapsed(Math.max(0, Math.floor((Date.now() - startTime) / 1000)));
    }

    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [firstMessageAt]);

  if (!firstMessageAt) return null;

  const h = Math.floor(elapsed / 3600);
  const m = Math.floor((elapsed % 3600) / 60);
  const s = elapsed % 60;

  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
