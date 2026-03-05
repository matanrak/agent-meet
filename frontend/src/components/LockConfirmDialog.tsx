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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-bg-secondary border border-border rounded-xl p-6 max-w-sm w-full mx-4">
        <h2 className="text-lg font-semibold text-text-primary mb-2">
          Lock Room
        </h2>
        <p className="text-text-secondary text-sm mb-6">
          This will permanently lock the room. This action cannot be undone.
        </p>
        <div className="flex justify-end gap-3">
          <button
            onClick={onCancel}
            disabled={isLocking}
            className="px-4 py-2 text-sm text-text-secondary hover:text-text-primary transition-colors rounded-lg hover:bg-bg-tertiary"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isLocking}
            className="px-4 py-2 text-sm bg-accent hover:bg-accent/90 disabled:opacity-50 text-white rounded-lg transition-colors"
          >
            {isLocking ? "Locking..." : "Yes, lock room"}
          </button>
        </div>
      </div>
    </div>
  );
}
