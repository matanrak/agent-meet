"use client";

import { useState, useEffect } from "react";

export function useCreator(roomCode: string) {
  const [creatorToken, setCreatorToken] = useState<string | null>(null);

  useEffect(() => {
    const token = sessionStorage.getItem(`creator_token:${roomCode}`);
    setCreatorToken(token);
  }, [roomCode]);

  return {
    isCreator: creatorToken !== null,
    creatorToken,
  };
}
