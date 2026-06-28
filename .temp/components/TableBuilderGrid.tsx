import { useState, useCallback, useEffect } from "react";
import { dbService } from "@/services/dbService";
import { Plus, Trash2, Check, RotateCcw } from "lucide-react";
import type { ColumnInfo, SchemaChange } from "@/types/db";
import { useKeybindings } from "@/hooks/useKeybindings";
import "./TableBuilderGrid.css";

interface BuilderRow {
  rowKey: string;
  originalName: string; // "" for new rows
  name: string;
  data_type: string;
  is_primary_key: boolean;
  is_nullable: boolean;
  default_value: string;
  isDeleted: boolean;
}

function fromColumnInfo(c: ColumnInfo): BuilderRow {
  return {
    rowKey: c.name,
    originalName: c.name,
    name: c.name,
    data_type: c.data_type,
    is_primary_key: c.is_primary_key,
    is_nullable: c.is_nullable,
    default_value: "",
    isDeleted: false,
  };
}

function computeChanges(original: ColumnInfo[], current: BuilderRow[]): SchemaChange[] {
  const changes: SchemaChange[] = [];
  const origMap = new Map(original.map((c) => [c.name, c]));

  for (const row of current) {
    if (row.isDeleted) {
      if (row.originalName) changes.push({ kind: "drop_column", column: row.originalName });
      continue;
    }
    if (!row.originalName) {
      if (!row.name.trim()) continue;
      changes.push({
        kind: "add_column",
        column: row.name.trim(),
        data_type: row.data_type || "text",
        nullable: row.is_nullable,
        default_value: row.default_value || undefined,
      });
      continue;
    }
    const orig = origMap.get(row.originalName);
    if (!orig) continue;
    // Order matters: rename first so subsequent changes use correct column name
    if (row.name.trim() && row.name.trim() !== row.originalName) {
      changes.push({ kind: "rename_column", column: row.originalName, new_column: row.name.trim() });
    }
    if (row.data_type && row.data_type !== orig.data_type) {
      changes.push({ kind: "alter_type", column: row.originalName, data_type: row.data_type });
    }
    if (row.is_nullable !== orig.is_nullable) {
      changes.push({ kind: "set_nullable", column: row.originalName, nullable: row.is_nullable });
    }
  }
  return changes;
}

const COMMON_TYPES = [
  "text", "varchar(255)", "integer", "bigint", "smallint", "serial", "bigserial",
  "boolean", "date", "timestamp", "timestamptz", "numeric", "float8", "uuid", "jsonb", "json",
];

interface TableBuilderGridProps {
  tableName: string;
  schema: string | null;
  connectionId: string;
  engine: string;
  columnInfos: ColumnInfo[];
  onSchemaChanged?: () => void;
}

export function TableBuilderGrid({ tableName, schema, connectionId, columnInfos, onSchemaChanged }: TableBuilderGridProps) {
  const [rows, setRows] = useState<BuilderRow[]>(() => columnInfos.map(fromColumnInfo));
  const [committing, setCommitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  // Re-init when columnInfos change (e.g. after a successful apply)
  useEffect(() => {
    setRows(columnInfos.map(fromColumnInfo));
  }, [columnInfos]);

  const changes = computeChanges(columnInfos, rows);
  const isDirty = changes.length > 0;

  const patchRow = useCallback((rowKey: string, patch: Partial<BuilderRow>) => {
    setRows((prev) => prev.map((r) => r.rowKey === rowKey ? { ...r, ...patch } : r));
  }, []);

  const addRow = useCallback(() => {
    const newRow: BuilderRow = {
      rowKey: `__new__${Date.now()}`,
      originalName: "",
      name: "",
      data_type: "text",
      is_primary_key: false,
      is_nullable: true,
      default_value: "",
      isDeleted: false,
    };
    setRows((prev) => [...prev, newRow]);
  }, []);

  const revert = useCallback(() => {
    setRows(columnInfos.map(fromColumnInfo));
    setError(null);
  }, [columnInfos]);

  const applyChanges = useCallback(async () => {
    if (!isDirty || committing) return;
    setCommitting(true);
    setError(null);
    try {
      await dbService.applySchemaChanges(connectionId, tableName, schema ?? null, changes);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      onSchemaChanged?.();
    } catch (e: unknown) {
      const msg = e && typeof e === "object" && "message" in e
        ? String((e as Record<string, unknown>).message)
        : String(e);
      setError(msg);
    } finally {
      setCommitting(false);
    }
  }, [isDirty, committing, connectionId, tableName, schema, changes, onSchemaChanged]);

  useKeybindings([{ combo: "ctrl+s", handler: applyChanges }]);
  useKeybindings([{ combo: "ctrl+z", handler: revert }]);

  const visibleRows = rows.filter((r) => !r.isDeleted);
  const deletedCount = rows.filter((r) => r.isDeleted && r.originalName).length;

  return (
    <div className="tbg">
      <div className="tbg-toolbar">
        <span className="tbg-title">
          Estructura: <strong>{tableName}</strong>
        </span>
        <button className="tbg-add-btn" onClick={addRow} title="Agregar columna (Ctrl+N)">
          <Plus size={13} /> Columna
        </button>
      </div>

      {error && <div className="tbg-error">{error}</div>}

      <div className="tbg-grid-wrap">
        <div className="tbg-grid">
          {/* Header */}
          <div className="tbg-header-row">
            <div className="tbg-th" style={{ width: 200 }}>Nombre</div>
            <div className="tbg-th" style={{ width: 180 }}>Tipo</div>
            <div className="tbg-th tbg-th--center" style={{ width: 46 }}>PK</div>
            <div className="tbg-th tbg-th--center" style={{ width: 60 }}>Nullable</div>
            <div className="tbg-th" style={{ flex: 1 }}>Default</div>
            <div className="tbg-th" style={{ width: 36 }} />
          </div>

          {/* Rows */}
          {visibleRows.map((row) => {
            const isModified = row.originalName && (
              row.name !== row.originalName ||
              row.data_type !== (columnInfos.find((c) => c.name === row.originalName)?.data_type ?? "") ||
              row.is_nullable !== (columnInfos.find((c) => c.name === row.originalName)?.is_nullable ?? true)
            );
            return (
              <div
                key={row.rowKey}
                className={`tbg-row${!row.originalName ? " tbg-row--new" : isModified ? " tbg-row--modified" : ""}`}
              >
                <div className="tbg-cell" style={{ width: 200 }}>
                  <input
                    className="tbg-input"
                    value={row.name}
                    onChange={(e) => patchRow(row.rowKey, { name: e.target.value })}
                    placeholder="nombre_columna"
                  />
                </div>
                <div className="tbg-cell" style={{ width: 180 }}>
                  <input
                    className="tbg-input tbg-input--mono"
                    list={`tbg-types-${row.rowKey}`}
                    value={row.data_type}
                    onChange={(e) => patchRow(row.rowKey, { data_type: e.target.value })}
                    placeholder="text"
                  />
                  <datalist id={`tbg-types-${row.rowKey}`}>
                    {COMMON_TYPES.map((t) => <option key={t} value={t} />)}
                  </datalist>
                </div>
                <div className="tbg-cell tbg-cell--center" style={{ width: 46 }}>
                  <input
                    type="checkbox"
                    checked={row.is_primary_key}
                    onChange={(e) => patchRow(row.rowKey, { is_primary_key: e.target.checked })}
                    disabled={!!row.originalName} // can't change PK via ALTER TABLE easily
                    title={row.originalName ? "PK no modificable via ALTER TABLE" : ""}
                  />
                </div>
                <div className="tbg-cell tbg-cell--center" style={{ width: 60 }}>
                  <input
                    type="checkbox"
                    checked={row.is_nullable}
                    onChange={(e) => patchRow(row.rowKey, { is_nullable: e.target.checked })}
                  />
                </div>
                <div className="tbg-cell" style={{ flex: 1 }}>
                  <input
                    className="tbg-input"
                    value={row.default_value}
                    onChange={(e) => patchRow(row.rowKey, { default_value: e.target.value })}
                    placeholder="NULL"
                    disabled={!!row.originalName}
                    title={row.originalName ? "Default solo para columnas nuevas" : ""}
                  />
                </div>
                <div className="tbg-cell tbg-cell--center" style={{ width: 36 }}>
                  <button
                    className="tbg-delete-btn"
                    title={row.originalName ? "Eliminar columna" : "Cancelar"}
                    onClick={() =>
                      row.originalName
                        ? patchRow(row.rowKey, { isDeleted: true })
                        : setRows((prev) => prev.filter((r) => r.rowKey !== row.rowKey))
                    }
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            );
          })}

          {deletedCount > 0 && (
            <div className="tbg-deleted-note">
              {deletedCount} columna{deletedCount > 1 ? "s" : ""} marcada{deletedCount > 1 ? "s" : ""} para eliminar
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="tbg-footer">
        <span className="tbg-changes-count">
          {isDirty
            ? `${changes.length} cambio${changes.length > 1 ? "s" : ""} pendiente${changes.length > 1 ? "s" : ""}`
            : "Sin cambios"}
        </span>
        {saved && (
          <span className="tbg-saved"><Check size={12} /> Aplicado</span>
        )}
        <div className="tbg-footer-actions">
          <button className="tbg-revert-btn" onClick={revert} disabled={!isDirty || committing} title="Revertir (Ctrl+Z)">
            <RotateCcw size={13} /> Revertir
          </button>
          <button
            className="tbg-apply-btn"
            onClick={applyChanges}
            disabled={!isDirty || committing}
            title="Aplicar cambios (Ctrl+S)"
          >
            <Check size={13} />
            {committing ? "Aplicando…" : "Aplicar DDL"}
          </button>
        </div>
      </div>
    </div>
  );
}
