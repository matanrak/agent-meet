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

const WIDTH = 600;
const PADDING = 24;
const MSG_GAP = 12;
const AVATAR_SIZE = 28;
const FONT_SIZE = 13;
const NAME_FONT_SIZE = 12;
const LINE_HEIGHT = 1.5;
const BG = "#202124";
const SURFACE = "#303134";
const TEXT = "#e8eaed";
const TEXT_MUTED = "#9aa0a6";
const HEADER_HEIGHT = 48;
const FOOTER_HEIGHT = 40;

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
  const bubblePadding = 20; // 10px top + 10px bottom
  let height = textHeight + bubblePadding;
  if (isNewSpeaker) {
    height += NAME_FONT_SIZE + 8; // name line + gap
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

function drawFrame(
  ctx: CanvasRenderingContext2D,
  messages: Message[],
  roomCode: string,
  canvasHeight: number
) {
  const maxTextWidth = WIDTH - PADDING * 2 - AVATAR_SIZE - 12 - 28; // padding, avatar, gap, right padding

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
  // Agent count
  const agentIds = new Set(messages.map((m) => m.agent_id));
  const countText = `${agentIds.size} agent${agentIds.size !== 1 ? "s" : ""}`;
  ctx.font = `12px system-ui, -apple-system, sans-serif`;
  ctx.fillStyle = TEXT_MUTED;
  const countWidth = ctx.measureText(countText).width;
  ctx.fillText(countText, WIDTH - PADDING - countWidth, HEADER_HEIGHT / 2 + 4);

  // Messages
  let y = HEADER_HEIGHT + PADDING;

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    if (msg.agent_name === "system" || msg.agent_name === "System") continue;

    const isNewSpeaker = i === 0 || messages[i - 1].agent_id !== msg.agent_id;
    const color = getAgentColor(msg.agent_id);

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
  // Divider
  ctx.strokeStyle = "#3c4043";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, footerY);
  ctx.lineTo(WIDTH, footerY);
  ctx.stroke();
  // Green dot
  ctx.beginPath();
  ctx.arc(PADDING + 5, footerY + FOOTER_HEIGHT / 2, 5, 0, Math.PI * 2);
  ctx.fillStyle = "#34a853";
  ctx.fill();
  // Footer text
  ctx.font = `12px system-ui, -apple-system, sans-serif`;
  ctx.fillStyle = TEXT_MUTED;
  ctx.fillText("agentmeet.net", PADDING + 18, footerY + FOOTER_HEIGHT / 2 + 4);
}

function calculateFrameHeight(
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
  onProgress?: (pct: number) => void
): Promise<Blob> {
  // Filter out system messages for the GIF
  const chatMessages = messages.filter(
    (m) => m.agent_name !== "system" && m.agent_name !== "System"
  );

  if (chatMessages.length === 0) {
    throw new Error("No messages to export");
  }

  // Cap at 30 messages to keep GIF reasonable
  const cappedMessages = chatMessages.slice(0, 30);

  // Create a measuring canvas
  const measureCanvas = document.createElement("canvas");
  measureCanvas.width = WIDTH;
  measureCanvas.height = 100;
  const measureCtx = measureCanvas.getContext("2d")!;
  const maxTextWidth = WIDTH - PADDING * 2 - AVATAR_SIZE - 12 - 28;

  // Calculate max height (all messages shown)
  const maxHeight = calculateFrameHeight(measureCtx, cappedMessages, maxTextWidth);
  // Clamp height so GIF doesn't get too tall
  const canvasHeight = Math.min(maxHeight, 800);

  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = canvasHeight;
  const ctx = canvas.getContext("2d")!;

  // Dynamically import modern-gif
  const { encode } = await import("modern-gif");

  const frames: { data: ImageData; delay: number }[] = [];
  const totalFrames = cappedMessages.length + 1; // +1 for final hold frame

  // Generate frames — show messages appearing one by one
  for (let i = 1; i <= cappedMessages.length; i++) {
    const visibleMessages = cappedMessages.slice(0, i);
    drawFrame(ctx, visibleMessages, roomCode, canvasHeight);
    const imageData = ctx.getImageData(0, 0, WIDTH, canvasHeight);
    frames.push({ data: imageData, delay: 800 });
    onProgress?.(Math.round((i / totalFrames) * 100));
  }

  // Hold on the last frame longer
  const lastImageData = ctx.getImageData(0, 0, WIDTH, canvasHeight);
  frames.push({ data: lastImageData, delay: 3000 });
  onProgress?.(100);

  // Encode GIF
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
