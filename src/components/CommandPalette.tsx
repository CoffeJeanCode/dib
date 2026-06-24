import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Search, Table2, FileText, Zap, Database } from "lucide-react";
import type { TableInfo, InternalScript } from "../types/db";
import "./CommandPalette.css";

export interface CommandAction {
  id: string;
  label: string;
  onAction: () => void;
}

type PaletteItem =
  | { kind: "table";    id: string; label: string; table: TableInfo }
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

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  connectionId?: string | null;
  onTableSelect?: (table: TableInfo) => void;
  onScriptOpen?: (sql: string, name: string, id?: string) => void;
  onDatabaseSwitch?: (dbName: string) => void;
  actions?: CommandAction[];
}

export function CommandPalette({
  open,
  onClose,
  connectionId,
  onTableSelect,
  onScriptOpen,
  onDatabaseSwitch,
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
        invoke<TableInfo[]>("fetch_tables", { connectionId })
          .then((tables) => {
            for (const t of tables) {
              const label = t.schema ? `${t.schema}.${t.name}` : t.name;
              next.push({ kind: "table", id: `t:${label}`, label, table: t });
            }
          })
          .catch(console.error),
      );
      loaders.push(
        invoke<string[]>("list_databases", { connectionId })
          .then((dbs) => {
            for (const db of dbs) {
              next.push({ kind: "database", id: `db:${db}`, label: db, dbName: db });
            }
          })
          .catch(() => {}),
      );
    }

    loaders.push(
      invoke<InternalScript[]>("get_internal_scripts")
        .then((scripts) => {
          for (const s of scripts) {
            next.push({ kind: "script", id: `s:${s.id}`, label: s.title, script: s });
          }
        })
        .catch(console.error),
    );

    Promise.all(loaders).then(() => setBaseItems([...next]));
  }, [open, connectionId]);

  // Strict substring match across all item types — no prefix routing
  const filtered = useMemo<PaletteItem[]>(() => {
    const actionItems: PaletteItem[] = actions.map((a) => ({
      kind: "action" as const,
      id: `a:${a.id}`,
      label: a.label,
      onAction: a.onAction,
    }));
    const allItems = [...baseItems, ...actionItems];
    const q = query.toLowerCase().trim();
    if (!q) return allItems;
    return allItems.filter((item) => item.label.toLowerCase().includes(q));
  }, [query, baseItems, actions]);

  useEffect(() => { setSelectedIndex(0); }, [query]);

  const execute = useCallback(
    async (item: PaletteItem) => {
      if (item.kind === "table") {
        onTableSelect?.(item.table);
      } else if (item.kind === "script") {
        onScriptOpen?.(item.script.content, item.script.title, item.script.id);
      } else if (item.kind === "database") {
        onDatabaseSwitch?.(item.dbName);
      } else {
        item.onAction();
      }
      onClose();
    },
    [onTableSelect, onScriptOpen, onDatabaseSwitch, onClose],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, filtered.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
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

  const placeholder = "Buscar tablas, scripts, acciones…";

  return (
    <div className="palette-backdrop" onClick={onClose}>
      <div className="palette" onClick={(e) => e.stopPropagation()}>
        <div className="palette-input-wrap">
          <Search size={16} className="palette-input-icon" />
          <input
            ref={inputRef}
            className="palette-input"
            type="text"
            placeholder={placeholder}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <span className="palette-input-hint">↑↓ navegar · Enter seleccionar</span>
        </div>

        <div className="palette-results" ref={resultsRef}>
          {filtered.length === 0 ? (
            <div className="palette-empty">Sin resultados</div>
          ) : (
            filtered.map((item, i) => (
              <div
                key={item.id}
                data-palette-index={i}
                className={`palette-item${i === selectedIndex ? " palette-item--selected" : ""}`}
                onClick={() => execute(item)}
                onMouseEnter={() => setSelectedIndex(i)}
              >
                <span className={`palette-item-icon${item.kind === "action" || item.kind === "database" ? " palette-item-icon--action" : ""}`}>
                  {ITEM_ICON[item.kind]}
                </span>
                <span className="palette-item-label">{item.label}</span>
                <span className={`palette-item-category${item.kind === "action" || item.kind === "database" ? " palette-item-category--action" : ""}`}>{ITEM_CATEGORY[item.kind]}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
