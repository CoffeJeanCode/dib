import { useState, useCallback, useEffect, useRef, useContext, useMemo } from "react";
import { useConnectionStore } from "@/store/connectionStore";
import { useWorkspaceStore } from "@/store/workspaceStore";
import {
  ChevronRight, Table2, Eye, Zap, Cog, Activity,
  Network, Pencil, Trash2, Layers, Workflow,
  Key, Hash, Type, Calendar,
} from "lucide-react";
import { safeInvoke as invoke } from "@/utils/ipc";
import type { SchemaObjects, TableInfo, TriggerInfo, ColumnInfo } from "@/types/db";
import { ToastContext } from "@/App";
import { ContextMenu } from "@/components/ContextMenu";
import { DangerConfirmDialog } from "@/components/DangerConfirmDialog";
import { RenameDialog } from "@/components/RenameDialog";
import { SchemaChangeWizard } from "@/features/SchemaChangeWizard/SchemaChangeWizard";
import { useContextMenu } from "@/hooks/useContextMenu";

interface DatabaseCategoriesProps {
  sessionId: string | null | undefined;
  onTableSelect?: (table: TableInfo) => void;
  onScriptOpen?: (sql: string, title: string, id: string) => void;
}

const CATEGORIES = [
  { key: "tables",     label: "Tables",        Icon: Table2,   color: "#60a5fa", kind: "table"     },
  { key: "views",      label: "Views",          Icon: Eye,      color: "#a78bfa", kind: "view"      },
  { key: "functions",  label: "Functions",      Icon: Zap,      color: "#fbbf24", kind: "function"  },
  { key: "procedures", label: "Procedures",     Icon: Cog,      color: "#34d399", kind: "procedure" },
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
  onTableSelect,
  onScriptOpen,
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
  const [columnMap, setColumnMap] = useState<Record<string, ColumnInfo[]>>({});
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [colLoadingSet, setColLoadingSet] = useState<Set<string>>(new Set());
  const [activeTable, setActiveTable] = useState<{ name: string; schema: string | null } | null>(null);
  const [dangerDialog, setDangerDialog] = useState<{ message: string; onConfirm: () => void } | null>(null);
  const [alterTable, setAlterTable] = useState<{ name: string; schema: string | null } | null>(null);

  const { menuState, openMenu, closeMenu } = useContextMenu();
  const [contextItem, setContextItem] = useState<TableInfo | null>(null);
  const [renameTarget, setRenameTarget] = useState<{ name: string; schema: string | null; kind: CatKind } | null>(null);

  const nonTableMenu = useContextMenu();
  const [nonTableContextItem, setNonTableContextItem] = useState<{ name: string; schema: string | null; kind: CatKind } | null>(null);

  // Track active table tab from workspaceStore — replaces dib:active-table
  const storeActiveTable = useWorkspaceStore((s) => s.activeTable);
  useEffect(() => { setActiveTable(storeActiveTable); }, [storeActiveTable]);

  const toggle = useCallback((cat: string) => {
    setOpen((prev) => ({ ...prev, [cat]: !prev[cat] }));
  }, []);

  // Reload schema when sessionId changes or reloadVersion increments — replaces dib:reload
  const reloadVersion = useConnectionStore((s) => s.reloadVersion);
  const reloadKey = useMemo(() => `${sessionId}:${reloadVersion}`, [sessionId, reloadVersion]);
  useEffect(() => {
    if (!sessionId) { setObjects(null); return; }
    let cancelled = false;
    setObjects(null);
    setLoading(true);
    invoke<SchemaObjects>("fetch_schema_objects", { connectionId: sessionId })
      .then((o) => { if (!cancelled) setObjects(o); })
      .catch((e) => { if (!cancelled) toastRef.current.error(fmtErr(e)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reloadKey]);

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
    if (kind === "table") {
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
      } else if (kind === "function") {
        const res = await invoke<{ ddl: string }>("get_function_ddl", { connectionId: sessionId, functionName: name, schema });
        ddl = res.ddl;
      } else if (kind === "view") {
        const res = await invoke<{ ddl: string }>("get_view_ddl", { connectionId: sessionId, viewName: name, schema });
        ddl = res.ddl;
      } else {
        return;
      }
      onScriptOpen?.(ddl, name, `ddl-${kind}-${name}-${Date.now()}`);
    } catch (e) {
      toastRef.current.error(fmtErr(e));
    } finally {
      setDdlLoading(null);
    }
  }, [sessionId, onTableSelect, onScriptOpen]);

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
          No active connection
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
                    Loading…
                  </span>
                ) : (
                  items.map((it, idx) => {
                    const name = displayName(it);
                    const schema = "schema" in it ? (it as TableInfo).schema : null;
                    const isLoading = ddlLoading === `${cat.kind}-${name}`;
                    const isActive = canExpand && activeTable?.name === name && activeTable?.schema === schema;
                    const isExpanded = expandedItems.has(name);
                    const cols = columnMap[name];
                    const colsLoading = colLoadingSet.has(name);
                    return (
                      <div key={`${schema ?? ""}.${name}.${idx}`}>
                        <div
                          className={`sidebar-db-item${isActive ? " sidebar-db-item--active" : ""}`}
                          title={schema ? `${schema}.${name}` : name}
                          onClick={() => !isLoading && handleItemClick(cat.kind, it)}
                          onContextMenu={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            if (canExpand) {
                              setContextItem(it as TableInfo);
                              openMenu(e);
                            } else if (cat.kind !== "trigger") {
                              setNonTableContextItem({ name, schema, kind: cat.kind as CatKind });
                              nonTableMenu.openMenu(e);
                            }
                          }}
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
            label: "View Structure",
            onClick: () => {
              const t = contextItem; setContextItem(null); closeMenu();
              if (t) useWorkspaceStore.getState().openTableStructure(t);
            },
          },
          {
            icon: <Network size={14} />,
            label: "View Relations",
            onClick: () => {
              const t = contextItem; setContextItem(null); closeMenu();
              if (t) useWorkspaceStore.getState().openTableRelations(t);
            },
          },
          {
            icon: <Pencil size={14} />,
            label: "Rename",
            onClick: () => {
              const t = contextItem; setContextItem(null); closeMenu();
              if (t && sessionId) setRenameTarget({ name: t.name, schema: t.schema, kind: "table" });
            },
          },
          {
            icon: <Workflow size={14} />,
            label: "Alter Table (Schema)",
            onClick: () => {
              const t = contextItem; setContextItem(null); closeMenu();
              if (t && sessionId) setAlterTable(t);
            },
          },
          { icon: <Table2 size={14} />,  label: "Generate SELECT",            onClick: () => handleGenerateSql("select") },
          { icon: <Table2 size={14} />,  label: "Generate DDL (CREATE TABLE)", onClick: () => handleGenerateSql("ddl")    },
          { icon: <Pencil size={14} />,  label: "Generate INSERT",             onClick: () => handleGenerateSql("insert") },
          { icon: <Pencil size={14} />,  label: "Generate UPDATE",             onClick: () => handleGenerateSql("update") },
          {
            icon: <Trash2 size={14} />,
            label: "Truncate Table (TRUNCATE)",
            danger: true,
            onClick: () => {
              const t = contextItem; setContextItem(null); closeMenu();
              if (!t || !sessionId) return;
              const label = t.schema ? `"${t.schema}"."${t.name}"` : `"${t.name}"`;
              setDangerDialog({
                message: `Truncate table "${label}"? This will delete ALL rows.`,
                onConfirm: async () => {
                  setDangerDialog(null);
                  try {
                    await invoke("run_query", {
                      connectionId: sessionId,
                      sql: `TRUNCATE TABLE ${label}`,
                    });
                    toastRef.current.info(`Table "${label}" truncated`);
                    useConnectionStore.getState().triggerReload();
                  } catch (e) { toastRef.current.error(fmtErr(e)); }
                },
              });
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
                message: `Delete table "${label}"? This action cannot be undone.`,
                onConfirm: () => {
                  setDangerDialog(null);
                  invoke("drop_table", { connectionId: sessionId, tableName: t.name, schema: t.schema })
                    .then(() => {
                      toastRef.current.info(`Table "${label}" deleted`);
                      useConnectionStore.getState().triggerReload();
                    })
                    .catch((e) => toastRef.current.error(fmtErr(e)));
                },
              });
            },
          },
        ]}
        onClose={() => { setContextItem(null); closeMenu(); }}
      />

      {/* Non-table object context menu (views, functions, procedures) */}
      <ContextMenu
        open={nonTableMenu.menuState.open}
        x={nonTableMenu.menuState.x}
        y={nonTableMenu.menuState.y}
        items={[
          {
            icon: <Eye size={14} />,
            label: "View DDL",
            onClick: () => {
              const item = nonTableContextItem; setNonTableContextItem(null); nonTableMenu.closeMenu();
              if (item && sessionId) handleItemClick(item.kind, item as unknown as TableInfo & TriggerInfo);
            },
          },
          {
            icon: <Pencil size={14} />,
            label: "Rename",
            onClick: () => {
              const item = nonTableContextItem; setNonTableContextItem(null); nonTableMenu.closeMenu();
              if (item && sessionId) setRenameTarget(item);
            },
          },
          {
            icon: <Trash2 size={14} />,
            label: "Drop",
            danger: true,
            onClick: () => {
              const item = nonTableContextItem; setNonTableContextItem(null); nonTableMenu.closeMenu();
              if (!item || !sessionId) return;
              const label = item.schema ? `"${item.schema}"."${item.name}"` : `"${item.name}"`;
              const dropVerb = item.kind === "view" ? "VIEW" : item.kind === "function" ? "FUNCTION" : "PROCEDURE";
              setDangerDialog({
                message: `Drop ${item.kind} "${label}"? This action cannot be undone.`,
                onConfirm: async () => {
                  setDangerDialog(null);
                  try {
                    await invoke("run_query", {
                      connectionId: sessionId,
                      sql: `DROP ${dropVerb} IF EXISTS ${label}`,
                    });
                    toastRef.current.info(`${dropVerb} "${label}" dropped`);
                    useConnectionStore.getState().triggerReload();
                  } catch (e) { toastRef.current.error(fmtErr(e)); }
                },
              });
            },
          },
        ]}
        onClose={() => { setNonTableContextItem(null); nonTableMenu.closeMenu(); }}
      />

      {dangerDialog && (
        <DangerConfirmDialog
          message={dangerDialog.message}
          onConfirm={dangerDialog.onConfirm}
          onCancel={() => setDangerDialog(null)}
        />
      )}
      {renameTarget && sessionId && (
        <RenameDialog
          connectionId={sessionId}
          entityType={renameTarget.kind}
          entityName={renameTarget.name}
          schema={renameTarget.schema}
          onClose={() => setRenameTarget(null)}
        />
      )}
      {alterTable && sessionId && (
        <SchemaChangeWizard
          connectionId={sessionId}
          tableName={alterTable.name}
          schema={alterTable.schema}
          onClose={() => setAlterTable(null)}
        />
      )}
    </div>
  );
}
