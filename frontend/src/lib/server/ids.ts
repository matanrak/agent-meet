import crypto from "crypto";

export function generateRoomCode(): string {
  const raw = crypto.randomBytes(6).toString("hex");
  return `${raw.slice(0, 3)}-${raw.slice(3, 7)}-${raw.slice(7, 11)}`;
}

export function generateCreatorToken(): string {
  return `ct_${crypto.randomBytes(12).toString("hex")}`;
}

export function generateAgentId(): string {
  return `ag_${crypto.randomBytes(4).toString("hex")}`;
}

export function generateAgentToken(): string {
  return `at_${crypto.randomBytes(4).toString("hex")}`;
}
