import { useState, useEffect, useRef, useCallback, useMemo, type ReactNode } from "react";
import { useDialogFocus } from "@/shared/hooks/useDialogFocus";
import { X, Plus, Trash2, AlertTriangle } from "lucide-react";
import { dbService } from "@/services/dbService";
import { useConnectionStore } from "@/store/connectionStore";
import { useUiStore } from "@/store/uiStore";
import type { SchemaChange, ColumnInfo, CreateColumn } from "@/types/db";
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
  mode?: "alter" | "create";
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

function generateCreateSql(
  tableName: string,
  schema: string | null,
  columns: CreateColumn[],
): string {
  if (columns.length === 0) return "";
  const label = schema ? `"${schema}"."${tableName}"` : `"${tableName}"`;
  const colDefs = columns.map((c) => {
    let def = `  "${c.name}" ${c.data_type}`;
    if (c.is_primary_key) {
      def += " PRIMARY KEY";
    }
    if (!c.is_nullable && !c.is_primary_key) {
      def += " NOT NULL";
    }
    if (c.default_value) {
      def += ` DEFAULT ${c.default_value}`;
    }
    return def;
  });

  const pkCols = columns.filter((c) => c.is_primary_key);
  if (pkCols.length > 1) {
    colDefs.push(`  PRIMARY KEY (${pkCols.map((c) => `"${c.name}"`).join(", ")})`);
  }
  return `CREATE TABLE ${label} (\n${colDefs.join(",\n")}\n);`;
}

function formatCaughtError(e: unknown): string {
  if (e instanceof Error) return e.message || e.name;
  if (typeof e === "string") return e;
  if (e && typeof e === "object" && "message" in e) {
    const msg = (e as { message: unknown }).message;
    if (typeof msg === "string" && msg) return msg;
  }
  try {
    return JSON.stringify(e) || "Unknown error";
  } catch {
    return "Unknown error";
  }
}

function changeKindBadge(kind: SchemaChange["kind"]): ReactNode {
  if (kind === "drop_column") return <><Trash2 size={10} /> DROP</>;
  if (kind === "add_column") return "ADD";
  if (kind === "rename_column") return "RENAME";
  return "TYPE";
}

export function SchemaChangeWizard({ connectionId, tableName: initialTableName, schema, onClose, mode = "alter" }: SchemaChangeWizardProps) {
  const [columns, setColumns] = useState<ColumnInfo[]>([]);
  const [changes, setChanges] = useState<SchemaChange[]>([]);
  const [createCols, setCreateCols] = useState<CreateColumn[]>([]);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tableName, setTableName] = useState(initialTableName);
  const [newColName, setNewColName] = useState("");
  const [newColType, setNewColType] = useState("TEXT");
  const [newColNullable, setNewColNullable] = useState(true);
  const [newColPk, setNewColPk] = useState(false);
  const [newColDefault, setNewColDefault] = useState("");

  const [kind, setKind] = useState<ChangeKind>("add_column");
  const [colName, setColName] = useState("");
  const [colType, setColType] = useState("TEXT");
  const [renameTarget, setRenameTarget] = useState("");
  const [newName, setNewName] = useState("");

  const dialogRef = useRef<HTMLDivElement>(null);

  const setAlterTarget = useUiStore((s) => s.setAlterTarget);
  const setCreateTarget = useUiStore((s) => s.setCreateTarget);

  const handleClose = useCallback(() => {
    useUiStore.setState({ dismissedFromPalette: true });
    onClose();
  }, [onClose]);

  useDialogFocus({
    containerRef: dialogRef,
    onClose: handleClose,
    initialFocusSelector: "[data-dialog-initial-focus]",
  });

  useEffect(() => {
    if (mode === "alter") {
      dbService.fetchTableSchema(connectionId, tableName, schema)
        .then(setColumns)
        .catch(() => {});
    }
  }, [connectionId, tableName, schema, mode]);

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

  const addCreateColumn = useCallback(() => {
    if (!newColName.trim()) return;
    setCreateCols((p) => [...p, {
      name: newColName.trim(),
      data_type: newColType,
      is_primary_key: newColPk,
      is_nullable: newColNullable,
      default_value: newColDefault || null,
    }]);
    setNewColName("");
    setNewColType("TEXT");
    setNewColNullable(true);
    setNewColPk(false);
    setNewColDefault("");
  }, [newColName, newColType, newColNullable, newColPk, newColDefault]);

  const removeCreateColumn = useCallback((idx: number) => {
    setCreateCols((p) => p.filter((_, i) => i !== idx));
  }, []);

  const removeChange = useCallback((idx: number) => {
    setChanges((p) => p.filter((_, i) => i !== idx));
  }, []);

  const hasDrops = useMemo(() => changes.some((c) => c.kind === "drop_column"), [changes]);

  const handleApply = useCallback(async () => {
    if (mode === "alter") {
      if (changes.length === 0) return;
      setApplying(true);
      setError(null);
      try {
        await dbService.applySchemaChanges(connectionId, tableName, schema, changes);
        useConnectionStore.getState().triggerReload();
        setAlterTarget(null);
        onClose();
      } catch (e: unknown) {
        setError(formatCaughtError(e));
      } finally {
        setApplying(false);
      }
    } else {
      if (createCols.length === 0 || !tableName.trim()) return;
      setApplying(true);
      setError(null);
      try {
        await dbService.createTable(connectionId, tableName.trim(), schema, createCols);
        useConnectionStore.getState().triggerReload();
        setCreateTarget(null);
        onClose();
      } catch (e: unknown) {
        setError(formatCaughtError(e));
      } finally {
        setApplying(false);
      }
    }
  }, [mode, changes, createCols, connectionId, tableName, schema, onClose, setAlterTarget, setCreateTarget]);

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
    () => mode === "alter"
      ? generateAlterSql(tableName, schema, changes)
      : generateCreateSql(tableName, schema, createCols),
    [mode, tableName, schema, changes, createCols],
  );

  const label = schema ? `${schema}.${tableName}` : tableName;

  const applyLabel = (() => {
    if (applying) return "Applying…";
    if (mode === "create") return "Create Table";
    if (hasDrops) return "Apply (includes DROP)";
    return "Apply Changes";
  })();

  return (
    <div className="dialog-backdrop">
      <div ref={dialogRef} className="dialog scw" role="dialog" aria-modal="true">
        <div className="dialog-header">
          <span className="dialog-title">{mode === "create" ? "Create Table" : "Alter Table"}</span>
          <button type="button" className="dialog-close" onClick={handleClose} aria-label="Close">
            <X />
          </button>
        </div>

        <div className="dialog-body">
          {mode === "create" ? (
            <div className="scw-row">
              <span className="scw-row-label">Table Name</span>
              <input
                className="scw-field-col"
                style={{ width: "100%" }}
                placeholder="table_name"
                value={tableName}
                onChange={(e) => setTableName(e.target.value)}
              />
            </div>
          ) : (
            <div className="scw-table-name">{label}</div>
          )}

          {mode === "alter" && columns.length > 0 && (
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
                    {c.name}
                    <span className="scw-col-type">{c.data_type}</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {mode === "alter" && (
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

                  <button type="button" className="scw-btn--add" onClick={addChange}>
                    <Plus size={14} /> Add
                  </button>
                </div>
              </div>
            </div>
          )}

          {mode === "create" && (
            <div className="scw-row">
              <span className="scw-row-label">Add Column</span>
              <div className="scw-add-card">
                <div className="scw-add-card-header">
                  <span>+ New Column</span>
                </div>
                <div className="scw-add-fields">
                  <input
                    className="scw-field-col"
                    placeholder="Column name"
                    value={newColName}
                    onChange={(e) => setNewColName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") addCreateColumn(); }}
                  />
                  <select className="scw-field-type" value={newColType} onChange={(e) => setNewColType(e.target.value)}>
                    {COMMON_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                  <label className="scw-checkbox-label">
                    <input type="checkbox" checked={newColPk} onChange={(e) => setNewColPk(e.target.checked)} />
                    <span>PK</span>
                  </label>
                  <label className="scw-checkbox-label">
                    <input
                      type="checkbox"
                      checked={!newColNullable}
                      onChange={(e) => setNewColNullable(!e.target.checked)}
                    />
                    <span>NN</span>
                  </label>
                  <input
                    className="scw-field-default"
                    placeholder="Default"
                    value={newColDefault}
                    onChange={(e) => setNewColDefault(e.target.value)}
                  />
                  <button type="button" className="scw-btn--add" onClick={addCreateColumn}>
                    <Plus size={14} /> Add
                  </button>
                </div>
              </div>
            </div>
          )}

          {mode === "alter" && changes.length > 0 && (
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
                      {changeKindBadge(c.kind)}
                    </span>
                    <span className="scw-change-text">{changeLabel(c)}</span>
                    <button
                      type="button"
                      className="scw-btn--remove"
                      onClick={() => removeChange(i)}
                      title="Remove"
                    >
                      &times;
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {mode === "create" && createCols.length > 0 && (
            <div className="scw-row">
              <span className="scw-row-label">
                Columns ({createCols.length})
              </span>
              <ul className="scw-changes">
                {createCols.map((c, i) => (
                  <li key={i} className="scw-change-item">
                    <span className="scw-change-kind scw-change-kind--add_column">
                      {c.is_primary_key ? "PK" : "COL"}
                    </span>
                    <span className="scw-change-text">
                      {c.name} {c.data_type}{!c.is_nullable ? " NOT NULL" : ""}{c.default_value ? ` DEFAULT ${c.default_value}` : ""}
                    </span>
                    <button
                      type="button"
                      className="scw-btn--remove"
                      onClick={() => removeCreateColumn(i)}
                      title="Remove"
                    >
                      &times;
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {mode === "alter" && changes.length === 0 && (
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
            {mode === "alter"
              ? (changes.length > 0
                ? `${changes.length} change${changes.length > 1 ? "s" : ""} pending`
                : "Add at least one change")
              : (createCols.length > 0
                ? `${createCols.length} column${createCols.length > 1 ? "s" : ""} defined`
                : "Add at least one column")}
          </span>
          <div style={{ display: "flex", gap: "var(--space-3)" }}>
            <button
              type="button"
              data-dialog-initial-focus
              className="dialog-btn dialog-btn--cancel"
              onClick={handleClose}
              disabled={applying}
            >
              Cancel
            </button>
            <button
              type="button"
              className={`dialog-btn scw-btn--apply${mode === "alter" && hasDrops ? " scw-btn--apply-warn" : ""}`}
              onClick={handleApply}
              disabled={
                applying ||
                (mode === "alter" ? changes.length === 0 : createCols.length === 0 || !tableName.trim())
              }
            >
              {applyLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
