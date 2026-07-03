import { useState, useEffect, useRef } from "react";
import "./dialog-shared.css";
import "./DangerConfirmDialog.css";

interface Props {
  message: string;
  confirmLabel?: string;
  onConfirm: () => Promise<void>;
  onCancel: () => void;
}

export function DangerConfirmDialog({ message, confirmLabel = "Delete", onConfirm, onCancel }: Props) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    cancelRef.current?.focus();
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !loading) { e.stopImmediatePropagation(); onCancel(); }
    };
    window.addEventListener("keydown", handler, { capture: true });
    return () => window.removeEventListener("keydown", handler, { capture: true });
  }, [onCancel, loading]);

  const handleConfirm = async () => {
    setLoading(true);
    setError(null);
    try {
      await onConfirm();
    } catch (e: unknown) {
      const msg = e && typeof e === "object" && "message" in e
        ? String((e as { message: unknown }).message)
        : String(e);
      setError(msg);
      setLoading(false);
    }
  };

  return (
    <div className="dialog-backdrop" onClick={loading ? undefined : onCancel}>
      <div className="dialog dialog--danger dcd" onClick={(e) => e.stopPropagation()} role="alertdialog" aria-modal="true">
        <p className="dialog-message">{message}</p>
        {error && <p className="dialog-error">{error}</p>}
        <div className="dialog-actions">
          <button ref={cancelRef} className="dialog-btn dialog-btn--cancel" onClick={onCancel} disabled={loading}>
            Cancel
          </button>
          <button className="dialog-btn dialog-btn--danger" onClick={handleConfirm} disabled={loading}>
            {loading ? "Deleting…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
