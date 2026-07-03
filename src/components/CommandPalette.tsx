import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { isMac } from "@/utils/platform";
import { useWorkspaceStore } from "@/store/workspaceStore";
import { useConnectionStore } from "@/store/connectionStore";
import { Search, Table2, FileText, Zap, Database, Trash2, Scissors, Edit3, ChevronLeft, Loader2, Eye, Activity, Network, Wrench, PlusSquare, Rows } from "lucide-react";
import type { TableInfo, InternalScript } from "@/types/db";
import { dbService } from "@/services/dbService";
import { workspaceService } from "@/services/workspaceService";
import { useDangerDialog } from "@/hooks/useDangerDialog";
import { useToastStore } from "@/store/toastStore";
import { useUiStore } from "@/store/uiStore";
import "@/shared/ui/dialog-shared.css";
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

type DdlMode = "drop" | "truncate" | "rename" | "alter" | "insert" | null;

type DbObjectSubtype = "view" | "mat_view" | "function" | "procedure" | "trigger";

type PaletteItem =
  | { kind: "table";    id: string; label: string; table: TableInfo; matchedAlias?: string }
  | { kind: "script";   id: string; label: string; script: InternalScript }
  | { kind: "action";   id: string; label: string; onAction: () => void }
  | { kind: "database"; id: string; label: string; dbName: string }
  | { kind: "object";   id: string; label: string; subtype: DbObjectSubtype; name: string; schema: string | null }
  | { kind: "diagram";  id: string; label: string; table: TableInfo }
  | { kind: "ddl";      id: string; label: string; action: "alter" | "create"; table: TableInfo }
  | { kind: "dml";      id: string; label: string; action: "insert"; table: TableInfo };

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
  diagram:  <Network size={16} />,
  ddl:      <Wrench size={16} />, // Render logic will override this based on action
  dml:      <Rows size={16} />,
};

const ITEM_CATEGORY: Record<PaletteItem["kind"], string> = {
  table:    "Table",
  script:   "Script",
  action:   "Action",
  database: "Database",
  object:   "DB Object",
  diagram:  "ERD Diagram",
  ddl:      "Structure",
  dml:      "Data",
};

const DDL_MODE_META: Record<NonNullable<DdlMode>, { label: string; icon: React.ReactNode; danger: boolean; hint: string }> = {
  drop:     { label: "DROP TABLE",     icon: <Trash2   size={14} />, danger: true,  hint: "↵ Confirm delete" },
  truncate: { label: "TRUNCATE TABLE", icon: <Scissors size={14} />, danger: true,  hint: "↵ Confirm truncate" },
  rename:   { label: "RENAME TABLE",   icon: <Edit3    size={14} />, danger: false, hint: "↵ Rename table" },
  alter:    { label: "ALTER TABLE",    icon: <Wrench   size={14} />, danger: false, hint: "↵ Open Schema Wizard" },
  insert:   { label: "INSERT ROW",     icon: <PlusSquare size={14} />, danger: false, hint: "↵ Insert row" },
};

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  actions?: CommandAction[];
}

export function CommandPalette({
  open,
  onClose,
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
  const connectionId = useConnectionStore((s) => s.active?.activeId ?? null);
  const info = useToastStore((s) => s.info);
  const error = useToastStore((s) => s.error);
  const { handleDropTable, handleTruncateTable } = useDangerDialog(connectionId, info, error);
  const recentCommands = useUiStore((s) => s.recentCommands);
  const pushToRecents = useUiStore((s) => s.pushToRecents);



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

    // Scripts are not fetched into local state — they're read live from
    // useWorkspaceStore (single source of truth shared with the Sidebar).
    // Just make sure the store has the latest data.
    workspaceService.getInternalScripts()
      .then((scripts) => useWorkspaceStore.getState().setInternalScripts(scripts))
      .catch(console.error);

    // Standalone virtual scripts live in virtual_scripts keyed by the STABLE
    // saved-connection id — same source the Sidebar tree reads, so both stay
    // in sync.
    const savedId = useConnectionStore.getState().active?.savedId;
    if (savedId) {
      workspaceService.getVirtualScripts(savedId)
        .then((rows) => setVirtualScripts(
          rows.map((r) => ({
            id: r.id,
            title: r.name,
            content: r.content ?? "",
            created_at: r.created_at ?? "",
            updated_at: r.updated_at ?? "",
            connection_id: r.connection_id,
          })),
        ))
        .catch(() => setVirtualScripts([]));
    } else {
      setVirtualScripts([]);
    }

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
            
            for (const t of obj.triggers ?? []) {
              const label = t.schema ? `${t.schema}.${t.trigger_name}` : t.trigger_name;
              const uniqueId = `obj:trigger:${label}:${t.table_name}`;
              next.push({
                kind: "object",
                id: uniqueId,
                label: `${label} on ${t.table_name}`,
                subtype: "trigger",
                name: t.trigger_name,
                schema: t.schema ?? null,
              });
            }
          })
          .catch(() => {}),
      );
    }

    Promise.all(loaders).then(() => {
      setBaseItems([...next]);
      setLoading(false);
    });
  }, [open, connectionId]);

  // Single source of truth: same array Sidebar reads, kept live via scriptVersion.
  const internalScripts = useWorkspaceStore((s) => s.internalScripts);
  const [virtualScripts, setVirtualScripts] = useState<InternalScript[]>([]);
  const scriptItems = useMemo<PaletteItem[]>(
    () => [...virtualScripts, ...internalScripts].map(
      (s) => ({ kind: "script" as const, id: `s:${s.id}`, label: s.title, script: s }),
    ),
    [internalScripts, virtualScripts],
  );

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
    { kind: "action", id: "dml:insert",   label: "Insert Row…",     onAction: () => enterDdlMode("insert") },
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
      const recent = recentCommands.map((rc) => {
        if (rc.type === "action") return actionItems.find(a => a.id === rc.id);
        if (rc.type === "table") return baseItems.find(b => b.kind === "table" && b.id === rc.id);
        if (rc.type === "script") return scriptItems.find(s => s.id === rc.id);
        if (rc.type === "database") return baseItems.find(b => b.kind === "database" && b.id === rc.id);
        if (rc.type === "object") return baseItems.find(b => b.kind === "object" && b.id === rc.id);
        if (rc.type === "diagram") return { kind: "diagram", id: rc.id, label: rc.label, table: rc.table };
        if (rc.type === "ddl") return { kind: "ddl", id: rc.id, label: rc.label, action: rc.action, table: rc.table };
        if (rc.type === "dml") return { kind: "dml", id: rc.id, label: rc.label, action: rc.action, table: rc.table };
        return null;
      }).filter(Boolean) as PaletteItem[];
      
      if (recent.length > 0) return recent;
      return connectionId
        ? [...actionItems, ...baseItems.filter(i => i.kind === "table")].slice(0, 5)
        : [...actionItems, ...scriptItems].slice(0, 5);
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
      return rest ? scriptItems.filter((i) => i.label.toLowerCase().includes(rest)) : scriptItems;
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
  }, [query, baseItems, scriptItems, actions, ddlActionItems, ddlMode]);

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
        if (ddlMode === "drop")     handleDropTable(item.table);
        if (ddlMode === "truncate") handleTruncateTable(item.table);
        if (ddlMode === "rename")   import("@/store/uiStore").then(m => m.useUiStore.getState().setRenameTarget(item.table));
        if (ddlMode === "alter") {
          import("@/store/uiStore").then(m => m.useUiStore.getState().setAlterTarget(item.table));
          pushToRecents({ type: "ddl", id: `ddl:alter:${item.id}`, label: `Alter ${item.table.name}`, action: "alter", table: item.table });
        }
        if (ddlMode === "insert") {
          useWorkspaceStore.getState().setNavigateTo({ table: item.table, v: Date.now() } as any);
          useWorkspaceStore.getState().triggerInsertRow();
          pushToRecents({ type: "dml", id: `dml:insert:${item.id}`, label: `Insert ${item.table.name}`, action: "insert", table: item.table });
        }
        onClose();
        return;
      }
      
      if (item.kind === "diagram") {
        useWorkspaceStore.getState().openTableRelations(item.table);
        pushToRecents({ type: "diagram", id: item.id, label: item.label, table: item.table });
        onClose();
        return;
      }
      
      if (item.kind === "ddl" && item.action === "alter") {
        import("@/store/uiStore").then(m => m.useUiStore.getState().setAlterTarget(item.table));
        pushToRecents({ type: "ddl", id: item.id, label: item.label, action: item.action, table: item.table });
        onClose();
        return;
      }
      
      if (item.kind === "dml" && item.action === "insert") {
        useWorkspaceStore.getState().setNavigateTo({ table: item.table, v: Date.now() } as any);
        useWorkspaceStore.getState().triggerInsertRow();
        pushToRecents({ type: "dml", id: item.id, label: item.label, action: item.action, table: item.table });
        onClose();
        return;
      }

      if (item.kind === "table") {
        useWorkspaceStore.getState().setNavigateTo({ table: item.table, v: Date.now() } as any);
        pushToRecents({ type: "table", id: item.id, label: item.label, table: item.table });
      }
      else if (item.kind === "script") {
        useWorkspaceStore.getState().setOpenScript({ sql: item.script.content, name: item.script.title, id: item.script.id, v: Date.now() } as any);
        pushToRecents({ type: "script", id: item.id, label: item.label, script: item.script });
      }
      else if (item.kind === "database") {
        useConnectionStore.getState().switchDatabase(item.dbName);
        pushToRecents({ type: "database", id: item.id, label: item.label, dbName: item.dbName });
      }
      else if (item.kind === "object" && connectionId) {
        const { subtype, name, schema } = item;
        const fetcher =
          subtype === "view" || subtype === "mat_view" ? dbService.getViewDdl(connectionId, name, schema)
          : subtype === "function"  ? dbService.getFunctionDdl(connectionId, name, schema)
          : subtype === "procedure" ? dbService.getFunctionDdl(connectionId, name, schema)
          : subtype === "trigger"   ? dbService.getTriggerDdl(connectionId, name, schema)
          : Promise.resolve({ ddl: "" });
        fetcher.then((res) => useWorkspaceStore.getState().setOpenScript({ sql: res.ddl, name: `${OBJECT_TAG[subtype]}·${name}`, id: `obj-${item.id}`, v: Date.now() } as any)).catch(() => {});
        pushToRecents({ type: "object", id: item.id, label: item.label, subtype, name, schema });
      }
      else if (item.kind === "action") {
        item.onAction();
        pushToRecents({ type: "action", id: item.id, label: item.label });
      }
      onClose();
    },
    [ddlMode, handleDropTable, handleTruncateTable, connectionId, onClose, pushToRecents],
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
        const item = filtered[selectedIndex] as { kind: "table"; id: string; label: string; table: TableInfo };
        useWorkspaceStore.getState().openTableRelations(item.table);
        pushToRecents({ type: "diagram", id: `diagram:${item.id}`, label: `Diagram: ${item.table.name}`, table: item.table });
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
    [filtered, selectedIndex, execute, ddlMode, onClose, pushToRecents],
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
    <div className="dialog-backdrop palette-backdrop" onClick={onClose}>
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
              const isRecentView = !ddlMode && isEmpty && recentCommands.length > 0;
              const prevItem = i > 0 ? filtered[i - 1] : null;
              const showHeader = ddlMode
                ? i === 0
                : isRecentView ? i === 0 : (!prevItem || prevItem.kind !== item.kind);
              const headerText = ddlMode
                ? "TABLES"
                : isRecentView ? "RECENT" : (isEmpty ? "SUGGESTIONS" : ITEM_CATEGORY[item.kind].toUpperCase());

              let hintText = "↵ Select";
              if (ddlMode && item.kind === "table") hintText = currentDdlMeta?.hint ?? "↵";
              else if (item.kind === "table")    hintText = isMac ? "↵ Open · ⌥↵ ERD · ⌃↵ Structure" : "↵ Open · Alt+↵ ERD · Ctrl+↵ Structure";
              else if (item.kind === "script")   hintText = "↵ Run Script";
              else if (item.kind === "database") hintText = "↵ Switch DB";
              else if (item.kind === "action")   hintText = "↵ Execute";
              else if (item.kind === "object")   hintText = `↵ View DDL [${OBJECT_TAG[item.subtype]}]`;
              else if (item.kind === "diagram")  hintText = "↵ Open ERD";
              else if (item.kind === "ddl")      hintText = item.action === "create" ? "↵ Create DB" : "↵ Alter Table";
              else if (item.kind === "dml")      hintText = "↵ Insert row";

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
                        : item.kind === "ddl" ? (item.action === "create" ? <PlusSquare size={16} /> : <Wrench size={16} />)
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
