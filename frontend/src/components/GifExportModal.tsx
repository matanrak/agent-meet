"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { Message } from "@/lib/types";
import { drawFrame, calculateFrameHeight, WIDTH, HEADER_HEIGHT, PADDING, AVATAR_SIZE, FOOTER_HEIGHT } from "@/lib/exportGif";

interface GifExportModalProps {
  messages: Message[];
  roomCode: string;
  onClose: () => void;
}

export function GifExportModal({ messages, roomCode, onClose }: GifExportModalProps) {
  const chatMessages = messages.filter(
    (m) => m.agent_name !== "system" && m.agent_name !== "System"
  );

  const [selected, setSelected] = useState<Set<number>>(
    () => new Set(chatMessages.map((m) => m.message_id))
  );
  const [delay, setDelay] = useState(800);
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

    // Draw first frame immediately
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
        background: "rgba(0,0,0,0.7)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        style={{
          background: "#292a2d",
          borderRadius: 16,
          width: "min(90vw, 960px)",
          maxHeight: "85vh",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "16px 20px",
            borderBottom: "1px solid #3c4043",
          }}
        >
          <h2 style={{ margin: 0, color: "#e8eaed", fontSize: 16, fontWeight: 600 }}>
            Export GIF
          </h2>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              color: "#9aa0a6",
              cursor: "pointer",
              fontSize: 20,
              padding: 4,
            }}
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div style={{ display: "flex", flex: 1, overflow: "hidden", minHeight: 0 }}>
          {/* Left: message picker */}
          <div
            style={{
              width: 320,
              borderRight: "1px solid #3c4043",
              display: "flex",
              flexDirection: "column",
              flexShrink: 0,
            }}
          >
            {/* Select controls */}
            <div
              style={{
                padding: "10px 16px",
                borderBottom: "1px solid #3c4043",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <span style={{ color: "#9aa0a6", fontSize: 12 }}>
                {selected.size}/{chatMessages.length} messages
              </span>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  onClick={selectAll}
                  style={{
                    background: "none",
                    border: "none",
                    color: "#8ab4f8",
                    cursor: "pointer",
                    fontSize: 12,
                  }}
                >
                  All
                </button>
                <button
                  onClick={selectNone}
                  style={{
                    background: "none",
                    border: "none",
                    color: "#8ab4f8",
                    cursor: "pointer",
                    fontSize: 12,
                  }}
                >
                  None
                </button>
              </div>
            </div>

            {/* Message list */}
            <div style={{ flex: 1, overflowY: "auto", padding: "8px 0" }}>
              {chatMessages.map((msg) => (
                <label
                  key={msg.message_id}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 10,
                    padding: "6px 16px",
                    cursor: "pointer",
                    opacity: selected.has(msg.message_id) ? 1 : 0.4,
                    transition: "opacity 0.15s",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={selected.has(msg.message_id)}
                    onChange={() => toggle(msg.message_id)}
                    style={{ marginTop: 3, accentColor: "#8ab4f8" }}
                  />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ color: "#8ab4f8", fontSize: 11, fontWeight: 600 }}>
                      {msg.agent_name}
                    </div>
                    <div
                      style={{
                        color: "#e8eaed",
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
                </label>
              ))}
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
                background: "#1a1a1d",
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
                padding: "14px 20px",
                borderTop: "1px solid #3c4043",
                display: "flex",
                alignItems: "center",
                gap: 20,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1 }}>
                <label style={{ color: "#9aa0a6", fontSize: 12, whiteSpace: "nowrap" }}>
                  Speed
                </label>
                <input
                  type="range"
                  min={200}
                  max={2000}
                  step={100}
                  value={delay}
                  onChange={(e) => setDelay(Number(e.target.value))}
                  style={{ flex: 1, accentColor: "#8ab4f8" }}
                />
                <span style={{ color: "#9aa0a6", fontSize: 12, minWidth: 45 }}>
                  {delay}ms
                </span>
              </div>

              <button
                onClick={handleExport}
                disabled={exporting || selectedMessages.length === 0}
                style={{
                  background: exporting ? "#3c4043" : "#8ab4f8",
                  color: exporting ? "#9aa0a6" : "#202124",
                  border: "none",
                  borderRadius: 8,
                  padding: "8px 20px",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: exporting ? "default" : "pointer",
                  whiteSpace: "nowrap",
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
