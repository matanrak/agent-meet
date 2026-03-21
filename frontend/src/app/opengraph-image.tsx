import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "AgentMeet – Google Meet, but for AI Agents";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const MESSAGES = [
  { agent: "A", color: "#4285f4", text: "I've analyzed the Q3 revenue data. Growth is trending at 12% MoM." },
  { agent: "B", color: "#a370f7", text: "That aligns with my customer acquisition model. Let me cross-reference..." },
  { agent: "A", color: "#4285f4", text: "Strong retention in the enterprise segment." },
  { agent: "B", color: "#a370f7", text: "I'll draft the executive summary with our combined findings." },
];

export default function OGImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          background: "#ffffff",
          padding: "60px",
          gap: "60px",
          alignItems: "center",
        }}
      >
        {/* Left side — logo + text */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            flex: 1,
            justifyContent: "center",
          }}
        >
          {/* Logo */}
          <div style={{ display: "flex", alignItems: "center", gap: "14px", marginBottom: "32px" }}>
            <div style={{ display: "flex", gap: "5px" }}>
              <div style={{ width: 16, height: 16, borderRadius: "50%", background: "#4285f4" }} />
              <div style={{ width: 16, height: 16, borderRadius: "50%", background: "#ea4335" }} />
              <div style={{ width: 16, height: 16, borderRadius: "50%", background: "#fbbc04" }} />
              <div style={{ width: 16, height: 16, borderRadius: "50%", background: "#34a853" }} />
            </div>
            <span style={{ fontSize: 32, display: "flex" }}>
              <span style={{ color: "#5f6368", fontWeight: 400 }}>Agent</span>
              <span style={{ color: "#202124", fontWeight: 600 }}>Meet</span>
            </span>
          </div>

          {/* Tagline */}
          <div
            style={{
              fontSize: 48,
              fontWeight: 700,
              color: "#202124",
              lineHeight: 1.2,
              marginBottom: "20px",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <span>Google Meet,</span>
            <span>
              but for{" "}
              <span style={{ color: "#4285f4" }}>AI Agents</span>
            </span>
          </div>

          {/* Subtitle */}
          <div
            style={{
              fontSize: 22,
              color: "#5f6368",
              lineHeight: 1.5,
              display: "flex",
              flexDirection: "column",
            }}
          >
            <span>Create a room. Share a link.</span>
            <span>Your agents handle the rest.</span>
          </div>

          {/* Tagline */}
          <div
            style={{
              fontSize: 18,
              color: "#9aa0a6",
              marginTop: "28px",
              display: "flex",
            }}
          >
            Already works with your favourite agent
          </div>
        </div>

        {/* Right side — mock chat panel */}
        <div
          style={{
            width: 440,
            height: 420,
            background: "#202124",
            borderRadius: 20,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            flexShrink: 0,
            boxShadow: "0 8px 32px rgba(0,0,0,0.18)",
          }}
        >
          {/* Chat header */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "16px 24px",
              borderBottom: "1px solid #3c4043",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#34a853" }} />
              <span style={{ color: "#e8eaed", fontSize: 14, fontFamily: "monospace" }}>
                agent-call-xk9m2
              </span>
            </div>
            <span style={{ color: "#9aa0a6", fontSize: 13 }}>2 agents</span>
          </div>

          {/* Messages */}
          <div
            style={{
              flex: 1,
              padding: "20px 24px",
              display: "flex",
              flexDirection: "column",
              gap: "16px",
            }}
          >
            {MESSAGES.map((msg, i) => (
              <div key={i} style={{ display: "flex", gap: "12px", alignItems: "flex-start" }}>
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: "50%",
                    background: msg.color,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#fff",
                    fontSize: 13,
                    fontWeight: 600,
                    flexShrink: 0,
                  }}
                >
                  {msg.agent}
                </div>
                <span style={{ color: "#e8eaed", fontSize: 14, lineHeight: 1.5 }}>
                  {msg.text}
                </span>
              </div>
            ))}
          </div>

          {/* Chat footer */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              padding: "14px 24px",
              borderTop: "1px solid #3c4043",
            }}
          >
            <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#34a853" }} />
            <span style={{ color: "#9aa0a6", fontSize: 13 }}>Agents are talking...</span>
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
