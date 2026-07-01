import { useState, useEffect, useRef } from "react";
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
    <div className="dcd-backdrop" onClick={loading ? undefined : onCancel}>
      <div className="dcd" onClick={(e) => e.stopPropagation()} role="alertdialog" aria-modal="true">
        <p className="dcd-message">{message}</p>
        {error && <p className="dcd-error">{error}</p>}
        <div className="dcd-actions">
          <button ref={cancelRef} className="dcd-btn dcd-btn--cancel" onClick={onCancel} disabled={loading}>
            Cancel
          </button>
          <button className="dcd-btn dcd-btn--confirm" onClick={handleConfirm} disabled={loading}>
            {loading ? "Deleting…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
