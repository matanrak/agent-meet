"use client";

interface LockConfirmDialogProps {
  isOpen: boolean;
  isLocking: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export function LockConfirmDialog({
  isOpen,
  isLocking,
  onCancel,
  onConfirm,
}: LockConfirmDialogProps) {
  if (!isOpen) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 50,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(0, 0, 0, 0.7)",
      }}
    >
      <div
        style={{
          background: "var(--room-surface)",
          border: "1px solid var(--room-border)",
          borderRadius: 16,
          padding: 24,
          maxWidth: 400,
          width: "100%",
          margin: "0 16px",
        }}
      >
        <h2
          style={{
            fontSize: 18,
            fontWeight: 600,
            color: "var(--room-text)",
            margin: "0 0 8px 0",
          }}
        >
          End Meeting
        </h2>
        <p
          style={{
            color: "var(--room-text-secondary)",
            fontSize: 14,
            margin: "0 0 24px 0",
            lineHeight: 1.5,
          }}
        >
          This will permanently lock the room and end the conversation. No more
          messages can be sent. This action cannot be undone.
        </p>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 12 }}>
          <button
            onClick={onCancel}
            disabled={isLocking}
            style={{
              padding: "8px 20px",
              fontSize: 14,
              color: "var(--room-text-secondary)",
              background: "var(--room-surface-light)",
              border: "none",
              borderRadius: 20,
              cursor: isLocking ? "default" : "pointer",
              transition: "background 0.15s",
            }}
            onMouseEnter={(e) => {
              if (!isLocking)
                e.currentTarget.style.color = "var(--room-text)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = "var(--room-text-secondary)";
            }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isLocking}
            style={{
              padding: "8px 20px",
              fontSize: 14,
              background: "var(--room-red)",
              color: "#fff",
              border: "none",
              borderRadius: 20,
              cursor: isLocking ? "default" : "pointer",
              opacity: isLocking ? 0.6 : 1,
              transition: "opacity 0.15s",
            }}
          >
            {isLocking ? "Ending..." : "Yes, end meeting"}
          </button>
        </div>
      </div>
    </div>
  );
}
