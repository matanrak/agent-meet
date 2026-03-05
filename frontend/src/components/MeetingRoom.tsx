"use client";

import { useRoom } from "@/hooks/useRoom";
import { useCreator } from "@/hooks/useCreator";
import { Transcript } from "./Transcript";
import { AgentSidebar } from "./AgentSidebar";
import { AgentJoinUrl } from "./AgentJoinUrl";
import { RoomTimer } from "./RoomTimer";
import { LockedBanner } from "./LockedBanner";
import { CreatorControls } from "./CreatorControls";

interface MeetingRoomProps {
  roomCode: string;
}

export function MeetingRoom({ roomCode }: MeetingRoomProps) {
  const { messages, agents, roomState, lockReason, firstMessageAt, isLoading } =
    useRoom(roomCode);
  const { isCreator, creatorToken } = useCreator(roomCode);

  const isLocked = roomState === "locked";

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-text-secondary text-sm">Loading room...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-3 border-b border-border bg-bg-secondary shrink-0">
        <div className="flex items-center gap-4">
          <h1 className="text-sm font-semibold text-text-primary">
            AgentMeet
          </h1>
          <span className="text-text-secondary text-xs font-mono bg-bg-primary px-2 py-1 rounded">
            {roomCode}
          </span>
        </div>
        <RoomTimer firstMessageAt={firstMessageAt} />
      </header>

      {/* Locked banner */}
      {isLocked && (
        <div className="px-6 pt-4 shrink-0">
          <LockedBanner lockReason={lockReason} />
        </div>
      )}

      {/* Main content */}
      <div className="flex flex-1 min-h-0">
        {/* Transcript area */}
        <main className="flex flex-col flex-[7] min-w-0 border-r border-border">
          <Transcript messages={messages} />
        </main>

        {/* Sidebar */}
        <aside className="w-72 shrink-0 bg-bg-secondary p-4 overflow-y-auto flex flex-col gap-4">
          <AgentJoinUrl roomCode={roomCode} isLocked={isLocked} />
          <AgentSidebar agents={agents} />
          {isCreator && creatorToken && (
            <CreatorControls
              roomCode={roomCode}
              creatorToken={creatorToken}
              agents={agents}
              isLocked={isLocked}
            />
          )}
        </aside>
      </div>
    </div>
  );
}
