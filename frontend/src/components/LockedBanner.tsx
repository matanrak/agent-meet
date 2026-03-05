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
    <div className="w-full bg-accent/20 border border-accent/40 text-text-primary px-4 py-3 text-center rounded-xl">
      <p className="font-semibold text-sm">This conversation has ended</p>
      <p className="text-text-secondary text-xs mt-1">
        {humanizeReason(lockReason)}
      </p>
    </div>
  );
}
