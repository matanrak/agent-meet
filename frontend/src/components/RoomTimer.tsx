"use client";

import { useState, useEffect } from "react";

interface RoomTimerProps {
  firstMessageAt?: string;
}

function formatElapsed(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;

  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function RoomTimer({ firstMessageAt }: RoomTimerProps) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!firstMessageAt) {
      setElapsed(0);
      return;
    }

    const startTime = new Date(firstMessageAt).getTime();

    function tick() {
      const now = Date.now();
      setElapsed(Math.floor((now - startTime) / 1000));
    }

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [firstMessageAt]);

  if (!firstMessageAt) return null;

  return (
    <span className="text-text-secondary text-sm font-mono">
      {formatElapsed(elapsed)}
    </span>
  );
}
