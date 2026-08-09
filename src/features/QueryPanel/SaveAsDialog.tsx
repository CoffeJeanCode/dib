import { useRef, useEffect } from "react";
import { useDialogFocus } from "@/shared/hooks/useDialogFocus";

interface SaveAsDialogProps {
  name: string;
  onNameChange: (name: string) => void;
  onConfirm: (name: string) => void;
  onCancel: () => void;
  disabled?: boolean;
}

export function SaveAsDialog({
  name,
  onNameChange,
  onConfirm,
  onCancel,
  disabled = false,
}: SaveAsDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useDialogFocus({ containerRef: dialogRef, onClose: onCancel, closeOnBackdropClick: false });

  useEffect(() => {
    requestAnimationFrame(() => inputRef.current?.select());
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !disabled) {
      onConfirm(name);
    }
  };

  return (
    <div className="qp-save-as-overlay" onClick={onCancel}>
      <div
        ref={dialogRef}
        className="qp-save-as-dialog"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="save-as-title"
      >
        <label id="save-as-title" className="qp-save-as-label">
          Nombre del script
        </label>
        <input
          ref={inputRef}
          className="qp-save-as-input"
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Script name"
        />
        <div className="qp-save-as-actions">
          <button onClick={onCancel}>Cancel</button>
          <button
            className="qp-save-as-confirm"
            onClick={() => onConfirm(name)}
            disabled={disabled}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}