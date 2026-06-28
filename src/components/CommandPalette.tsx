import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Search, Table2, FileText, Zap, Database, Trash2, Scissors, Edit3, ChevronLeft } from "lucide-react";
import type { TableInfo, InternalScript } from "@/types/db";
import { dbService } from "@/services/dbService";
import { workspaceService } from "@/services/workspaceService";
import "./CommandPalette.css";

let recentPaletteIds: string[] = [];

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

type DdlMode = "drop" | "truncate" | "alter" | null;

type PaletteItem =
  | { kind: "table";    id: string; label: string; table: TableInfo; matchedAlias?: string }
  | { kind: "script";   id: string; label: string; script: InternalScript }
  | { kind: "action";   id: string; label: string; onAction: () => void }
  | { kind: "database"; id: string; label: string; dbName: string };

const ITEM_ICON: Record<PaletteItem["kind"], React.ReactNode> = {
  table:    <Table2 size={16} />,
  script:   <FileText size={16} />,
  action:   <Zap size={16} />,
  database: <Database size={16} />,
};

const ITEM_CATEGORY: Record<PaletteItem["kind"], string> = {
  table:    "Tabla",
  script:   "Script",
  action:   "Acción",
  database: "Base de datos",
};

const DDL_MODE_META: Record<NonNullable<DdlMode>, { label: string; icon: React.ReactNode; danger: boolean; hint: string }> = {
  drop:     { label: "DROP TABLE",     icon: <Trash2   size={14} />, danger: true,  hint: "↵ Confirmar eliminación" },
  truncate: { label: "TRUNCATE TABLE", icon: <Scissors size={14} />, danger: true,  hint: "↵ Confirmar truncado" },
  alter:    { label: "ALTER TABLE",    icon: <Edit3    size={14} />, danger: false, hint: "↵ Abrir editor" },
};

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  connectionId?: string | null;
  onTableSelect?: (table: TableInfo) => void;
  onScriptOpen?: (sql: string, name: string, id?: string) => void;
  onDatabaseSwitch?: (dbName: string) => void;
  onDropTable?: (table: TableInfo) => void;
  onTruncateTable?: (table: TableInfo) => void;
  onAlterTable?: (table: TableInfo) => void;
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
  onAlterTable,
  actions = [],
}: CommandPaletteProps) {
  const [query, setQuery]               = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [baseItems, setBaseItems]       = useState<PaletteItem[]>([]);
  const [ddlMode, setDdlMode]           = useState<DdlMode>(null);
  const inputRef   = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!resultsRef.current) return;
    const el = resultsRef.current.querySelector(`[data-palette-index="${selectedIndex}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  useEffect(() => {
    if (!open) { setDdlMode(null); return; }
    setQuery("");
    setSelectedIndex(0);
    setTimeout(() => inputRef.current?.focus(), 50);

    const next: PaletteItem[] = [];
    const loaders: Promise<void>[] = [];

    if (connectionId) {
      loaders.push(
        dbService.fetchTables(connectionId)
          .then((tables) => {
            for (const t of tables) {
              const label = t.schema ? `${t.schema}.${t.name}` : t.name;
              next.push({ kind: "table", id: `t:${label}`, label, table: t });
            }
          })
          .catch(console.error),
      );
      loaders.push(
        dbService.listDatabases(connectionId)
          .then((dbs) => {
            for (const db of dbs) {
              next.push({ kind: "database", id: `db:${db}`, label: db, dbName: db });
            }
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

    Promise.all(loaders).then(() => setBaseItems([...next]));
  }, [open, connectionId]);

  const enterDdlMode = useCallback((mode: NonNullable<DdlMode>) => {
    setDdlMode(mode);
    setQuery("");
    setSelectedIndex(0);
    setTimeout(() => inputRef.current?.focus(), 30);
  }, []);

  // DDL static actions — built-in, appear under > prefix and in suggestions
  const ddlActionItems = useMemo<PaletteItem[]>(() => connectionId ? [
    { kind: "action", id: "ddl:drop",     label: "Drop Table…",     onAction: () => enterDdlMode("drop") },
    { kind: "action", id: "ddl:truncate", label: "Truncate Table…", onAction: () => enterDdlMode("truncate") },
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
      const recent = recentPaletteIds.map((id) => allItems.find((i) => i.id === id)).filter(Boolean) as PaletteItem[];
      return recent.length > 0 ? recent : [...actionItems, ...baseItems.filter(i => i.kind === "script")].slice(0, 5);
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
        if (ddlMode === "alter")    onAlterTable?.(item.table);
        onClose();
        return;
      }

      recentPaletteIds = [item.id, ...recentPaletteIds.filter((id) => id !== item.id)].slice(0, 5);
      if (item.kind === "table")    onTableSelect?.(item.table);
      else if (item.kind === "script")   onScriptOpen?.(item.script.content, item.script.title, item.script.id);
      else if (item.kind === "database") onDatabaseSwitch?.(item.dbName);
      else item.onAction();
      onClose();
    },
    [ddlMode, onDropTable, onTruncateTable, onAlterTable, onTableSelect, onScriptOpen, onDatabaseSwitch, onClose],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, filtered.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter" && e.altKey && filtered[selectedIndex]?.kind === "table") {
        // Alt+Enter → open ERD for focused table
        e.preventDefault();
        window.dispatchEvent(new CustomEvent("dib:open-table-relations", { detail: filtered[selectedIndex].table }));
        onClose();
      } else if (e.key === "Enter" && (e.ctrlKey || e.metaKey) && filtered[selectedIndex]?.kind === "table") {
        window.dispatchEvent(new CustomEvent("dib:open-table-structure", { detail: filtered[selectedIndex].table }));
        onClose();
      } else if (e.key === "Enter" && filtered[selectedIndex]) {
        execute(filtered[selectedIndex]);
      } else if (e.key === "Escape") {
        if (ddlMode) { setDdlMode(null); setQuery(""); }
        else onClose();
      }
    },
    [filtered, selectedIndex, execute, ddlMode, onClose],
  );

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape" && !ddlMode) onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, ddlMode, onClose]);

  if (!open) return null;

  const isEmpty = query.trim() === "";
  const currentDdlMeta = ddlMode ? DDL_MODE_META[ddlMode] : null;

  return (
    <div className="palette-backdrop" onClick={onClose}>
      <div className="palette" onClick={(e) => e.stopPropagation()}>
        {/* DDL sub-mode indicator */}
        {ddlMode && currentDdlMeta && (
          <div className={`palette-ddl-bar${currentDdlMeta.danger ? " palette-ddl-bar--danger" : " palette-ddl-bar--alter"}`}>
            <button className="palette-ddl-back" onClick={() => { setDdlMode(null); setQuery(""); }} title="Volver (Esc)">
              <ChevronLeft size={14} />
            </button>
            <span className="palette-ddl-icon">{currentDdlMeta.icon}</span>
            <span className="palette-ddl-label">{currentDdlMeta.label}</span>
            <span className="palette-ddl-hint">— selecciona una tabla</span>
          </div>
        )}

        <div className="palette-input-wrap">
          <Search size={16} className="palette-input-icon" />
          <input
            ref={inputRef}
            className="palette-input"
            type="text"
            placeholder={ddlMode ? "Filtrar tablas…" : "Tablas · > acciones · @ conexiones · # scripts"}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
          />
        </div>

        <div className="palette-results" ref={resultsRef}>
          {filtered.length === 0 ? (
            <div className="palette-empty">Sin resultados</div>
          ) : (
            filtered.map((item, i) => {
              const isRecentView = !ddlMode && isEmpty && recentPaletteIds.length > 0;
              const prevItem = i > 0 ? filtered[i - 1] : null;
              const showHeader = ddlMode
                ? i === 0
                : isRecentView ? i === 0 : (!prevItem || prevItem.kind !== item.kind);
              const headerText = ddlMode
                ? "TABLAS"
                : isRecentView ? "RECIENTE" : (isEmpty ? "SUGERENCIAS" : ITEM_CATEGORY[item.kind].toUpperCase());

              let hintText = "↵ Seleccionar";
              if (ddlMode && item.kind === "table") hintText = currentDdlMeta?.hint ?? "↵";
              else if (item.kind === "table")    hintText = "↵ Abrir · ⌥↵ ERD · ⌃↵ Estructura";
              else if (item.kind === "script")   hintText = "↵ Ejecutar Script";
              else if (item.kind === "database") hintText = "↵ Cambiar BD";
              else if (item.kind === "action")   hintText = "↵ Ejecutar";

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
                    onMouseEnter={() => setSelectedIndex(i)}
                  >
                    <span className={`palette-item-icon${item.kind === "action" || item.kind === "database" ? " palette-item-icon--action" : ""}`}>
                      {ddlMode && item.kind === "table" ? currentDdlMeta?.icon : ITEM_ICON[item.kind]}
                    </span>
                    <span className="palette-item-label">{item.label}</span>
                    <span className="palette-item-shortcut">{hintText}</span>
                  </div>
                </React.Fragment>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
