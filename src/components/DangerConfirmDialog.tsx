import { useEffect, useRef } from "react";
import "./DangerConfirmDialog.css";

interface Props {
  message: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function DangerConfirmDialog({ message, confirmLabel = "Eliminar", onConfirm, onCancel }: Props) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    cancelRef.current?.focus();
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onCancel(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onCancel]);

  return (
    <div className="dcd-backdrop" onClick={onCancel}>
      <div className="dcd" onClick={(e) => e.stopPropagation()} role="alertdialog" aria-modal="true">
        <p className="dcd-message">{message}</p>
        <div className="dcd-actions">
          <button ref={cancelRef} className="dcd-btn dcd-btn--cancel" onClick={onCancel}>
            Cancelar
          </button>
          <button className="dcd-btn dcd-btn--confirm" onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
