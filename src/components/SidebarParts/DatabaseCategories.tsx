import { useState, useCallback, useEffect, useRef, useContext } from "react";
import {
  ChevronRight, Table2, Eye, Zap, Cog, Activity,
  LogOut, Database as DbIcon, Network, Pencil, Trash2, Layers,
  Key, Hash, Type, Calendar,
} from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import type { SchemaObjects, TableInfo, TriggerInfo, ColumnInfo } from "../../types/db";
import { ToastContext } from "../../App";
import { ContextMenu } from "../ContextMenu";
import { DangerConfirmDialog } from "../DangerConfirmDialog";
import { useContextMenu } from "../../hooks/useContextMenu";

interface DatabaseCategoriesProps {
  sessionId: string | null | undefined;
  connectionName?: string;
  onTableSelect?: (table: TableInfo) => void;
  onScriptOpen?: (sql: string, title: string, id: string) => void;
  onDatabaseSwitch?: (db: string) => void;
  onDisconnect?: () => void;
}

const CATEGORIES = [
  { key: "tables",     label: "Tablas",        Icon: Table2,   color: "#60a5fa", kind: "table"     },
  { key: "views",      label: "Vistas",         Icon: Eye,      color: "#a78bfa", kind: "view"      },
  { key: "functions",  label: "Funciones",      Icon: Zap,      color: "#fbbf24", kind: "function"  },
  { key: "procedures", label: "Procedimientos", Icon: Cog,      color: "#34d399", kind: "procedure" },
  { key: "triggers",   label: "Triggers",       Icon: Activity, color: "#f87171", kind: "trigger"   },
] as const;

type CatKey = typeof CATEGORIES[number]["key"];
type CatKind = typeof CATEGORIES[number]["kind"];

function colIcon(col: ColumnInfo) {
  if (col.is_primary_key) return <Key size={10} className="dbcat-col-icon dbcat-col-icon--pk" />;
  const t = col.data_type.toUpperCase();
  if (/INT|FLOAT|NUMERIC|DECIMAL|REAL|DOUBLE|SERIAL|NUMBER/.test(t))
    return <Hash size={10} className="dbcat-col-icon dbcat-col-icon--num" />;
  if (/DATE|TIME|TIMESTAMP/.test(t))
    return <Calendar size={10} className="dbcat-col-icon dbcat-col-icon--date" />;
  return <Type size={10} className="dbcat-col-icon dbcat-col-icon--text" />;
}

function fmtErr(e: unknown): string {
  if (typeof e === "string") return e;
  if (e && typeof e === "object") {
    const o = e as Record<string, unknown>;
    return String(o.message ?? o.error ?? o.msg ?? JSON.stringify(e));
  }
  return "Error desconocido";
}

export function DatabaseCategories({
  sessionId,
  connectionName,
  onTableSelect,
  onScriptOpen,
  onDatabaseSwitch,
  onDisconnect,
}: DatabaseCategoriesProps) {
  const toast = useContext(ToastContext);
  // ponytail: ref avoids toast identity in useEffect deps → prevents infinite refetch
  const toastRef = useRef(toast);
  useEffect(() => { toastRef.current = toast; });

  const [open, setOpen] = useState<Record<string, boolean>>({
    tables: true, views: false, functions: false, procedures: false, triggers: false,
  });
  const [objects, setObjects] = useState<SchemaObjects | null>(null);
  const [loading, setLoading] = useState(false);
  const [ddlLoading, setDdlLoading] = useState<string | null>(null);
  const [databases, setDatabases] = useState<string[]>([]);
  const [columnMap, setColumnMap] = useState<Record<string, ColumnInfo[]>>({});
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [colLoadingSet, setColLoadingSet] = useState<Set<string>>(new Set());
  const [activeTable, setActiveTable] = useState<{ name: string; schema: string | null } | null>(null);
  const [dangerDialog, setDangerDialog] = useState<{ message: string; onConfirm: () => void } | null>(null);

  const { menuState, openMenu, closeMenu } = useContextMenu();
  const [contextItem, setContextItem] = useState<TableInfo | null>(null);

  // Track active table tab from QueryPanel
  useEffect(() => {
    const handler = (e: Event) => {
      setActiveTable((e as CustomEvent<{ name: string; schema: string | null } | null>).detail);
    };
    window.addEventListener("dib:active-table", handler);
    return () => window.removeEventListener("dib:active-table", handler);
  }, []);

  const toggle = useCallback((cat: string) => {
    setOpen((prev) => ({ ...prev, [cat]: !prev[cat] }));
  }, []);

  useEffect(() => {
    if (!sessionId) { setObjects(null); setDatabases([]); return; }
    let cancelled = false;
    const load = () => {
      setObjects(null);
      setLoading(true);
      invoke<SchemaObjects>("fetch_schema_objects", { connectionId: sessionId })
        .then((o) => { if (!cancelled) setObjects(o); })
        .catch((e) => { if (!cancelled) toastRef.current.error(fmtErr(e)); })
        .finally(() => { if (!cancelled) setLoading(false); });
    };
    load();
    invoke<string[]>("list_databases", { connectionId: sessionId })
      .then((dbs) => { if (!cancelled) setDatabases(dbs); })
      .catch(() => {});
    window.addEventListener("dib:reload", load);
    return () => { cancelled = true; window.removeEventListener("dib:reload", load); };
  }, [sessionId]);

  useEffect(() => {
    setColumnMap({});
    setExpandedItems(new Set());
    setColLoadingSet(new Set());
  }, [sessionId]);

  const loadColumns = useCallback((table: TableInfo) => {
    if (!sessionId || columnMap[table.name] !== undefined) return;
    const key = table.name;
    setColLoadingSet((p) => new Set(p).add(key));
    invoke<ColumnInfo[]>("fetch_table_schema", {
      connectionId: sessionId,
      tableName: table.name,
      schema: table.schema,
    })
      .then((cols) => setColumnMap((p) => ({ ...p, [key]: cols })))
      .catch(() => setColumnMap((p) => ({ ...p, [key]: [] })))
      .finally(() => setColLoadingSet((p) => { const n = new Set(p); n.delete(key); return n; }));
  }, [sessionId, columnMap]);

  const handleExpandClick = useCallback((e: React.MouseEvent, item: TableInfo) => {
    e.stopPropagation();
    setExpandedItems((prev) => {
      const next = new Set(prev);
      if (next.has(item.name)) { next.delete(item.name); return next; }
      next.add(item.name);
      return next;
    });
    loadColumns(item);
  }, [loadColumns]);

  const handleItemClick = useCallback(async (kind: CatKind, item: TableInfo | TriggerInfo) => {
    if (!sessionId) return;
    if (kind === "table" || kind === "view") {
      onTableSelect?.(item as TableInfo);
      return;
    }
    const name = "trigger_name" in item ? item.trigger_name : (item as TableInfo).name;
    const schema = "schema" in item ? (item as TableInfo).schema : null;
    const loadKey = `${kind}-${name}`;
    setDdlLoading(loadKey);
    try {
      let ddl: string;
      if (kind === "trigger") {
        const res = await invoke<{ ddl: string }>("get_trigger_ddl", { connectionId: sessionId, triggerName: name, schema });
        ddl = res.ddl;
      } else {
        const res = await invoke<{ ddl: string }>("get_function_ddl", { connectionId: sessionId, functionName: name, schema });
        ddl = res.ddl;
      }
      onScriptOpen?.(ddl, name, `ddl-${kind}-${name}-${Date.now()}`);
    } catch (e) {
      toastRef.current.error(fmtErr(e));
    } finally {
      setDdlLoading(null);
    }
  }, [sessionId, onTableSelect, onScriptOpen]);

  const handleContextMenu = useCallback((e: React.MouseEvent, item: TableInfo) => {
    e.preventDefault();
    e.stopPropagation();
    setContextItem(item);
    openMenu(e);
  }, [openMenu]);

  const handleGenerateSql = useCallback((action: string) => {
    const item = contextItem;
    setContextItem(null); closeMenu();
    if (!item || !sessionId) return;
    const label = action === "select" ? `SELECT ${item.name}`
      : action === "ddl" ? `DDL ${item.name}`
      : action === "insert" ? `INSERT ${item.name}`
      : `UPDATE ${item.name}`;
    invoke<string>("generate_crud_sql", {
      connectionId: sessionId,
      tableName: item.name,
      schema: item.schema,
      action,
    })
      .then((sql) => onScriptOpen?.(sql, label, `gen-${action}-${item.name}-${Date.now()}`))
      .catch((e) => toastRef.current.error(fmtErr(e)));
  }, [contextItem, sessionId, onScriptOpen, closeMenu]);

  if (!sessionId) {
    return (
      <div className="sidebar-db-categories">
        <span className="sidebar-item-text sidebar-item-text--muted" style={{ padding: "12px 16px", display: "block" }}>
          Sin conexión activa
        </span>
      </div>
    );
  }

  const itemsFor = (key: CatKey): (TableInfo | TriggerInfo)[] => {
    if (!objects) return [];
    return (objects[key as keyof SchemaObjects] as (TableInfo | TriggerInfo)[]) ?? [];
  };

  const displayName = (it: TableInfo | TriggerInfo): string =>
    "trigger_name" in it ? it.trigger_name : it.name;

  return (
    <div className="sidebar-db-categories">
      {/* DB header: inline switcher + disconnect */}
      <div className="sidebar-db-tree-header">
        <DbIcon size={13} className="sidebar-db-tree-header-icon" />
        {databases.length > 1 ? (
          <select
            className="sidebar-db-tree-select"
            value={connectionName ?? ""}
            onChange={(e) => onDatabaseSwitch?.(e.target.value)}
            title="Cambiar Base de Datos"
          >
            {databases.map((db) => (
              <option key={db} value={db}>{db}</option>
            ))}
          </select>
        ) : (
          <span className="sidebar-db-tree-name" title={connectionName}>{connectionName}</span>
        )}
        {onDisconnect && (
          <button className="sidebar-db-disconnect" onClick={onDisconnect} title="Desconectar">
            <LogOut size={13} />
          </button>
        )}
      </div>

      {/* Category tree */}
      {CATEGORIES.map((cat) => {
        const items = itemsFor(cat.key);
        if (objects && items.length === 0) return null;
        const CatIcon = cat.Icon;
        const canExpand = cat.kind === "table" || cat.kind === "view";
        return (
          <div key={cat.key} className="sidebar-db-category">
            <button className="sidebar-section-toggle" onClick={() => toggle(cat.key)}>
              <ChevronRight
                size={12}
                className={`sidebar-chevron${open[cat.key] ? " sidebar-chevron--open" : ""}`}
              />
              <CatIcon size={13} style={{ color: cat.color, flexShrink: 0 }} />
              <span className="sidebar-section-title" style={{ margin: 0 }}>{cat.label}</span>
              {objects && <span className="sidebar-section-count">{items.length}</span>}
            </button>
            {open[cat.key] && (
              <div className="sidebar-db-category-items">
                {loading ? (
                  <span className="sidebar-item-text sidebar-item-text--muted" style={{ paddingLeft: 24 }}>
                    Cargando…
                  </span>
                ) : (
                  items.map((it) => {
                    const name = displayName(it);
                    const schema = "schema" in it ? (it as TableInfo).schema : null;
                    const isLoading = ddlLoading === `${cat.kind}-${name}`;
                    const isActive = canExpand && activeTable?.name === name && activeTable?.schema === schema;
                    const isExpanded = expandedItems.has(name);
                    const cols = columnMap[name];
                    const colsLoading = colLoadingSet.has(name);
                    return (
                      <div key={`${schema ?? ""}.${name}`}>
                        <div
                          className={`sidebar-db-item${isActive ? " sidebar-db-item--active" : ""}`}
                          title={schema ? `${schema}.${name}` : name}
                          onClick={() => !isLoading && handleItemClick(cat.kind, it)}
                          onContextMenu={canExpand ? (e) => handleContextMenu(e, it as TableInfo) : undefined}
                          role="button"
                          tabIndex={0}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              if (!isLoading) handleItemClick(cat.kind, it);
                            }
                          }}
                        >
                          {canExpand ? (
                            <button
                              className={`sidebar-db-item-chevron${isExpanded ? " sidebar-db-item-chevron--open" : ""}`}
                              onClick={(e) => handleExpandClick(e, it as TableInfo)}
                              aria-label={isExpanded ? "Colapsar" : "Expandir"}
                              tabIndex={-1}
                            >
                              <ChevronRight size={11} />
                            </button>
                          ) : (
                            <span style={{ width: 16, flexShrink: 0 }} />
                          )}
                          <CatIcon size={11} style={{ color: cat.color, flexShrink: 0, opacity: 0.75 }} />
                          <span className="sidebar-db-item-name">
                            {isLoading ? `${name}…` : name}
                          </span>
                        </div>
                        {canExpand && isExpanded && (
                          <div className="sidebar-db-col-list">
                            {colsLoading ? (
                              <div className="sidebar-db-col-item sidebar-db-col-item--muted">…</div>
                            ) : !cols || cols.length === 0 ? (
                              <div className="sidebar-db-col-item sidebar-db-col-item--muted">Sin columnas</div>
                            ) : (
                              cols.map((col) => (
                                <div key={col.name} className="sidebar-db-col-item">
                                  {colIcon(col)}
                                  <span className="sidebar-db-col-name">{col.name}</span>
                                  <span className="sidebar-db-col-type">{col.data_type}</span>
                                </div>
                              ))
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>
        );
      })}

      <ContextMenu
        open={menuState.open}
        x={menuState.x}
        y={menuState.y}
        items={[
          {
            icon: <Layers size={14} />,
            label: "Ver Estructura",
            onClick: () => {
              const t = contextItem; setContextItem(null); closeMenu();
              if (t) window.dispatchEvent(new CustomEvent("dib:open-table-structure", { detail: t }));
            },
          },
          {
            icon: <Network size={14} />,
            label: "Visualizar Relaciones",
            onClick: () => {
              const t = contextItem; setContextItem(null); closeMenu();
              if (t) window.dispatchEvent(new CustomEvent("dib:open-table-relations", { detail: t }));
            },
          },
          { icon: <Table2 size={14} />,  label: "Generar SELECT",            onClick: () => handleGenerateSql("select") },
          { icon: <Table2 size={14} />,  label: "Generar DDL (CREATE TABLE)", onClick: () => handleGenerateSql("ddl")    },
          { icon: <Pencil size={14} />,  label: "Generar INSERT",             onClick: () => handleGenerateSql("insert") },
          { icon: <Pencil size={14} />,  label: "Generar UPDATE",             onClick: () => handleGenerateSql("update") },
          {
            icon: <Trash2 size={14} />,
            label: "Vaciar Tabla (TRUNCATE)",
            danger: true,
            onClick: () => {
              const t = contextItem; setContextItem(null); closeMenu();
              if (t) onScriptOpen?.(
                `TRUNCATE TABLE ${t.schema ? `"${t.schema}".` : ""}"${t.name}";`,
                `TRUNCATE ${t.name}`,
                `truncate-${t.name}-${Date.now()}`,
              );
            },
          },
          {
            icon: <Trash2 size={14} />,
            label: "DROP TABLE",
            danger: true,
            onClick: () => {
              const t = contextItem; setContextItem(null); closeMenu();
              if (!t || !sessionId) return;
              const label = t.schema ? `${t.schema}.${t.name}` : t.name;
              setDangerDialog({
                message: `¿Eliminar tabla "${label}"? Esta acción no se puede deshacer.`,
                onConfirm: () => {
                  setDangerDialog(null);
                  invoke("drop_table", { connectionId: sessionId, tableName: t.name, schema: t.schema })
                    .then(() => {
                      toastRef.current.info(`Tabla "${label}" eliminada`);
                      window.dispatchEvent(new CustomEvent("dib:reload"));
                    })
                    .catch((e) => toastRef.current.error(fmtErr(e)));
                },
              });
            },
          },
        ]}
        onClose={() => { setContextItem(null); closeMenu(); }}
      />
      {dangerDialog && (
        <DangerConfirmDialog
          message={dangerDialog.message}
          onConfirm={dangerDialog.onConfirm}
          onCancel={() => setDangerDialog(null)}
        />
      )}
    </div>
  );
}
