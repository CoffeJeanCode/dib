import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Search, Table2, FileText, Zap, Database, Trash2 } from "lucide-react";
import type { TableInfo, InternalScript } from "../types/db";
import { dbService } from "../services/dbService";
import { workspaceService } from "../services/workspaceService";
import "./CommandPalette.css";

let recentPaletteIds: string[] = [];

export interface CommandAction {
  id: string;
  label: string;
  onAction: () => void;
}

type PaletteItem =
  | { kind: "table";    id: string; label: string; table: TableInfo }
  | { kind: "script";   id: string; label: string; script: InternalScript }
  | { kind: "action";   id: string; label: string; onAction: () => void }
  | { kind: "database"; id: string; label: string; dbName: string }
  | { kind: "drop";     id: string; label: string; table: TableInfo };

const ITEM_ICON: Record<PaletteItem["kind"], React.ReactNode> = {
  table:    <Table2 size={16} />,
  script:   <FileText size={16} />,
  action:   <Zap size={16} />,
  database: <Database size={16} />,
  drop:     <Trash2 size={16} />,
};

const ITEM_CATEGORY: Record<PaletteItem["kind"], string> = {
  table:    "Tabla",
  script:   "Script",
  action:   "Acción",
  database: "Base de datos",
  drop:     "DROP TABLE",
};

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  connectionId?: string | null;
  onTableSelect?: (table: TableInfo) => void;
  onScriptOpen?: (sql: string, name: string, id?: string) => void;
  onDatabaseSwitch?: (dbName: string) => void;
  onDropTable?: (table: TableInfo) => void;
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
  actions = [],
}: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [baseItems, setBaseItems] = useState<PaletteItem[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!resultsRef.current) return;
    const el = resultsRef.current.querySelector(`[data-palette-index="${selectedIndex}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  useEffect(() => {
    if (!open) return;
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
              next.push({ kind: "drop", id: `drop:${label}`, label: `DROP TABLE: ${label}`, table: t });
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

  // Prefix-routed filtering: > actions, @ databases, # scripts, no prefix → tables
  const filtered = useMemo<PaletteItem[]>(() => {
    const actionItems: PaletteItem[] = actions.map((a) => ({
      kind: "action" as const,
      id: `a:${a.id}`,
      label: a.label,
      onAction: a.onAction,
    }));

    const q = query.trim();
    if (!q) {
      const allItems = [...baseItems, ...actionItems];
      const recent = recentPaletteIds.map((id) => allItems.find((i) => i.id === id)).filter(Boolean) as PaletteItem[];
      return recent.length > 0 ? recent : [...actionItems, ...baseItems.filter(i => i.kind === "script")].slice(0, 5);
    }

    const symbol = q[0];
    const rest = q.slice(1).toLowerCase().trim();

    if (symbol === ">") {
      const pool = [...baseItems.filter((i) => i.kind === "drop"), ...actionItems];
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
    // No prefix → tables only
    const pool = baseItems.filter((i) => i.kind === "table");
    return pool.filter((i) => i.label.toLowerCase().includes(q.toLowerCase()));
  }, [query, baseItems, actions]);

  useEffect(() => { setSelectedIndex(0); }, [query]);

  const execute = useCallback(
    async (item: PaletteItem) => {
      recentPaletteIds = [item.id, ...recentPaletteIds.filter((id) => id !== item.id)].slice(0, 5);
      if (item.kind === "table") {
        onTableSelect?.(item.table);
      } else if (item.kind === "script") {
        onScriptOpen?.(item.script.content, item.script.title, item.script.id);
      } else if (item.kind === "database") {
        onDatabaseSwitch?.(item.dbName);
      } else if (item.kind === "drop") {
        onDropTable?.(item.table);
      } else {
        item.onAction();
      }
      onClose();
    },
    [onTableSelect, onScriptOpen, onDatabaseSwitch, onDropTable, onClose],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, filtered.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter" && (e.ctrlKey || e.metaKey) && filtered[selectedIndex]?.kind === "table") {
        window.dispatchEvent(new CustomEvent("dib:open-table-structure", { detail: filtered[selectedIndex].table }));
        onClose();
      } else if (e.key === "Enter" && filtered[selectedIndex]) {
        execute(filtered[selectedIndex]);
      } else if (e.key === "Escape") {
        onClose();
      }
    },
    [filtered, selectedIndex, execute, onClose],
  );

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;

  const isEmpty = query.trim() === "";

  return (
    <div className="palette-backdrop" onClick={onClose}>
      <div className="palette" onClick={(e) => e.stopPropagation()}>
        <div className="palette-input-wrap">
          <Search size={16} className="palette-input-icon" />
          <input
            ref={inputRef}
            className="palette-input"
            type="text"
            placeholder="Tablas · > acciones · @ conexiones · # scripts"
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
              const isRecentView = isEmpty && recentPaletteIds.length > 0;
              const prevItem = i > 0 ? filtered[i - 1] : null;
              const showHeader = isRecentView ? (i === 0) : (!prevItem || prevItem.kind !== item.kind);
              const headerText = isRecentView ? "RECENT" : (isEmpty ? "SUGGESTIONS" : ITEM_CATEGORY[item.kind].toUpperCase());
              
              let hintText = "↵ Seleccionar";
              if (item.kind === "table") hintText = "↵ Abrir · ⌃↵ Estructura";
              if (item.kind === "script") hintText = "↵ Ejecutar Script";
              if (item.kind === "database") hintText = "↵ Cambiar BD";
              if (item.kind === "drop") hintText = "↵ Eliminar";
              if (item.kind === "action") hintText = "↵ Ejecutar";
              
              return (
                <React.Fragment key={item.id}>
                  {showHeader && (
                    <div className="palette-group-header">{headerText}</div>
                  )}
                  <div
                    data-palette-index={i}
                    className={`palette-item${i === selectedIndex ? " palette-item--selected bg-pattern-halftone" : ""}${item.kind === "drop" ? " palette-item--danger" : ""}`}
                    onClick={() => execute(item)}
                    onMouseEnter={() => setSelectedIndex(i)}
                  >
                    <span className={`palette-item-icon${item.kind === "action" || item.kind === "database" ? " palette-item-icon--action" : ""}`}>
                      {ITEM_ICON[item.kind]}
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
