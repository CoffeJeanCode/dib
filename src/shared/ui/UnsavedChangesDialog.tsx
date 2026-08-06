import { useRef } from "react";
import { useDialogFocus } from "@/shared/hooks/useDialogFocus";
import { AlertTriangle } from "lucide-react";
import "./dialog-shared.css";
import "./UnsavedChangesDialog.css";

interface Props {
  entityName: string;
  entityType: "script" | "table";
  onSave: () => void;
  onDiscard: () => void;
  onCancel: () => void;
}

export function UnsavedChangesDialog({ entityName, entityType, onSave, onDiscard, onCancel }: Props) {
  const dialogRef = useRef<HTMLDivElement>(null);

  useDialogFocus({
    containerRef: dialogRef,
    onClose: onCancel,
    initialFocusSelector: "[data-dialog-initial-focus]",
    closeOnBackdropClick: false,
  });

  const title = entityType === "script" ? "Unsaved Script" : "Unsaved Changes";
  const message = entityType === "script"
    ? `Do you want to save the changes to "${entityName}" before closing?`
    : `You have modified rows in the table "${entityName}". Do you want to save the changes before closing?`;

  return (
    <div className="dialog-backdrop" onClick={onCancel}>
      <div ref={dialogRef} className="dialog ucd" onClick={(e) => e.stopPropagation()} role="alertdialog" aria-modal="true">
        <div className="ucd-header">
          <AlertTriangle size={20} />
          <span className="dialog-title">{title}</span>
        </div>
        <p className="dialog-message">{message}</p>
        <div className="dialog-actions">
          <button className="dialog-btn dialog-btn--cancel" onClick={onCancel}>
            Cancel
          </button>
          <button className="dialog-btn dialog-btn--danger" onClick={onDiscard}>
            Discard Changes
          </button>
          <button data-dialog-initial-focus className="dialog-btn dialog-btn--primary" onClick={onSave}>
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
