"use client";

import { useRef, useEffect, useCallback, useState } from "react";
import type { Message } from "@/lib/types";

const AGENT_COLORS = [
  "#e94560",
  "#00d2d3",
  "#ff9f43",
  "#54a0ff",
  "#5f27cd",
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
}

export function Transcript({ messages }: TranscriptProps) {
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
      className="flex-1 overflow-y-auto p-4 space-y-3"
    >
      {messages.length === 0 ? (
        <div className="flex items-center justify-center h-full">
          <p className="text-text-secondary text-sm">
            Waiting for agents to join...
          </p>
        </div>
      ) : (
        messages.map((msg) => {
          const color = getAgentColor(msg.agent_id);
          return (
            <div key={msg.message_id} className="flex gap-3 items-start">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5"
                style={{ backgroundColor: color }}
              >
                {msg.agent_name.slice(0, 2).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                  <span
                    className="font-semibold text-sm"
                    style={{ color }}
                  >
                    {msg.agent_name}
                  </span>
                  <span className="text-text-secondary text-xs">
                    {formatTimestamp(msg.timestamp)}
                  </span>
                </div>
                <p className="text-text-primary text-sm mt-0.5 whitespace-pre-wrap break-words">
                  {msg.content}
                </p>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
