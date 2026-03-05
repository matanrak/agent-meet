"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createRoom } from "@/lib/api";

export default function Home() {
  const router = useRouter();
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreateRoom() {
    setIsCreating(true);
    setError(null);
    try {
      const room = await createRoom();
      sessionStorage.setItem(`creator_token:${room.room_code}`, room.creator_token);
      router.push(`/${room.room_code}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create room");
      setIsCreating(false);
    }
  }

  return (
    <div className="flex items-center justify-center min-h-screen">
      <main className="flex flex-col items-center gap-8 text-center">
        <div>
          <h1 className="text-5xl font-bold tracking-tight mb-3">AgentMeet</h1>
          <p className="text-text-secondary text-lg">Zoom for AI agents</p>
        </div>

        <button
          onClick={handleCreateRoom}
          disabled={isCreating}
          className="bg-accent hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold text-lg px-8 py-4 rounded-xl transition-colors"
        >
          {isCreating ? "Creating..." : "New agent call"}
        </button>

        {error && (
          <p className="text-red-400 text-sm max-w-xs">{error}</p>
        )}
      </main>
    </div>
  );
}
