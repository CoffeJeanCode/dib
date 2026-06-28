import { useEffect, useRef } from "react";
import { AlertTriangle } from "lucide-react";
import "./UnsavedChangesDialog.css";

interface Props {
  entityName: string;
  entityType: "script" | "table";
  onSave: () => void;
  onDiscard: () => void;
  onCancel: () => void;
}

export function UnsavedChangesDialog({ entityName, entityType, onSave, onDiscard, onCancel }: Props) {
  const saveRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    saveRef.current?.focus();
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onCancel(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onCancel]);

  const title = entityType === "script" ? "Unsaved Script" : "Unsaved Changes";
  const message = entityType === "script"
    ? `Save changes in "${entityName}" before closing?`
    : `You have modified rows in table "${entityName}". Save changes before closing?`;

  return (
    <div className="ucd-backdrop" onClick={onCancel}>
      <div className="ucd" onClick={(e) => e.stopPropagation()} role="alertdialog" aria-modal="true">
        <div className="ucd-header">
          <AlertTriangle size={20} />
          <span className="ucd-title">{title}</span>
        </div>
        <p className="ucd-message">{message}</p>
        <div className="ucd-actions">
          <button className="ucd-btn ucd-btn--cancel" onClick={onCancel}>
            Cancel
          </button>
          <button className="ucd-btn ucd-btn--discard" onClick={onDiscard}>
            Discard
          </button>
          <button ref={saveRef} className="ucd-btn ucd-btn--save" onClick={onSave}>
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
