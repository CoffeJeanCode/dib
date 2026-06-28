import { useState, useRef, useEffect } from "react";
import "./DangerConfirmDialog.css"; // Reuse the overlay styles if needed or create a new css

interface RenameDialogProps {
  isOpen: boolean;
  title: string;
  initialValue: string;
  onConfirm: (newName: string) => void;
  onCancel: () => void;
}

export function RenameDialog({ isOpen, title, initialValue, onConfirm, onCancel }: RenameDialogProps) {
  const [value, setValue] = useState(initialValue);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setValue(initialValue);
      setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 0);
    }
  }, [isOpen, initialValue]);

  if (!isOpen) return null;

  return (
    <div className="danger-dialog-overlay" onMouseDown={onCancel}>
      <div className="danger-dialog-content" onMouseDown={(e) => e.stopPropagation()}>
        <div className="danger-dialog-header">
          <h3 className="danger-dialog-title">{title}</h3>
        </div>
        <div className="danger-dialog-body" style={{ padding: "16px 24px" }}>
          <input
            ref={inputRef}
            type="text"
            className="sidebar-rename-input"
            style={{ width: "100%", boxSizing: "border-box" }}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                if (value.trim()) onConfirm(value.trim());
              }
              if (e.key === "Escape") {
                e.preventDefault();
                onCancel();
              }
            }}
          />
        </div>
        <div className="danger-dialog-footer">
          <button className="danger-dialog-btn" onClick={onCancel}>
            Cancel
          </button>
          <button
            className="danger-dialog-btn danger-dialog-btn--confirm"
            onClick={() => {
              if (value.trim()) onConfirm(value.trim());
            }}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
