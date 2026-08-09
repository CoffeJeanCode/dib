import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { useConnectionStore } from "@/store/connectionStore";
import { useWorkspaceStore } from "@/store/workspaceStore";
import { useTreeStateStore, treeKey } from "@/store/treeStateStore";
import { safeInvoke as invoke } from "@/shared/utils/ipc";
import { useToastStore } from "@/store/toastStore";
import { dbService } from "@/services/dbService";
import { Table2, Eye, Zap, Cog, Activity } from "lucide-react";
import type { SchemaObjects, TableInfo, TriggerInfo, ColumnInfo } from "@/types/db";
import type { CatKind } from "@/features/Sidebar/Parts/TableContextMenu";

export const CATEGORIES = [
  { key: "tables",     label: "Tables",        Icon: Table2,   color: "#60a5fa", kind: "table"     },
  { key: "views",      label: "Views",          Icon: Eye,      color: "#a78bfa", kind: "view"      },
  { key: "functions",  label: "Functions",      Icon: Zap,      color: "#fbbf24", kind: "function"  },
  { key: "procedures", label: "Procedures",     Icon: Cog,      color: "#34d399", kind: "procedure" },
  { key: "triggers",   label: "Triggers",       Icon: Activity, color: "#f87171", kind: "trigger"   },
] as const;

export type CatKey = typeof CATEGORIES[number]["key"];

export function fmtErr(e: unknown): string {
  if (typeof e === "string") return e;
  if (e && typeof e === "object") {
    const o = e as Record<string, unknown>;
    return String(o.message ?? o.error ?? o.msg ?? JSON.stringify(e));
  }
  return "Unknown error";
}

const SYSTEM_SCHEMAS = new Set(["pg_catalog", "information_schema"]);

export const DDL_TEMPLATES: Record<CatKind, string> = {
  table: `CREATE TABLE new_table (\n  id SERIAL PRIMARY KEY,\n  created_at TIMESTAMP DEFAULT NOW()\n);`,
  view: `CREATE OR REPLACE VIEW new_view AS\nSELECT * FROM tablename;`,
  function: `CREATE OR REPLACE FUNCTION new_function()\nRETURNS void AS $$\nBEGIN\nEND;\n$$ LANGUAGE plpgsql;`,
  procedure: `CREATE OR REPLACE PROCEDURE new_procedure()\nLANGUAGE plpgsql\nAS $$\nBEGIN\nEND;\n$$;`,
  trigger: `CREATE TRIGGER new_trigger\nAFTER INSERT ON tablename\nFOR EACH ROW\nEXECUTE FUNCTION function_name();`,
};

export function useDatabaseCategoriesLogic(props: {
  sessionId: string | null | undefined;
  connectionId?: string | null;
  onTableSelect?: (table: TableInfo) => void;
  onScriptOpen?: (sql: string, title: string, id: string) => void;
}) {
  const { sessionId, connectionId, onTableSelect, onScriptOpen } = props;

  // ── Stale closure guard for toast ──────────────────────────────
  const toastRef = useRef(useToastStore.getState());
  useEffect(() => {
    toastRef.current = useToastStore.getState();
  }, []);

  // ── Stable connection id ──────────────────────────────────────
  const activeSavedId = useConnectionStore((s) =>
    s.active && s.active.activeId === sessionId ? s.active.savedId : null,
  );
  const stableId = connectionId ?? activeSavedId ?? sessionId;

  // ── Schema objects ────────────────────────────────────────────
  const reloadVersion = useConnectionStore((s) => s.reloadVersion);
  const reloadKey = useMemo(() => `${sessionId}:${reloadVersion}`, [sessionId, reloadVersion]);

  const [objects, setObjects] = useState<SchemaObjects | null>(null);
  const [loading, setLoading] = useState(false);

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

  // ── Column loading ────────────────────────────────────────────
  const [columnMap, setColumnMap] = useState<Record<string, ColumnInfo[]>>({});
  const [colLoadingSet, setColLoadingSet] = useState<Set<string>>(new Set());
  const loadedRef = useRef(new Set<string>());

  useEffect(() => {
    setColumnMap({});
    setColLoadingSet(new Set());
    loadedRef.current = new Set();
  }, [sessionId]);

  const loadColumns = useCallback((table: TableInfo) => {
    if (!sessionId) return;
    const key = table.name;
    if (loadedRef.current.has(key)) return;
    loadedRef.current.add(key);

    setColLoadingSet((p) => new Set(p).add(key));
    invoke<ColumnInfo[]>("fetch_table_schema", {
      connectionId: sessionId,
      tableName: table.name,
      schema: table.schema,
    })
      .then((cols) => setColumnMap((p) => ({ ...p, [key]: cols })))
      .catch(() => setColumnMap((p) => ({ ...p, [key]: [] })))
      .finally(() => setColLoadingSet((p) => { const n = new Set(p); n.delete(key); return n; }));
  }, [sessionId]);

  // Rehydration: reload column data for open branches after schema arrives
  const expandedNodes = useTreeStateStore((s) => s.expandedNodes);
  useEffect(() => {
    if (!objects || !sessionId) return;
    const prefix = `dbitem:${String(stableId)}:`;
    const expandedItemNames = new Set<string>();
    for (const [k, v] of Object.entries(expandedNodes)) {
      if (v && k.startsWith(prefix)) expandedItemNames.add(k.slice(prefix.length));
    }
    for (const t of objects.tables) {
      if (expandedItemNames.has(t.name)) loadColumns(t);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [objects, sessionId]);

  const handleExpandClick = useCallback((e: React.MouseEvent, item: TableInfo) => {
    e.stopPropagation();
    useTreeStateStore.getState().toggleNode(treeKey("dbitem", String(stableId), item.name));
    loadColumns(item);
  }, [stableId, loadColumns]);

  // ── DDL loading ───────────────────────────────────────────────
  const [ddlLoading, setDdlLoading] = useState<string | null>(null);

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
      } else if (kind === "procedure") {
        const res = await invoke<{ ddl: string }>("get_function_ddl", { connectionId: sessionId, functionName: name, schema });
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

  const handleGenerateSql = useCallback((item: TableInfo, action: string) => {
    if (!sessionId) return;
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
  }, [sessionId, onScriptOpen]);

  const handleCreateObject = useCallback((kind: CatKind) => {
    const ddl = DDL_TEMPLATES[kind];
    const kindCap = kind.charAt(0).toUpperCase() + kind.slice(1);
    onScriptOpen?.(ddl, `New ${kindCap}`, `new-${kind}-${Date.now()}`);
  }, [onScriptOpen]);

  // ── Rename state ─────────────────────────────────────────────
  const [editingItem, setEditingItem] = useState<{ name: string; schema: string | null; kind: CatKind } | null>(null);
  const [editValue, setEditValue] = useState("");

  const startEditing = useCallback((name: string, schema: string | null, kind: CatKind) => {
    setEditingItem({ name, schema, kind });
    setEditValue(name);
  }, []);

  const cancelEditing = useCallback(() => {
    setEditingItem(null);
    setEditValue("");
  }, []);

  const commitRename = useCallback(async (
    oldName: string,
    schema: string | null,
    kind: CatKind,
    newName: string,
  ) => {
    const trimmed = newName.trim();
    if (!trimmed || trimmed === oldName) { setEditingItem(null); return; }
    const label = schema ? `"${schema}"."${oldName}"` : `"${oldName}"`;
    const newLabel = schema ? `"${schema}"."${trimmed}"` : `"${trimmed}"`;
    try {
      if (kind === "table") await dbService.runQuery(sessionId!, `ALTER TABLE ${label} RENAME TO ${newLabel}`);
      else if (kind === "view") await dbService.runQuery(sessionId!, `ALTER VIEW ${label} RENAME TO ${newLabel}`);
      else if (kind === "function" || kind === "procedure") await dbService.runQuery(sessionId!, `ALTER FUNCTION ${label} RENAME TO ${trimmed}`);
      else if (kind === "trigger") await dbService.runQuery(sessionId!, `ALTER TRIGGER ${label} RENAME TO ${trimmed}`);
      useConnectionStore.getState().triggerReload();
      setEditingItem(null);
    } catch (err: unknown) {
      toastRef.current.error(fmtErr(err));
      setEditingItem(null);
    }
  }, [sessionId]);

  // ── Danger dialog (truncate / drop) ──────────────────────────
  const [dangerDialog, setDangerDialog] = useState<{ message: string; onConfirm: () => Promise<void> } | null>(null);

  // ── Alter table wizard ───────────────────────────────────────
  const [alterTable, setAlterTable] = useState<{ name: string; schema: string | null } | null>(null);

  // ── Active table highlight ───────────────────────────────────
  const storeActiveTable = useWorkspaceStore((s) => s.activeTable);

  // ── Data helpers ─────────────────────────────────────────────
  const itemsFor = useCallback((key: CatKey): (TableInfo | TriggerInfo)[] => {
    if (!objects) return [];
    const all = (objects[key as keyof SchemaObjects] as (TableInfo | TriggerInfo)[]) ?? [];
    return all.filter((it) => {
      const s = (it as TableInfo).schema;
      return s ? !SYSTEM_SCHEMAS.has(s) : true;
    });
  }, [objects]);

  const displayName = useCallback((it: TableInfo | TriggerInfo): string =>
    "trigger_name" in it ? it.trigger_name : it.name,
  []);

  return {
    sessionId,
    stableId: String(stableId),
    objects,
    loading,
    columnMap,
    colLoadingSet,
    ddlLoading,
    editingItem,
    editValue,
    setEditValue,
    dangerDialog,
    setDangerDialog,
    alterTable,
    setAlterTable,
    storeActiveTable,
    itemsFor,
    displayName,
    loadColumns,
    handleExpandClick,
    handleItemClick,
    handleGenerateSql,
    handleCreateObject,
    startEditing,
    cancelEditing,
    commitRename,
  };
}
