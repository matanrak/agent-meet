"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { getRoomStatus, getTranscript } from "@/lib/api";
import type { Message, Agent } from "@/lib/types";

/**
 * Merge incoming messages into the existing list, deduping by message_id and
 * keeping the canonical room_seq order. Used by the initial fetch, the realtime
 * stream, and the polling fallback so the same message arriving via different
 * paths never duplicates and new messages are never dropped.
 */
function mergeMessages(prev: Message[], incoming: Message[]): Message[] {
  if (incoming.length === 0) return prev;
  const byId = new Map<number, Message>();
  for (const m of prev) byId.set(m.message_id, m);
  let changed = false;
  for (const m of incoming) {
    if (!byId.has(m.message_id)) changed = true;
    byId.set(m.message_id, m);
  }
  if (!changed) return prev;
  return Array.from(byId.values()).sort((a, b) => a.message_id - b.message_id);
}

export function useRoom(roomCode: string) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [roomState, setRoomState] = useState<"active" | "locked">("active");
  const [lockReason, setLockReason] = useState<string | undefined>();
  const [firstMessageAt, setFirstMessageAt] = useState<string | undefined>();
  const [isLoading, setIsLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const fetchInitialData = useCallback(async () => {
    try {
      const [status, transcript] = await Promise.all([
        getRoomStatus(roomCode),
        getTranscript(roomCode).catch(() => ({ messages: [] as Message[], agents: [] as Agent[] })),
      ]);

      setRoomState(status.state);
      setLockReason(status.lock_reason);
      setFirstMessageAt(status.first_message_at);
      // Merge rather than replace so realtime messages that arrived during the
      // initial fetch aren't clobbered.
      setMessages((prev) => mergeMessages(prev, transcript.messages));
      setAgents(transcript.agents);
    } catch (err) {
      if (err instanceof Error && err.message.includes("404")) {
        setNotFound(true);
      } else {
        console.error("Failed to fetch initial room data:", err);
      }
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
          schema: "public",
          table: "messages",
          filter: `room_code=eq.${roomCode}`,
        },
        (payload) => {
          const raw = payload.new as Record<string, unknown>;
          const msg: Message = {
            // The transcript API exposes message_id as the per-room room_seq;
            // mirror that here so realtime messages dedupe against fetched ones.
            message_id: (raw.room_seq ?? raw.message_id ?? raw.id) as number,
            agent_id: raw.agent_id as string,
            agent_name: raw.agent_name as string,
            content: raw.content as string,
            timestamp: (raw.timestamp ?? raw.created_at) as string,
            read_by: (raw.read_by ?? []) as string[],
          };
          setMessages((prev) => mergeMessages(prev, [msg]));
          setFirstMessageAt((prev) => prev ?? msg.timestamp);
        }
      )
      .subscribe();

    const readReceiptsChannel = supabase
      .channel(`read-receipts:${roomCode}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "messages",
          filter: `room_code=eq.${roomCode}`,
        },
        (payload) => {
          const raw = payload.new as Record<string, unknown>;
          const messageId = (raw.room_seq ?? raw.id) as number;
          setMessages((prev) =>
            prev.map((message) =>
              message.message_id === messageId
                ? { ...message, read_by: (raw.read_by ?? []) as string[] }
                : message
            )
          );
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
          schema: "public",
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
          schema: "public",
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
          schema: "public",
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
      supabase.removeChannel(readReceiptsChannel);
      supabase.removeChannel(agentsChannel);
      supabase.removeChannel(roomStateChannel);
    };
  }, [roomCode, fetchInitialData]);

  // Polling fallback: Supabase Realtime on the custom `app` schema can silently
  // fail to deliver, leaving the transcript stuck on whatever the initial fetch
  // returned. Poll the transcript while the room is active and merge in anything
  // new so the UI keeps updating even when the realtime stream is down.
  useEffect(() => {
    if (roomState === "locked") return;
    const id = setInterval(async () => {
      try {
        const { messages: latest, agents: latestAgents } = await getTranscript(roomCode);
        setMessages((prev) => mergeMessages(prev, latest));
        if (latestAgents.length > 0) setAgents(latestAgents);
      } catch {
        // Transient fetch failure; next tick will retry.
      }
    }, 3000);
    return () => clearInterval(id);
  }, [roomCode, roomState]);

  return { messages, agents, roomState, lockReason, firstMessageAt, isLoading, notFound };
}
