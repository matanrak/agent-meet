"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { getRoomStatus, getTranscript } from "@/lib/api";
import type { Message, Agent } from "@/lib/types";

export function useRoom(roomCode: string) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [roomState, setRoomState] = useState<"active" | "locked">("active");
  const [lockReason, setLockReason] = useState<string | undefined>();
  const [firstMessageAt, setFirstMessageAt] = useState<string | undefined>();
  const [isLoading, setIsLoading] = useState(true);

  const fetchInitialData = useCallback(async () => {
    try {
      const [status, transcript] = await Promise.all([
        getRoomStatus(roomCode),
        getTranscript(roomCode).catch(() => [] as Message[]),
      ]);

      setRoomState(status.state);
      setLockReason(status.lock_reason);
      setFirstMessageAt(status.first_message_at);
      setMessages(transcript);

      // We don't get individual agents from status, but the realtime
      // subscription will populate them. We could add an agents endpoint later.
    } catch (err) {
      console.error("Failed to fetch initial room data:", err);
    } finally {
      setIsLoading(false);
    }
  }, [roomCode]);

  useEffect(() => {
    fetchInitialData();

    // Channel 1: messages INSERT
    const messagesChannel = supabase
      .channel(`room:${roomCode}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "app",
          table: "messages",
          filter: `room_code=eq.${roomCode}`,
        },
        (payload) => {
          const raw = payload.new as Record<string, unknown>;
          const msg: Message = {
            message_id: (raw.message_id ?? raw.id) as number,
            agent_id: raw.agent_id as string,
            agent_name: raw.agent_name as string,
            content: raw.content as string,
            timestamp: (raw.timestamp ?? raw.created_at) as string,
          };
          setMessages((prev) => [...prev, msg]);
          setFirstMessageAt((prev) => prev ?? msg.timestamp);
        }
      )
      .subscribe();

    // Channel 2: agents UPDATE
    const agentsChannel = supabase
      .channel(`agents:${roomCode}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "app",
          table: "agents",
          filter: `room_code=eq.${roomCode}`,
        },
        (payload) => {
          const agent = payload.new as Agent;
          setAgents((prev) => {
            const existing = prev.findIndex((a) => a.agent_id === agent.agent_id);
            if (existing >= 0) {
              const updated = [...prev];
              updated[existing] = agent;
              return updated;
            }
            return [...prev, agent];
          });
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "app",
          table: "agents",
          filter: `room_code=eq.${roomCode}`,
        },
        (payload) => {
          const agent = payload.new as Agent;
          setAgents((prev) => {
            const existing = prev.findIndex((a) => a.agent_id === agent.agent_id);
            if (existing >= 0) {
              const updated = [...prev];
              updated[existing] = agent;
              return updated;
            }
            return [...prev, agent];
          });
        }
      )
      .subscribe();

    // Channel 3: room state UPDATE
    const roomStateChannel = supabase
      .channel(`room-state:${roomCode}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "app",
          table: "rooms",
          filter: `room_code=eq.${roomCode}`,
        },
        (payload) => {
          const room = payload.new as {
            state: "active" | "locked";
            lock_reason?: string;
            first_message_at?: string;
          };
          setRoomState(room.state);
          if (room.lock_reason) setLockReason(room.lock_reason);
          if (room.first_message_at) setFirstMessageAt(room.first_message_at);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(messagesChannel);
      supabase.removeChannel(agentsChannel);
      supabase.removeChannel(roomStateChannel);
    };
  }, [roomCode, fetchInitialData]);

  return { messages, agents, roomState, lockReason, firstMessageAt, isLoading };
}
