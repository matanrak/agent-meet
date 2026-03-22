"use client";

import { useState } from "react";
import { kickAgent, lockRoom } from "@/lib/api";
import { LockConfirmDialog } from "./LockConfirmDialog";
import type { Agent } from "@/lib/types";

interface CreatorControlsProps {
  roomCode: string;
  creatorToken: string;
  agents: Agent[];
  isLocked: boolean;
}

/**
 * Standalone creator controls component.
 * In the Google Meet layout, kick functionality is integrated into
 * AgentSidebar and lock into the MeetingRoom bottom bar.
 * This component is kept for backwards compatibility / standalone use.
 */
export function CreatorControls({
  roomCode,
  creatorToken,
  agents,
  isLocked,
}: CreatorControlsProps) {
  const [showLockDialog, setShowLockDialog] = useState(false);
  const [isLocking, setIsLocking] = useState(false);
  const [kickingId, setKickingId] = useState<string | null>(null);

  if (isLocked) return null;

  const activeAgents = agents.filter((a) => a.status === "active");

  async function handleKick(agentId: string) {
    setKickingId(agentId);
    try {
      await kickAgent(roomCode, creatorToken, agentId);
    } catch (err) {
      console.error("Failed to kick agent:", err);
    } finally {
      setKickingId(null);
    }
  }

  async function handleLock() {
    setIsLocking(true);
    try {
      await lockRoom(roomCode, creatorToken);
      setShowLockDialog(false);
    } catch (err) {
      console.error("Failed to lock room:", err);
    } finally {
      setIsLocking(false);
    }
  }

  return (
    <div
      style={{
        borderTop: "1px solid var(--room-border)",
        paddingTop: 16,
        marginTop: 16,
      }}
    >
      <h3
        style={{
          fontSize: 10,
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: "0.5px",
          color: "var(--room-text-muted)",
          marginBottom: 12,
        }}
      >
        Controls
      </h3>

      {activeAgents.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
          {activeAgents.map((agent) => (
            <div
              key={agent.agent_id}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <span
                style={{
                  fontSize: 13,
                  color: "var(--room-text)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {agent.agent_name}
              </span>
              <button
                onClick={() => handleKick(agent.agent_id)}
                disabled={kickingId === agent.agent_id}
                style={{
                  fontSize: 11,
                  color: "var(--room-red)",
                  background: "rgba(234, 67, 53, 0.1)",
                  border: "none",
                  borderRadius: 12,
                  padding: "4px 12px",
                  cursor:
                    kickingId === agent.agent_id ? "default" : "pointer",
                  opacity: kickingId === agent.agent_id ? 0.5 : 1,
                }}
              >
                {kickingId === agent.agent_id ? "..." : "Remove"}
              </button>
            </div>
          ))}
        </div>
      )}

      <button
        onClick={() => setShowLockDialog(true)}
        style={{
          width: "100%",
          fontSize: 13,
          background: "rgba(234, 67, 53, 0.15)",
          color: "var(--room-red)",
          border: "1px solid rgba(234, 67, 53, 0.3)",
          borderRadius: 8,
          padding: "8px 16px",
          cursor: "pointer",
          transition: "background 0.15s",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = "rgba(234, 67, 53, 0.25)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = "rgba(234, 67, 53, 0.15)";
        }}
      >
        End Meeting
      </button>

      <LockConfirmDialog
        isOpen={showLockDialog}
        isLocking={isLocking}
        onCancel={() => setShowLockDialog(false)}
        onConfirm={handleLock}
      />
    </div>
  );
}
