"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { Message } from "@/lib/types";
import { drawFrame, calculateFrameHeight, WIDTH, PADDING, AVATAR_SIZE, getAgentColor } from "@/lib/exportGif";

interface GifExportModalProps {
  messages: Message[];
  roomCode: string;
  onClose: () => void;
}

const SPEED_PRESETS = [
  { label: "Fast", value: 500 },
  { label: "Normal", value: 1500 },
  { label: "Slow", value: 2500 },
  { label: "Slower", value: 4000 },
];

export function GifExportModal({ messages, roomCode, onClose }: GifExportModalProps) {
  const chatMessages = messages.filter(
    (m) => m.agent_name !== "system" && m.agent_name !== "System"
  );

  const [selected, setSelected] = useState<Set<number>>(
    () => new Set(chatMessages.map((m) => m.message_id))
  );
  const [delay, setDelay] = useState(1500);
  const [exporting, setExporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number>(0);
  const animIndexRef = useRef(0);
  const lastTickRef = useRef(0);

  const selectedMessages = chatMessages.filter((m) => selected.has(m.message_id));
  const allAgentIds = new Set(chatMessages.map((m) => m.agent_id));

  const toggle = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => setSelected(new Set(chatMessages.map((m) => m.message_id)));
  const selectNone = () => setSelected(new Set());

  // Live preview animation
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || selectedMessages.length === 0) {
      if (canvas) {
        const ctx = canvas.getContext("2d")!;
        canvas.height = 200;
        ctx.fillStyle = "#202124";
        ctx.fillRect(0, 0, WIDTH, 200);
        ctx.fillStyle = "#9aa0a6";
        ctx.font = "14px system-ui, -apple-system, sans-serif";
        ctx.fillText("Select messages to preview", WIDTH / 2 - 80, 100);
      }
      return;
    }

    const ctx = canvas.getContext("2d")!;
    const maxTextWidth = WIDTH - PADDING * 2 - AVATAR_SIZE - 12 - 28;
    const fullHeight = calculateFrameHeight(ctx, selectedMessages, maxTextWidth);
    const canvasHeight = Math.min(fullHeight, 800);
    canvas.height = canvasHeight;

    animIndexRef.current = 0;
    lastTickRef.current = 0;

    const animate = (time: number) => {
      if (!lastTickRef.current) lastTickRef.current = time;

      if (time - lastTickRef.current >= delay) {
        lastTickRef.current = time;
        animIndexRef.current++;
        if (animIndexRef.current > selectedMessages.length) {
          animIndexRef.current = 1;
        }
      }

      const visible = selectedMessages.slice(0, animIndexRef.current);
      drawFrame(ctx, visible, roomCode, canvasHeight, allAgentIds.size);
      animFrameRef.current = requestAnimationFrame(animate);
    };

    drawFrame(ctx, selectedMessages.slice(0, 1), roomCode, canvasHeight, allAgentIds.size);
    animFrameRef.current = requestAnimationFrame(animate);

    return () => cancelAnimationFrame(animFrameRef.current);
  }, [selectedMessages.length, selected, delay, roomCode, allAgentIds.size]);

  const handleExport = useCallback(async () => {
    if (exporting || selectedMessages.length === 0) return;
    setExporting(true);
    setProgress(0);

    try {
      const { exportGif } = await import("@/lib/exportGif");
      const blob = await exportGif(selectedMessages, roomCode, delay, allAgentIds.size, setProgress);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `agentmeet-${roomCode}.gif`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("GIF export failed:", err);
    } finally {
      setExporting(false);
    }
  }, [selectedMessages, roomCode, delay, exporting, allAgentIds.size]);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.6)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        style={{
          background: "var(--room-surface)",
          borderRadius: 12,
          width: "min(90vw, 960px)",
          maxHeight: "85vh",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
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
          }}
        >
          <span style={{ color: "var(--room-text)", fontSize: 15, fontWeight: 500 }}>
            Export GIF
          </span>
          <button
            onClick={onClose}
            style={{
              background: "transparent",
              border: "none",
              color: "var(--room-text-secondary)",
              cursor: "pointer",
              width: 32,
              height: 32,
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "background 0.15s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "var(--room-surface-light)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div style={{ display: "flex", flex: 1, overflow: "hidden", minHeight: 0 }}>
          {/* Left: message picker */}
          <div
            style={{
              width: 300,
              borderRight: "1px solid var(--room-border)",
              display: "flex",
              flexDirection: "column",
              flexShrink: 0,
              background: "var(--room-bg)",
            }}
          >
            {/* Select controls */}
            <div
              style={{
                padding: "10px 16px",
                borderBottom: "1px solid var(--room-border)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <span style={{ color: "var(--room-text-secondary)", fontSize: 12 }}>
                {selected.size} of {chatMessages.length}
              </span>
              <div style={{ display: "flex", gap: 4 }}>
                {[
                  { label: "All", fn: selectAll },
                  { label: "None", fn: selectNone },
                ].map((btn) => (
                  <button
                    key={btn.label}
                    onClick={btn.fn}
                    style={{
                      background: "transparent",
                      border: "1px solid var(--room-border)",
                      color: "var(--room-text-secondary)",
                      cursor: "pointer",
                      fontSize: 11,
                      padding: "3px 10px",
                      borderRadius: 14,
                      transition: "all 0.15s",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = "var(--room-surface-light)";
                      e.currentTarget.style.color = "var(--room-text)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "transparent";
                      e.currentTarget.style.color = "var(--room-text-secondary)";
                    }}
                  >
                    {btn.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Message list */}
            <div style={{ flex: 1, overflowY: "auto", padding: "4px 0" }}>
              {chatMessages.map((msg) => {
                const isSelected = selected.has(msg.message_id);
                return (
                  <div
                    key={msg.message_id}
                    onClick={() => toggle(msg.message_id)}
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: 10,
                      padding: "8px 16px",
                      cursor: "pointer",
                      opacity: isSelected ? 1 : 0.35,
                      background: isSelected ? "var(--room-surface)" : "transparent",
                      transition: "all 0.15s",
                    }}
                  >
                    <div
                      style={{
                        width: 16,
                        height: 16,
                        borderRadius: 3,
                        border: isSelected
                          ? "none"
                          : "2px solid var(--room-text-secondary)",
                        background: isSelected ? "var(--room-primary)" : "transparent",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                        marginTop: 2,
                      }}
                    >
                      {isSelected && (
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#202124" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      )}
                    </div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ color: getAgentColor(msg.agent_id), fontSize: 11, fontWeight: 600, marginBottom: 2 }}>
                        {msg.agent_name}
                      </div>
                      <div
                        style={{
                          color: "var(--room-text)",
                          fontSize: 12,
                          lineHeight: 1.4,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          display: "-webkit-box",
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: "vertical",
                        }}
                      >
                        {msg.content}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right: preview + controls */}
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              minWidth: 0,
            }}
          >
            {/* Preview */}
            <div
              style={{
                flex: 1,
                overflow: "auto",
                display: "flex",
                alignItems: "flex-start",
                justifyContent: "center",
                padding: 20,
                background: "var(--room-bg)",
              }}
            >
              <canvas
                ref={canvasRef}
                width={WIDTH}
                style={{
                  maxWidth: "100%",
                  borderRadius: 8,
                  height: "auto",
                }}
              />
            </div>

            {/* Controls */}
            <div
              style={{
                padding: "12px 20px",
                borderTop: "1px solid var(--room-border)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 16,
              }}
            >
              {/* Speed presets */}
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ color: "var(--room-text-secondary)", fontSize: 12, marginRight: 4 }}>
                  Speed
                </span>
                {SPEED_PRESETS.map((preset) => (
                  <button
                    key={preset.value}
                    onClick={() => setDelay(preset.value)}
                    style={{
                      background: delay === preset.value ? "var(--room-primary)" : "transparent",
                      color: delay === preset.value ? "#202124" : "var(--room-text-secondary)",
                      border: delay === preset.value ? "none" : "1px solid var(--room-border)",
                      borderRadius: 14,
                      padding: "4px 12px",
                      fontSize: 12,
                      fontWeight: delay === preset.value ? 600 : 400,
                      cursor: "pointer",
                      transition: "all 0.15s",
                    }}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>

              <button
                onClick={handleExport}
                disabled={exporting || selectedMessages.length === 0}
                style={{
                  background: exporting ? "var(--room-surface-light)" : "var(--room-primary)",
                  color: exporting ? "var(--room-text-secondary)" : "#202124",
                  border: "none",
                  borderRadius: 20,
                  padding: "8px 24px",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: exporting ? "default" : "pointer",
                  whiteSpace: "nowrap",
                  transition: "all 0.15s",
                }}
              >
                {exporting ? `Exporting ${progress}%` : "Download GIF"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
