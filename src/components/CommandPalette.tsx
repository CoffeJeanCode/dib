import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useWorkspaceStore } from "@/store/workspaceStore";
import { Search, Table2, FileText, Zap, Database, Trash2, Scissors, Edit3, Workflow, ChevronLeft, Loader2, Eye, Activity } from "lucide-react";
import type { TableInfo, InternalScript } from "@/types/db";
import { dbService } from "@/services/dbService";
import { workspaceService } from "@/services/workspaceService";
import "./CommandPalette.css";

export function generateOrmAlias(tableName: string): string {
  return tableName
    .split("_")
    .filter(Boolean)
    .map((block) => block[0])
    .join("")
    .toLowerCase();
}

export interface CommandAction {
  id: string;
  label: string;
  onAction: () => void;
}

type DdlMode = "drop" | "truncate" | "rename" | "alter" | null;

type DbObjectSubtype = "view" | "mat_view" | "function" | "procedure" | "trigger";

type PaletteItem =
  | { kind: "table";    id: string; label: string; table: TableInfo; matchedAlias?: string }
  | { kind: "script";   id: string; label: string; script: InternalScript }
  | { kind: "action";   id: string; label: string; onAction: () => void }
  | { kind: "database"; id: string; label: string; dbName: string }
  | { kind: "object";   id: string; label: string; subtype: DbObjectSubtype; name: string; schema: string | null };

const OBJECT_ICON: Record<DbObjectSubtype, React.ReactNode> = {
  view:      <Eye      size={16} />,
  mat_view:  <Eye      size={16} />,
  function:  <Zap      size={16} />,
  procedure: <Zap      size={16} />,
  trigger:   <Activity size={16} />,
};

const OBJECT_TAG: Record<DbObjectSubtype, string> = {
  view:      "view",
  mat_view:  "mat",
  function:  "fn",
  procedure: "proc",
  trigger:   "trg",
};

const ITEM_ICON: Record<PaletteItem["kind"], React.ReactNode> = {
  table:    <Table2 size={16} />,
  script:   <FileText size={16} />,
  action:   <Zap size={16} />,
  database: <Database size={16} />,
  object:   <Eye size={16} />,
};

const ITEM_CATEGORY: Record<PaletteItem["kind"], string> = {
  table:    "Table",
  script:   "Script",
  action:   "Action",
  database: "Database",
  object:   "DB Object",
};

const DDL_MODE_META: Record<NonNullable<DdlMode>, { label: string; icon: React.ReactNode; danger: boolean; hint: string }> = {
  drop:     { label: "DROP TABLE",     icon: <Trash2   size={14} />, danger: true,  hint: "↵ Confirm delete" },
  truncate: { label: "TRUNCATE TABLE", icon: <Scissors size={14} />, danger: true,  hint: "↵ Confirm truncate" },
  rename:   { label: "RENAME TABLE",   icon: <Edit3    size={14} />, danger: false, hint: "↵ Rename table" },
  alter:    { label: "ALTER TABLE",    icon: <Workflow size={14} />, danger: false, hint: "↵ Open Schema Wizard" },
};

type DbActionType = "create" | "rename" | "drop";

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  connectionId?: string | null;
  onTableSelect?: (table: TableInfo) => void;
  onScriptOpen?: (sql: string, name: string, id?: string) => void;
  onDatabaseSwitch?: (dbName: string) => void;
  onDropTable?: (table: TableInfo) => void;
  onTruncateTable?: (table: TableInfo) => void;
  onRenameTable?: (table: TableInfo) => void;
  onAlterTable?: (table: TableInfo) => void;
  onDbAction?: (action: DbActionType) => void;
  actions?: CommandAction[];
}

export function CommandPalette({
  open,
  onClose,
  connectionId,
  onTableSelect,
  onScriptOpen,
  onDatabaseSwitch,
  onDropTable,
  onTruncateTable,
  onRenameTable,
  onAlterTable,
  actions = [],
}: CommandPaletteProps) {
  const [query, setQuery]               = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [baseItems, setBaseItems]       = useState<PaletteItem[]>([]);
  const [loading, setLoading]           = useState(false);
  const [ddlMode, setDdlMode]           = useState<DdlMode>(null);
  const inputRef        = useRef<HTMLInputElement>(null);
  const resultsRef      = useRef<HTMLDivElement>(null);
  const pointerActiveRef = useRef(false);
  
  const [recentIds, setRecentIds] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem("dib_recent_palette_ids");
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  const saveRecentId = useCallback((id: string) => {
    setRecentIds((prev) => {
      const next = [id, ...prev.filter((existingId) => existingId !== id)].slice(0, 5);
      try {
        localStorage.setItem("dib_recent_palette_ids", JSON.stringify(next));
      } catch (e) {
        console.error("Failed to save recent ids", e);
      }
      return next;
    });
  }, []);

  useEffect(() => {
    if (!resultsRef.current) return;
    const el = resultsRef.current.querySelector(`[data-palette-index="${selectedIndex}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  useEffect(() => {
    if (!open) {
      setDdlMode(null);
      setBaseItems([]);
      return;
    }
    setQuery("");
    setSelectedIndex(0);
    setLoading(true);
    setBaseItems([]);
    setTimeout(() => inputRef.current?.focus(), 50);

    const next: PaletteItem[] = [];
    const loaders: Promise<void>[] = [];

    if (connectionId) {
      loaders.push(
        dbService.listDatabases(connectionId)
          .then((dbs) => {
            for (const db of dbs) {
              next.push({ kind: "database", id: `db:${db}`, label: db, dbName: db });
            }
          })
          .catch(() => {}),
      );
      loaders.push(
        dbService.fetchSchemaObjects(connectionId)
          .then((obj) => {
            for (const t of obj.tables ?? []) {
              const label = t.schema ? `${t.schema}.${t.name}` : t.name;
              next.push({ kind: "table", id: `t:${label}`, label, table: t });
            }
            const pushObj = (subtype: DbObjectSubtype, items: { name: string; schema?: string | null }[]) => {
              for (const it of items) {
                const label = it.schema ? `${it.schema}.${it.name}` : it.name;
                next.push({ kind: "object", id: `obj:${subtype}:${label}`, label, subtype, name: it.name, schema: it.schema ?? null });
              }
            };
            pushObj("view",      obj.views ?? []);
            pushObj("mat_view",  obj.materialized_views ?? []);
            pushObj("function",  obj.functions ?? []);
            pushObj("procedure", obj.procedures ?? []);
            pushObj("trigger",   (obj.triggers ?? []).map(t => ({ name: t.trigger_name, schema: t.schema })));
          })
          .catch(() => {}),
      );
    }

    loaders.push(
      workspaceService.getInternalScripts()
        .then((scripts) => {
          for (const s of scripts) {
            next.push({ kind: "script", id: `s:${s.id}`, label: s.title, script: s });
          }
        })
        .catch(console.error),
    );

    Promise.all(loaders).then(() => {
      setBaseItems([...next]);
      setLoading(false);
    });
  }, [open, connectionId]);

  const enterDdlMode = useCallback((mode: NonNullable<DdlMode>) => {
    setDdlMode(mode);
    setQuery("");
    setSelectedIndex(0);
    pointerActiveRef.current = false;
    setTimeout(() => inputRef.current?.focus(), 0);
  }, []);

  // DDL static actions — built-in, appear under > prefix and in suggestions
  const ddlActionItems = useMemo<PaletteItem[]>(() => connectionId ? [
    { kind: "action", id: "ddl:drop",     label: "Drop Table…",     onAction: () => enterDdlMode("drop") },
    { kind: "action", id: "ddl:truncate", label: "Truncate Table…", onAction: () => enterDdlMode("truncate") },
    { kind: "action", id: "ddl:rename",   label: "Rename Table…",   onAction: () => enterDdlMode("rename") },
    { kind: "action", id: "ddl:alter",    label: "Alter Table…",    onAction: () => enterDdlMode("alter") },
  ] : [], [connectionId, enterDdlMode]);

  const filtered = useMemo<PaletteItem[]>(() => {
    // DDL sub-mode: show only tables
    if (ddlMode) {
      const pool = baseItems.filter((i) => i.kind === "table");
      const q = query.trim().toLowerCase();
      return q ? pool.filter((i) => i.label.toLowerCase().includes(q)) : pool;
    }

    const actionItems: PaletteItem[] = [
      ...actions.map((a) => ({ kind: "action" as const, id: `a:${a.id}`, label: a.label, onAction: a.onAction })),
      ...ddlActionItems,
    ];

    const q = query.trim();
    if (!q) {
      const allItems = [...baseItems, ...actionItems];
      const recent = recentIds.map((id) => allItems.find((i) => i.id === id)).filter(Boolean) as PaletteItem[];
      if (recent.length > 0) return recent;
      return connectionId
        ? [...actionItems, ...baseItems.filter(i => i.kind === "table")].slice(0, 5)
        : [...actionItems, ...baseItems.filter(i => i.kind === "script")].slice(0, 5);
    }

    const symbol = q[0];
    const rest = q.slice(1).toLowerCase().trim();

    if (symbol === ">") {
      const pool = [...actionItems];
      return rest ? pool.filter((i) => i.label.toLowerCase().includes(rest)) : pool;
    }
    if (symbol === "@") {
      const pool = baseItems.filter((i) => i.kind === "database");
      return rest ? pool.filter((i) => i.label.toLowerCase().includes(rest)) : pool;
    }
    if (symbol === "#") {
      const pool = baseItems.filter((i) => i.kind === "script");
      return rest ? pool.filter((i) => i.label.toLowerCase().includes(rest)) : pool;
    }
    if (symbol === "%") {
      const pool = baseItems.filter((i) => i.kind === "object");
      return rest ? pool.filter((i) => i.label.toLowerCase().includes(rest) || (i.kind === "object" && OBJECT_TAG[i.subtype].includes(rest))) : pool;
    }

    // No prefix → tables with ORM alias priority
    const pool = baseItems.filter((i) => i.kind === "table");
    const qLower = q.toLowerCase();
    const aliasMatches: PaletteItem[] = [];
    const textMatches: PaletteItem[] = [];
    for (const item of pool) {
      const alias = generateOrmAlias(item.table.name);
      if (alias === qLower) aliasMatches.push({ ...item, matchedAlias: alias });
      else if (item.label.toLowerCase().includes(qLower)) textMatches.push(item);
    }
    return [...aliasMatches, ...textMatches];
  }, [query, baseItems, actions, ddlActionItems, ddlMode]);

  useEffect(() => { setSelectedIndex(0); }, [query, ddlMode]);

  const execute = useCallback(
    async (item: PaletteItem) => {
      // DDL mode-switch actions stay open
      if (item.kind === "action" && item.id.startsWith("ddl:")) {
        item.onAction();
        return;
      }

      // DDL sub-mode table selection
      if (ddlMode && item.kind === "table") {
        if (ddlMode === "drop")     onDropTable?.(item.table);
        if (ddlMode === "truncate") onTruncateTable?.(item.table);
        if (ddlMode === "rename")   onRenameTable?.(item.table);
        if (ddlMode === "alter")    onAlterTable?.(item.table);
        onClose();
        return;
      }

      saveRecentId(item.id);
      if (item.kind === "table")         onTableSelect?.(item.table);
      else if (item.kind === "script")   onScriptOpen?.(item.script.content, item.script.title, item.script.id);
      else if (item.kind === "database") onDatabaseSwitch?.(item.dbName);
      else if (item.kind === "object" && connectionId) {
        const { subtype, name, schema } = item;
        const fetcher =
          subtype === "view" || subtype === "mat_view" ? dbService.getViewDdl(connectionId, name, schema)
          : subtype === "function"  ? dbService.getFunctionDdl(connectionId, name, schema)
          : subtype === "procedure" ? dbService.getFunctionDdl(connectionId, name, schema)
          : subtype === "trigger"   ? dbService.getTriggerDdl(connectionId, name, schema)
          : Promise.resolve({ ddl: "" });
        fetcher.then((res) => onScriptOpen?.(res.ddl, `${OBJECT_TAG[subtype]}·${name}`, `obj-${item.id}`)).catch(() => {});
      }
      else if (item.kind === "action") item.onAction();
      onClose();
    },
    [ddlMode, onDropTable, onTruncateTable, onRenameTable, onAlterTable, onTableSelect, onScriptOpen, onDatabaseSwitch, onClose, saveRecentId],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        pointerActiveRef.current = false;
        setSelectedIndex((i) => Math.min(i + 1, filtered.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        pointerActiveRef.current = false;
        setSelectedIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter" && e.altKey && filtered[selectedIndex]?.kind === "table") {
        // Alt+Enter → open ERD for focused table
        e.preventDefault();
        useWorkspaceStore.getState().openTableRelations(filtered[selectedIndex].table!);
        onClose();
      } else if (e.key === "Enter" && (e.ctrlKey || e.metaKey) && filtered[selectedIndex]?.kind === "table") {
        useWorkspaceStore.getState().openTableStructure(filtered[selectedIndex].table!);
        onClose();
      } else if (e.key === "Enter" && filtered[selectedIndex]) {
        execute(filtered[selectedIndex]);
      } else if (e.key === "Escape") {
        // handled by global handler — stop native event so it doesn't double-fire
        e.nativeEvent.stopImmediatePropagation();
        if (ddlMode) { setDdlMode(null); setQuery(""); }
        else onClose();
      }
    },
    [filtered, selectedIndex, execute, ddlMode, onClose],
  );

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (ddlMode) { setDdlMode(null); setQuery(""); }
      else onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, ddlMode, onClose]);

  if (!open) return null;

  const isEmpty = query.trim() === "" && !ddlMode;
  const currentDdlMeta = ddlMode ? DDL_MODE_META[ddlMode] : null;

  return (
    <div className="palette-backdrop" onClick={onClose}>
      <div className="palette" onClick={(e) => e.stopPropagation()}>
        {/* DDL sub-mode indicator */}
        {ddlMode && currentDdlMeta && (
          <div className={`palette-ddl-bar${currentDdlMeta.danger ? " palette-ddl-bar--danger" : " palette-ddl-bar--alter"}`}>
            <button className="palette-ddl-back" onClick={() => { setDdlMode(null); setQuery(""); }} title="Back (Esc)">
              <ChevronLeft size={14} />
            </button>
            <span className="palette-ddl-icon">{currentDdlMeta.icon}</span>
            <span className="palette-ddl-label">{currentDdlMeta.label}</span>
            <span className="palette-ddl-hint">— type to filter · ↑↓ navigate · ↵ apply</span>
          </div>
        )}

        <div className="palette-input-wrap">
          <Search size={16} className="palette-input-icon" />
          <input
            ref={inputRef}
            className="palette-input"
            type="text"
            placeholder={
              ddlMode ? "Filter tables…"
              : connectionId ? "Tables · > actions · @ db · # scripts · % views/fn/triggers"
              : "> actions · # scripts"
            }
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
          />
        </div>

        <div className="palette-results" ref={resultsRef}>
          {loading ? (
            <div className="palette-empty">
              <Loader2 size={16} className="palette-spinner" />
              <span>Loading…</span>
            </div>
          ) : filtered.length === 0 ? (
            <div className="palette-empty">No results</div>
          ) : (
            filtered.map((item, i) => {
              const isRecentView = !ddlMode && isEmpty && recentIds.length > 0;
              const prevItem = i > 0 ? filtered[i - 1] : null;
              const showHeader = ddlMode
                ? i === 0
                : isRecentView ? i === 0 : (!prevItem || prevItem.kind !== item.kind);
              const headerText = ddlMode
                ? "TABLES"
                : isRecentView ? "RECENT" : (isEmpty ? "SUGGESTIONS" : ITEM_CATEGORY[item.kind].toUpperCase());

              let hintText = "↵ Select";
              if (ddlMode && item.kind === "table") hintText = currentDdlMeta?.hint ?? "↵";
              else if (item.kind === "table")    hintText = "↵ Open · ⌥↵ ERD · ⌃↵ Structure";
              else if (item.kind === "script")   hintText = "↵ Run Script";
              else if (item.kind === "database") hintText = "↵ Switch DB";
              else if (item.kind === "action")   hintText = "↵ Execute";
              else if (item.kind === "object")   hintText = `↵ View DDL [${OBJECT_TAG[item.subtype]}]`;

              const isDdlAction = item.kind === "action" && item.id.startsWith("ddl:");
              const isDangerItem = ddlMode === "drop" || ddlMode === "truncate";

              return (
                <React.Fragment key={item.id}>
                  {showHeader && <div className="palette-group-header">{headerText}</div>}
                  <div
                    data-palette-index={i}
                    className={[
                      "palette-item",
                      i === selectedIndex ? "palette-item--selected" : "",
                      isDangerItem && item.kind === "table" ? "palette-item--danger" : "",
                      isDdlAction ? "palette-item--ddl" : "",
                    ].filter(Boolean).join(" ")}
                    onClick={() => execute(item)}
                    onPointerMove={() => { pointerActiveRef.current = true; setSelectedIndex(i); }}
                  >
                    <span className={`palette-item-icon${item.kind === "action" || item.kind === "database" ? " palette-item-icon--action" : ""}`}>
                      {ddlMode && item.kind === "table" ? currentDdlMeta?.icon
                        : item.kind === "object" ? OBJECT_ICON[item.subtype]
                        : ITEM_ICON[item.kind]}
                    </span>
                    <span className="palette-item-label">{item.label}</span>
                    <span className="palette-item-shortcut">{hintText}</span>
                  </div>
                </React.Fragment>
              );
            })
          )}
        </div>

        {filtered.length > 0 && (
          <div className="palette-footer">
            <span className="palette-footer-hint"><kbd>↑↓</kbd> navigate</span>
            <span className="palette-footer-hint"><kbd>↵</kbd> select</span>
            {ddlMode
              ? <span className="palette-footer-hint"><kbd>esc</kbd> back</span>
              : <span className="palette-footer-hint"><kbd>esc</kbd> close</span>
            }
          </div>
        )}
      </div>
    </div>
  );
}
