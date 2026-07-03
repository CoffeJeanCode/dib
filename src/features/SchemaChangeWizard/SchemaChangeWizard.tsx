import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { X, Plus, Trash2, AlertTriangle } from "lucide-react";
import { dbService } from "@/services/dbService";
import { useConnectionStore } from "@/store/connectionStore";
import { useUiStore } from "@/store/uiStore";
import type { SchemaChange, ColumnInfo } from "@/types/db";
import "@/shared/ui/dialog-shared.css";
import "./SchemaChangeWizard.css";

type ChangeKind = "add_column" | "drop_column" | "rename_column" | "alter_type";

const KIND_OPTIONS: { value: ChangeKind; label: string; icon: string }[] = [
  { value: "add_column", label: "Add Column", icon: "+" },
  { value: "drop_column", label: "Drop Column", icon: "−" },
  { value: "rename_column", label: "Rename Column", icon: "→" },
  { value: "alter_type", label: "Change Data Type", icon: "::" },
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

function generateAlterSql(
  tableName: string,
  schema: string | null,
  changes: SchemaChange[],
): string {
  if (changes.length === 0) return "";
  const label = schema ? `"${schema}"."${tableName}"` : `"${tableName}"`;
  return changes
    .map((c) => {
      switch (c.kind) {
        case "add_column":
          return `ALTER TABLE ${label}\n  ADD COLUMN ${c.column} ${c.data_type ?? "TEXT"};`;
        case "drop_column":
          return `ALTER TABLE ${label}\n  DROP COLUMN ${c.column};`;
        case "rename_column":
          return `ALTER TABLE ${label}\n  RENAME COLUMN ${c.column} TO ${c.new_column};`;
        case "alter_type":
          return `ALTER TABLE ${label}\n  ALTER COLUMN ${c.column} TYPE ${c.data_type};`;
      }
    })
    .join("\n");
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
      if (e.key === "Escape") {
        e.stopImmediatePropagation();
        useUiStore.setState({ dismissedFromPalette: true });
        onClose();
      }
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
    }
  }, [kind, colName, colType, renameTarget, newName]);

  const removeChange = useCallback((idx: number) => {
    setChanges((p) => p.filter((_, i) => i !== idx));
  }, []);

  const hasDrops = useMemo(() => changes.some((c) => c.kind === "drop_column"), [changes]);

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

  const previewSql = useMemo(
    () => generateAlterSql(tableName, schema, changes),
    [tableName, schema, changes],
  );

  const label = schema ? `${schema}.${tableName}` : tableName;

  return (
    <div className="dialog-backdrop" onClick={onClose}>
      <div className="dialog scw" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="dialog-header">
          <span className="dialog-title">Alter Table</span>
          <button className="dialog-close" onClick={onClose} aria-label="Close"><X /></button>
        </div>

        <div className="dialog-body">
          <div className="scw-table-name">{label}</div>

          {columns.length > 0 && (
            <div className="scw-row">
              <span className="scw-row-label">
                Current Columns ({columns.length})
              </span>
              <div className="scw-columns-grid">
                {columns.map((c) => (
                  <span
                    key={c.name}
                    className={`scw-column-chip${c.is_primary_key ? " scw-column-chip--pk" : ""}`}
                  >
                    {c.name}<span className="scw-col-type">{c.data_type}</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="scw-row">
            <span className="scw-row-label">Operation</span>
            <div className="scw-add-card">
              <div className="scw-add-card-header">
                <span>{KIND_OPTIONS.find((o) => o.value === kind)?.icon} {KIND_OPTIONS.find((o) => o.value === kind)?.label}</span>
              </div>
              <div className="scw-add-fields">
                <select value={kind} onChange={(e) => setKind(e.target.value as ChangeKind)}>
                  {KIND_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>

                {kind === "add_column" && (
                  <>
                    <input
                      className="scw-field-col"
                      placeholder="Column name"
                      value={colName}
                      onChange={(e) => setColName(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") addChange(); }}
                    />
                    <select className="scw-field-type" value={colType} onChange={(e) => setColType(e.target.value)}>
                      {COMMON_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </>
                )}

                {kind === "drop_column" && (
                  <select className="scw-field-col" value={renameTarget} onChange={(e) => setRenameTarget(e.target.value)}>
                    <option value="">— select column —</option>
                    {columns.map((c) => <option key={c.name} value={c.name}>{c.name}</option>)}
                  </select>
                )}

                {kind === "rename_column" && (
                  <>
                    <select className="scw-field-col" value={renameTarget} onChange={(e) => setRenameTarget(e.target.value)}>
                      <option value="">— select column —</option>
                      {columns.map((c) => <option key={c.name} value={c.name}>{c.name}</option>)}
                    </select>
                    <input
                      className="scw-field-new"
                      placeholder="New name"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") addChange(); }}
                    />
                  </>
                )}

                {kind === "alter_type" && (
                  <>
                    <select className="scw-field-col" value={renameTarget} onChange={(e) => setRenameTarget(e.target.value)}>
                      <option value="">— select column —</option>
                      {columns.map((c) => <option key={c.name} value={c.name}>{c.name}</option>)}
                    </select>
                    <select className="scw-field-type" value={colType} onChange={(e) => setColType(e.target.value)}>
                      {COMMON_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </>
                )}

                <button className="scw-btn--add" onClick={addChange}>
                  <Plus size={14} /> Add
                </button>
              </div>
            </div>
          </div>

          {changes.length > 0 && (
            <div className="scw-row">
              <span className="scw-row-label">
                Pending Changes ({changes.length})
              </span>
              <ul className="scw-changes">
                {changes.map((c, i) => (
                  <li
                    key={i}
                    className={`scw-change-item${c.kind === "drop_column" ? " scw-change-item--drop" : ""}`}
                  >
                    <span className={`scw-change-kind scw-change-kind--${c.kind}`}>
                      {c.kind === "drop_column" ? <><Trash2 size={10} /> DROP</>
                        : c.kind === "add_column" ? "ADD"
                        : c.kind === "rename_column" ? "RENAME"
                        : "TYPE"}
                    </span>
                    <span className="scw-change-text">{changeLabel(c)}</span>
                    <button className="scw-btn--remove" onClick={() => removeChange(i)} title="Remove">&times;</button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {changes.length === 0 && (
            <div className="scw-empty">
              No pending changes — use the form above to add operations
            </div>
          )}

          {previewSql && (
            <div className="scw-row">
              <span className="scw-row-label">SQL Preview</span>
              <div className="scw-preview">
                <span className="scw-preview-label">Preview</span>
                {previewSql.split("\n").map((line, i) => (
                  <span key={i} className="scw-preview-line">{line}</span>
                ))}
              </div>
            </div>
          )}

          {error && (
            <div className="scw-error">
              <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
              <span>{error}</span>
            </div>
          )}
        </div>

        <div className="dialog-footer">
          <span className="scw-footer-info">
            {changes.length > 0
              ? `${changes.length} change${changes.length > 1 ? "s" : ""} pending`
              : "Add at least one change"}
          </span>
          <div style={{ display: "flex", gap: "var(--space-3)" }}>
            <button ref={cancelRef} className="dialog-btn dialog-btn--cancel" onClick={onClose} disabled={applying}>
              Cancel
            </button>
            <button
              className={`dialog-btn scw-btn--apply${hasDrops ? " scw-btn--apply-warn" : ""}`}
              onClick={handleApply}
              disabled={applying || changes.length === 0}
            >
              {applying ? "Applying…" : hasDrops ? "Apply (includes DROP)" : `Apply Changes`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
