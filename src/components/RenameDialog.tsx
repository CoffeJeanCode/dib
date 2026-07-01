import { useState, useEffect, useRef, useCallback } from "react";
import { dbService } from "@/services/dbService";
import { useConnectionStore } from "@/store/connectionStore";
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

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.stopImmediatePropagation(); onClose(); }
    };
    window.addEventListener("keydown", handler, { capture: true });
    return () => window.removeEventListener("keydown", handler, { capture: true });
  }, [onClose]);

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
    <div className="rd-backdrop" onClick={onClose}>
      <div className="rd" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <span className="rd-title">Rename {entityType}</span>
        <div className="rd-entity">{displayLabel}</div>
        <input
          ref={inputRef}
          className="rd-input"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") handleRename(); }}
          placeholder="New name"
        />
        {error && <span className="rd-error">{error}</span>}
        <div className="rd-actions">
          <button className="rd-btn rd-btn--cancel" onClick={onClose} disabled={renaming}>Cancel</button>
          <button className="rd-btn rd-btn--confirm" onClick={handleRename} disabled={renaming || !newName.trim() || newName.trim() === entityName}>
            {renaming ? "Renaming…" : "Rename"}
          </button>
        </div>
      </div>
    </div>
  );
}
