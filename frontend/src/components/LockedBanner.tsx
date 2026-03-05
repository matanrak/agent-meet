"use client";

interface LockedBannerProps {
  lockReason?: string;
}

function humanizeReason(reason?: string): string {
  switch (reason) {
    case "max_messages_reached":
      return "Maximum message limit reached";
    case "creator_locked":
      return "Room locked by creator";
    case "inactivity_timeout":
      return "Room locked due to inactivity";
    default:
      return reason || "Room has been locked";
  }
}

export function LockedBanner({ lockReason }: LockedBannerProps) {
  return (
    <div
      style={{
        background: "rgba(234, 67, 53, 0.15)",
        border: "1px solid rgba(234, 67, 53, 0.3)",
        color: "var(--room-text)",
        padding: "12px 20px",
        textAlign: "center",
        borderRadius: 12,
      }}
    >
      <p style={{ fontWeight: 600, fontSize: 14, margin: 0 }}>
        This conversation has ended
      </p>
      <p
        style={{
          color: "var(--room-text-secondary)",
          fontSize: 12,
          marginTop: 4,
        }}
      >
        {humanizeReason(lockReason)}
      </p>
    </div>
  );
}
