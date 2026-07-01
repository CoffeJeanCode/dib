import { useState, useEffect, useRef, useCallback } from "react";
import { X, Plus } from "lucide-react";
import { dbService } from "@/services/dbService";
import { useConnectionStore } from "@/store/connectionStore";
import type { SchemaChange, ColumnInfo } from "@/types/db";
import "./SchemaChangeWizard.css";

type ChangeKind = "add_column" | "drop_column" | "rename_column" | "alter_type";

const KIND_OPTIONS: { value: ChangeKind; label: string }[] = [
  { value: "add_column", label: "Add Column" },
  { value: "drop_column", label: "Drop Column" },
  { value: "rename_column", label: "Rename Column" },
  { value: "alter_type", label: "Change Data Type" },
];

const COMMON_TYPES = [
  "TEXT", "INTEGER", "BIGINT", "BOOLEAN", "FLOAT", "DOUBLE",
  "VARCHAR(255)", "TIMESTAMP", "DATE", "NUMERIC(10,2)", "BLOB", "JSON",
];

interface SchemaChangeWizardProps {
  connectionId: string;
  tableName: string;
  schema: string | null;
  onClose: () => void;
}

export function SchemaChangeWizard({ connectionId, tableName, schema, onClose }: SchemaChangeWizardProps) {
  const [columns, setColumns] = useState<ColumnInfo[]>([]);
  const [changes, setChanges] = useState<SchemaChange[]>([]);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [kind, setKind] = useState<ChangeKind>("add_column");
  const [colName, setColName] = useState("");
  const [colType, setColType] = useState("TEXT");
  const [renameTarget, setRenameTarget] = useState("");
  const [newName, setNewName] = useState("");

  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    cancelRef.current?.focus();
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.stopImmediatePropagation(); onClose(); }
    };
    window.addEventListener("keydown", handler, { capture: true });
    return () => window.removeEventListener("keydown", handler, { capture: true });
  }, [onClose]);

  useEffect(() => {
    dbService.fetchTableSchema(connectionId, tableName, schema)
      .then(setColumns)
      .catch(() => {});
  }, [connectionId, tableName, schema]);

  const addChange = useCallback(() => {
    if (kind === "add_column" && colName.trim()) {
      setChanges((p) => [...p, {
        kind: "add_column",
        column: colName.trim(),
        data_type: colType,
      }]);
      setColName("");
      return;
    }
    if (kind === "rename_column" && renameTarget && newName.trim()) {
      setChanges((p) => [...p, {
        kind: "rename_column",
        column: renameTarget,
        new_column: newName.trim(),
      }]);
      setNewName("");
      return;
    }
    if (kind === "alter_type" && renameTarget && colType) {
      setChanges((p) => [...p, {
        kind: "alter_type",
        column: renameTarget,
        data_type: colType,
      }]);
      return;
    }
    if (kind === "drop_column" && renameTarget) {
      setChanges((p) => [...p, {
        kind: "drop_column",
        column: renameTarget,
      }]);
      setRenameTarget("");
      return;
    }
  }, [kind, colName, colType, renameTarget, newName]);

  const removeChange = useCallback((idx: number) => {
    setChanges((p) => p.filter((_, i) => i !== idx));
  }, []);

  const handleApply = useCallback(async () => {
    if (changes.length === 0) return;
    setApplying(true);
    setError(null);
    try {
      await dbService.applySchemaChanges(connectionId, tableName, schema, changes);
      useConnectionStore.getState().triggerReload();
      onClose();
    } catch (e: unknown) {
      const msg = e && typeof e === "object"
        ? String((e as Record<string, unknown>).message ?? e)
        : String(e);
      setError(msg);
    } finally {
      setApplying(false);
    }
  }, [changes, connectionId, tableName, schema, onClose]);

  const changeLabel = (c: SchemaChange): string => {
    switch (c.kind) {
      case "add_column": return `ADD ${c.column} ${c.data_type ?? ""}`;
      case "drop_column": return `DROP ${c.column}`;
      case "rename_column": return `${c.column} → ${c.new_column}`;
      case "alter_type": return `${c.column} :: ${c.data_type}`;
      default: return "";
    }
  };

  const label = schema ? `${schema}.${tableName}` : tableName;

  return (
    <div className="scw-backdrop" onClick={onClose}>
      <div className="scw" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="scw-header">
          <span className="scw-title">Alter Table</span>
          <button className="scw-close" onClick={onClose} aria-label="Close"><X size={16} /></button>
        </div>

        <div className="scw-body">
          <div className="scw-table-name">{label}</div>

          {columns.length > 0 && (
            <div className="scw-row">
              <span className="scw-row-label">Current Columns</span>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                {columns.map((c) => (
                  <span key={c.name} className="tag tag-teal" style={{ fontSize: 10 }}>
                    {c.name}: {c.data_type}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="scw-row">
            <span className="scw-row-label">Operation</span>
            <div className="scw-add-bar">
              <select value={kind} onChange={(e) => setKind(e.target.value as ChangeKind)}>
                {KIND_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>

              {kind === "add_column" && (
                <>
                  <input
                    placeholder="Column name"
                    value={colName}
                    onChange={(e) => setColName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") addChange(); }}
                  />
                  <select value={colType} onChange={(e) => setColType(e.target.value)}>
                    {COMMON_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </>
              )}

              {kind === "drop_column" && (
                <>
                  <select value={renameTarget} onChange={(e) => setRenameTarget(e.target.value)}>
                    <option value="">— select —</option>
                    {columns.map((c) => <option key={c.name} value={c.name}>{c.name}</option>)}
                  </select>
                </>
              )}

              {kind === "rename_column" && (
                <>
                  <select value={renameTarget} onChange={(e) => setRenameTarget(e.target.value)}>
                    <option value="">— select —</option>
                    {columns.map((c) => <option key={c.name} value={c.name}>{c.name}</option>)}
                  </select>
                  <input
                    placeholder="New name"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") addChange(); }}
                  />
                </>
              )}

              {kind === "alter_type" && (
                <>
                  <select value={renameTarget} onChange={(e) => setRenameTarget(e.target.value)}>
                    <option value="">— select —</option>
                    {columns.map((c) => <option key={c.name} value={c.name}>{c.name}</option>)}
                  </select>
                  <select value={colType} onChange={(e) => setColType(e.target.value)}>
                    {COMMON_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </>
              )}

              <button className="scw-btn scw-btn--add" onClick={addChange}>
                <Plus size={14} /> Add
              </button>
            </div>
          </div>

          {changes.length > 0 && (
            <div className="scw-row">
              <span className="scw-row-label">Pending Changes ({changes.length})</span>
              <ul className="scw-changes">
                {changes.map((c, i) => (
                  <li key={i} className="scw-change-item">
                    <span className={`scw-change-kind scw-change-kind--${c.kind}`}>
                      {c.kind === "add_column" ? "ADD" : c.kind === "drop_column" ? "DROP" : c.kind === "rename_column" ? "RENAME" : "TYPE"}
                    </span>
                    <span className="scw-change-text">{changeLabel(c)}</span>
                    <button className="scw-btn scw-btn--remove" onClick={() => removeChange(i)}>&times;</button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {changes.length === 0 && (
            <div className="scw-empty">No pending changes — use the form above to add operations</div>
          )}

          {error && (
            <div className="scw-row">
              <span style={{ color: "var(--color-red)", fontSize: "var(--font-size-sm)" }}>{error}</span>
            </div>
          )}
        </div>

        <div className="scw-footer">
          <button ref={cancelRef} className="scw-btn scw-btn--cancel" onClick={onClose} disabled={applying}>
            Cancel
          </button>
          <button className="scw-btn scw-btn--apply" onClick={handleApply} disabled={applying || changes.length === 0}>
            {applying ? "Applying…" : `Apply ${changes.length > 0 ? `(${changes.length})` : ""}`}
          </button>
        </div>
      </div>
    </div>
  );
}
