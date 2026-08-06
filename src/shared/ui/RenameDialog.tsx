import { useState, useEffect, useRef, useCallback } from "react";
import { useDialogFocus } from "@/shared/hooks/useDialogFocus";
import { dbService } from "@/services/dbService";
import { useConnectionStore } from "@/store/connectionStore";
import "./dialog-shared.css";
import "./RenameDialog.css";

interface RenameDialogProps {
  connectionId: string;
  entityType: "table" | "view" | "function" | "procedure" | "trigger";
  entityName: string;
  schema: string | null;
  onClose: () => void;
}

export function RenameDialog({ connectionId, entityType, entityName, schema, onClose }: RenameDialogProps) {
  const [newName, setNewName] = useState(entityName);
  const [renaming, setRenaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  useDialogFocus({ containerRef: dialogRef, onClose, closeOnBackdropClick: false });

  useEffect(() => {
    requestAnimationFrame(() => inputRef.current?.select());
  }, []);

  const handleRename = useCallback(async () => {
    const trimmed = newName.trim();
    if (!trimmed || trimmed === entityName) { onClose(); return; }
    setRenaming(true);
    setError(null);
    try {
      const label = schema ? `"${schema}"."${entityName}"` : `"${entityName}"`;
      const newLabel = schema ? `"${schema}"."${trimmed}"` : `"${trimmed}"`;
      if (entityType === "table") {
        await dbService.runQuery(connectionId, `ALTER TABLE ${label} RENAME TO ${newLabel}`);
      } else if (entityType === "view") {
        await dbService.runQuery(connectionId, `ALTER VIEW ${label} RENAME TO ${newLabel}`);
      } else if (entityType === "function" || entityType === "procedure") {
        await dbService.runQuery(connectionId, `ALTER FUNCTION ${label} RENAME TO ${trimmed}`);
      } else if (entityType === "trigger") {
        await dbService.runQuery(connectionId, `ALTER TRIGGER ${label} RENAME TO ${trimmed}`);
      }
      useConnectionStore.getState().triggerReload();
      onClose();
    } catch (e: unknown) {
      const msg = e && typeof e === "object"
        ? String((e as Record<string, unknown>).message ?? e)
        : String(e);
      setError(msg);
    } finally {
      setRenaming(false);
    }
  }, [newName, entityName, entityType, schema, connectionId, onClose]);

  const displayLabel = schema ? `${schema}.${entityName}` : entityName;

  return (
    <div className="dialog-backdrop" onClick={onClose}>
      <div ref={dialogRef} className="dialog rd" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <span className="dialog-title">Rename {entityType}</span>
        <div className="dialog-entity">{displayLabel}</div>
        <input
          ref={inputRef}
          className="dialog-input"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") handleRename(); }}
          placeholder="New name"
        />
        {error && <span className="dialog-error">{error}</span>}
        <div className="dialog-actions">
          <button className="dialog-btn dialog-btn--cancel" onClick={onClose} disabled={renaming}>Cancel</button>
          <button className="dialog-btn dialog-btn--primary" onClick={handleRename} disabled={renaming || !newName.trim() || newName.trim() === entityName}>
            {renaming ? "Renaming…" : "Rename"}
          </button>
        </div>
      </div>
    </div>
  );
}
