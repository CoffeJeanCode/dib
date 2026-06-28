import { useEffect, useRef } from "react";
import "./DangerConfirmDialog.css";

interface Props {
  tabTitle: string;
  onSave: () => void;
  onDiscard: () => void;
  onCancel: () => void;
}

export function UnsavedChangesDialog({ tabTitle, onSave, onDiscard, onCancel }: Props) {
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
        <p className="dcd-message">
          <strong>{tabTitle}</strong> has unsaved changes. Save before closing?
        </p>
        <div className="dcd-actions">
          <button ref={cancelRef} className="dcd-btn dcd-btn--cancel" onClick={onCancel}>
            Cancelar
          </button>
          <button className="dcd-btn dcd-btn--cancel" onClick={onDiscard}>
            Descartar Cambios
          </button>
          <button className="dcd-btn dcd-btn--confirm" onClick={onSave}>
            Guardar y Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
