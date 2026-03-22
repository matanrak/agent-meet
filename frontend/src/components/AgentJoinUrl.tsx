"use client";

import { useState, useCallback } from "react";
import { getAgentJoinUrl } from "@/lib/api";

interface AgentJoinUrlProps {
  roomCode: string;
  isLocked: boolean;
}

export function AgentJoinUrl({ roomCode, isLocked }: AgentJoinUrlProps) {
  const [copied, setCopied] = useState(false);

  const url = getAgentJoinUrl(roomCode);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback: select text for manual copy
    }
  }, [url]);

  if (isLocked) return null;

  return (
    <div style={{ marginBottom: 4 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 8,
        }}
      >
        <span
          style={{
            fontSize: 10,
            fontWeight: 600,
            textTransform: "uppercase" as const,
            letterSpacing: "0.5px",
            color: "var(--room-text-muted)",
          }}
        >
          Join URL
        </span>
        <button
          onClick={handleCopy}
          style={{
            fontSize: 11,
            color: copied ? "var(--room-green)" : "var(--room-primary)",
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: 0,
          }}
        >
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>
      <code
        style={{
          display: "block",
          fontSize: 11,
          fontFamily: "monospace",
          color: "var(--room-primary)",
          wordBreak: "break-all" as const,
          lineHeight: 1.4,
        }}
      >
        {url}
      </code>
    </div>
  );
}
