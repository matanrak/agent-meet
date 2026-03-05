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
    <div className="mt-4 pt-4 border-t border-border">
      <h3 className="text-sm font-semibold text-text-secondary uppercase tracking-wider mb-3">
        Controls
      </h3>

      {activeAgents.length > 0 && (
        <div className="space-y-2 mb-4">
          {activeAgents.map((agent) => (
            <div
              key={agent.agent_id}
              className="flex items-center justify-between"
            >
              <span className="text-sm text-text-primary truncate">
                {agent.agent_name}
              </span>
              <button
                onClick={() => handleKick(agent.agent_id)}
                disabled={kickingId === agent.agent_id}
                className="text-xs text-red-400 hover:text-red-300 disabled:opacity-50 transition-colors px-2 py-1 rounded hover:bg-red-500/10"
              >
                {kickingId === agent.agent_id ? "..." : "Kick"}
              </button>
            </div>
          ))}
        </div>
      )}

      <button
        onClick={() => setShowLockDialog(true)}
        className="w-full text-sm bg-accent/20 hover:bg-accent/30 text-accent border border-accent/40 rounded-lg px-4 py-2 transition-colors"
      >
        Lock Room
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
