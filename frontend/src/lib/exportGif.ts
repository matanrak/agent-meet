import type { Message } from "./types";

const AGENT_COLORS = [
  "#e94560",
  "#00d2d3",
  "#ff9f43",
  "#54a0ff",
  "#a370f7",
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

export const WIDTH = 600;
export const PADDING = 24;
const MSG_GAP = 12;
export const AVATAR_SIZE = 28;
const FONT_SIZE = 13;
const NAME_FONT_SIZE = 12;
const LINE_HEIGHT = 1.5;
const BG = "#202124";
const SURFACE = "#303134";
const TEXT = "#e8eaed";
const TEXT_MUTED = "#9aa0a6";
export const HEADER_HEIGHT = 48;
export const FOOTER_HEIGHT = 40;

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth) {
      if (current) lines.push(current);
      current = word;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function measureMessageHeight(
  ctx: CanvasRenderingContext2D,
  msg: Message,
  isNewSpeaker: boolean,
  maxTextWidth: number
): number {
  ctx.font = `${FONT_SIZE}px system-ui, -apple-system, sans-serif`;
  const lines = wrapText(ctx, msg.content, maxTextWidth);
  const textHeight = lines.length * FONT_SIZE * LINE_HEIGHT;
  const bubblePadding = 20;
  let height = textHeight + bubblePadding;
  if (isNewSpeaker) {
    height += NAME_FONT_SIZE + 8;
  }
  return height;
}

function drawRoundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

export function drawFrame(
  ctx: CanvasRenderingContext2D,
  messages: Message[],
  roomCode: string,
  canvasHeight: number,
  totalAgentCount: number
) {
  const maxTextWidth = WIDTH - PADDING * 2 - AVATAR_SIZE - 12 - 28;

  // Background
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, WIDTH, canvasHeight);

  // Header
  ctx.fillStyle = SURFACE;
  ctx.fillRect(0, 0, WIDTH, HEADER_HEIGHT);
  // Green dot
  ctx.beginPath();
  ctx.arc(PADDING + 5, HEADER_HEIGHT / 2, 5, 0, Math.PI * 2);
  ctx.fillStyle = "#34a853";
  ctx.fill();
  // Room code
  ctx.font = `13px monospace`;
  ctx.fillStyle = TEXT;
  ctx.fillText(roomCode, PADDING + 18, HEADER_HEIGHT / 2 + 4);
  // Agent count — always use total, not per-frame visible count
  const countText = `${totalAgentCount} agent${totalAgentCount !== 1 ? "s" : ""}`;
  ctx.font = `12px system-ui, -apple-system, sans-serif`;
  ctx.fillStyle = TEXT_MUTED;
  const countWidth = ctx.measureText(countText).width;
  ctx.fillText(countText, WIDTH - PADDING - countWidth, HEADER_HEIGHT / 2 + 4);

  // Calculate total content height for scroll viewport
  let totalContentHeight = PADDING;
  const msgHeights: number[] = [];
  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    if (msg.agent_name === "system" || msg.agent_name === "System") {
      msgHeights.push(0);
      continue;
    }
    const isNewSpeaker = i === 0 || messages[i - 1].agent_id !== msg.agent_id;
    const h = measureMessageHeight(ctx, msg, isNewSpeaker, maxTextWidth) + MSG_GAP;
    msgHeights.push(h);
    totalContentHeight += h;
  }

  // Scroll offset: keep latest messages visible
  const visibleArea = canvasHeight - HEADER_HEIGHT - FOOTER_HEIGHT;
  const scrollOffset = Math.max(0, totalContentHeight - visibleArea);

  // Messages
  let y = HEADER_HEIGHT + PADDING - scrollOffset;

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    if (msg.agent_name === "system" || msg.agent_name === "System") continue;

    const isNewSpeaker = i === 0 || messages[i - 1].agent_id !== msg.agent_id;
    const color = getAgentColor(msg.agent_id);

    // Skip if above visible area
    const msgHeight = msgHeights[i];
    if (y + msgHeight < HEADER_HEIGHT) {
      y += msgHeight;
      continue;
    }
    // Stop if below footer
    if (y > canvasHeight - FOOTER_HEIGHT) break;

    let msgY = y;

    if (isNewSpeaker) {
      // Avatar
      ctx.beginPath();
      ctx.arc(PADDING + AVATAR_SIZE / 2, msgY + AVATAR_SIZE / 2, AVATAR_SIZE / 2, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.font = `bold 11px system-ui, -apple-system, sans-serif`;
      ctx.fillStyle = "#fff";
      const initial = msg.agent_name.charAt(0).toUpperCase();
      const initialWidth = ctx.measureText(initial).width;
      ctx.fillText(initial, PADDING + AVATAR_SIZE / 2 - initialWidth / 2, msgY + AVATAR_SIZE / 2 + 4);

      // Name
      ctx.font = `600 ${NAME_FONT_SIZE}px system-ui, -apple-system, sans-serif`;
      ctx.fillStyle = color;
      ctx.fillText(msg.agent_name, PADDING + AVATAR_SIZE + 12, msgY + NAME_FONT_SIZE);
      msgY += NAME_FONT_SIZE + 8;
    }

    // Message bubble
    const bubbleX = PADDING + AVATAR_SIZE + 12;
    ctx.font = `${FONT_SIZE}px system-ui, -apple-system, sans-serif`;
    const lines = wrapText(ctx, msg.content, maxTextWidth);
    const textHeight = lines.length * FONT_SIZE * LINE_HEIGHT;
    const bubbleHeight = textHeight + 20;
    const bubbleWidth = WIDTH - bubbleX - PADDING;

    drawRoundRect(ctx, bubbleX, msgY, bubbleWidth, bubbleHeight, isNewSpeaker ? 4 : 10);
    ctx.fillStyle = SURFACE;
    ctx.fill();

    // Text
    ctx.fillStyle = TEXT;
    ctx.font = `${FONT_SIZE}px system-ui, -apple-system, sans-serif`;
    for (let l = 0; l < lines.length; l++) {
      ctx.fillText(lines[l], bubbleX + 10, msgY + 10 + FONT_SIZE + l * FONT_SIZE * LINE_HEIGHT);
    }

    y = msgY + bubbleHeight + MSG_GAP;
  }

  // Footer
  const footerY = canvasHeight - FOOTER_HEIGHT;
  ctx.fillStyle = BG;
  ctx.fillRect(0, footerY, WIDTH, FOOTER_HEIGHT);
  ctx.strokeStyle = "#3c4043";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, footerY);
  ctx.lineTo(WIDTH, footerY);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(PADDING + 5, footerY + FOOTER_HEIGHT / 2, 5, 0, Math.PI * 2);
  ctx.fillStyle = "#34a853";
  ctx.fill();
  ctx.font = `12px system-ui, -apple-system, sans-serif`;
  ctx.fillStyle = TEXT_MUTED;
  ctx.fillText("agentmeet.net", PADDING + 18, footerY + FOOTER_HEIGHT / 2 + 4);
}

export function calculateFrameHeight(
  ctx: CanvasRenderingContext2D,
  messages: Message[],
  maxTextWidth: number
): number {
  let height = HEADER_HEIGHT + PADDING;
  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    if (msg.agent_name === "system" || msg.agent_name === "System") continue;
    const isNewSpeaker = i === 0 || messages[i - 1].agent_id !== msg.agent_id;
    height += measureMessageHeight(ctx, msg, isNewSpeaker, maxTextWidth) + MSG_GAP;
  }
  height += FOOTER_HEIGHT + PADDING;
  return height;
}

export async function exportGif(
  messages: Message[],
  roomCode: string,
  delay: number,
  totalAgentCount: number,
  onProgress?: (pct: number) => void
): Promise<Blob> {
  const chatMessages = messages.filter(
    (m) => m.agent_name !== "system" && m.agent_name !== "System"
  );

  if (chatMessages.length === 0) {
    throw new Error("No messages to export");
  }

  const cappedMessages = chatMessages.slice(0, 50);

  const measureCanvas = document.createElement("canvas");
  measureCanvas.width = WIDTH;
  measureCanvas.height = 100;
  const measureCtx = measureCanvas.getContext("2d")!;
  const maxTextWidth = WIDTH - PADDING * 2 - AVATAR_SIZE - 12 - 28;

  const maxHeight = calculateFrameHeight(measureCtx, cappedMessages, maxTextWidth);
  const canvasHeight = Math.min(maxHeight, 800);

  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = canvasHeight;
  const ctx = canvas.getContext("2d")!;

  const { encode } = await import("modern-gif");

  const frames: { data: ImageData; delay: number }[] = [];
  const totalFrames = cappedMessages.length + 1;

  for (let i = 1; i <= cappedMessages.length; i++) {
    const visibleMessages = cappedMessages.slice(0, i);
    drawFrame(ctx, visibleMessages, roomCode, canvasHeight, totalAgentCount);
    const imageData = ctx.getImageData(0, 0, WIDTH, canvasHeight);
    frames.push({ data: imageData, delay });
    onProgress?.(Math.round((i / totalFrames) * 100));
  }

  // Hold last frame longer
  const lastImageData = ctx.getImageData(0, 0, WIDTH, canvasHeight);
  frames.push({ data: lastImageData, delay: 3000 });
  onProgress?.(100);

  const gif = await encode({
    width: WIDTH,
    height: canvasHeight,
    frames: frames.map((f) => ({
      data: f.data.data,
      delay: f.delay,
    })),
  });

  return new Blob([gif], { type: "image/gif" });
}
