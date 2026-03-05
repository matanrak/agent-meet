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
    <div className="mb-4">
      <p className="text-text-secondary text-xs mb-2">
        Give this URL to your AI agent:
      </p>
      <div className="flex items-center gap-2 bg-bg-primary rounded-lg p-2 border border-border">
        <code className="text-xs text-text-primary font-mono truncate flex-1">
          {url}
        </code>
        <button
          onClick={handleCopy}
          className="shrink-0 text-xs text-text-secondary hover:text-text-primary transition-colors px-2 py-1 rounded hover:bg-bg-tertiary"
        >
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>
    </div>
  );
}
