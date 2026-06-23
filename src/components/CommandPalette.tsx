import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Search, Table2, FileText, Terminal } from "lucide-react";
import type { TableInfo, ScriptMeta } from "../types/db";
import "./CommandPalette.css";

export interface CommandAction {
  id: string;
  label: string;
  onAction: () => void;
}

type PaletteItem =
  | { kind: "table";  id: string; label: string; table: TableInfo }
  | { kind: "script"; id: string; label: string; script: ScriptMeta }
  | { kind: "action"; id: string; label: string; onAction: () => void };

// Subsequence fuzzy: all chars of query appear in order in text
function fuzzy(query: string, text: string): boolean {
  if (!query) return true;
  const q = query.toLowerCase();
  const t = text.toLowerCase();
  let qi = 0;
  for (let i = 0; i < t.length && qi < q.length; i++) {
    if (t[i] === q[qi]) qi++;
  }
  return qi === q.length;
}

function extractSql(raw: string): string {
  const m = raw.match(/```sql\n([\s\S]*?)\n```/);
  return m ? m[1] : raw;
}

const ITEM_ICON: Record<PaletteItem["kind"], React.ReactNode> = {
  table:  <Table2 size={16} />,
  script: <FileText size={16} />,
  action: <Terminal size={16} />,
};

const ITEM_CATEGORY: Record<PaletteItem["kind"], string> = {
  table:  "Tabla",
  script: "Script",
  action: "Acción",
};

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  connectionId?: string | null;
  onTableSelect?: (table: TableInfo) => void;
  onScriptOpen?: (sql: string, name: string) => void;
  actions?: CommandAction[];
}

export function CommandPalette({
  open,
  onClose,
  connectionId,
  onTableSelect,
  onScriptOpen,
  actions = [],
}: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [baseItems, setBaseItems] = useState<PaletteItem[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

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
    }

    loaders.push(
      invoke<ScriptMeta[]>("list_scripts")
        .then((scripts) => {
          for (const s of scripts) {
            next.push({ kind: "script", id: `s:${s.name}`, label: s.name, script: s });
          }
        })
        .catch(console.error),
    );

    Promise.all(loaders).then(() => setBaseItems([...next]));
  }, [open, connectionId]);

  // Prefix routing — pure filter, useMemo for performance
  const filtered = useMemo<PaletteItem[]>(() => {
    if (query.startsWith(">")) {
      const q = query.slice(1).trimStart();
      return actions
        .filter((a) => fuzzy(q, a.label))
        .map((a) => ({ kind: "action" as const, id: `a:${a.id}`, label: a.label, onAction: a.onAction }));
    }
    if (query.startsWith("#")) {
      const q = query.slice(1).trimStart();
      return baseItems.filter((item) => item.kind === "script" && fuzzy(q, item.label));
    }
    return baseItems.filter((item) => item.kind === "table" && fuzzy(query, item.label));
  }, [query, baseItems, actions]);

  useEffect(() => { setSelectedIndex(0); }, [query]);

  const execute = useCallback(
    async (item: PaletteItem) => {
      if (item.kind === "table") {
        onTableSelect?.(item.table);
      } else if (item.kind === "script") {
        try {
          const raw = await invoke<string>("read_script", { filename: item.script.name });
          onScriptOpen?.(extractSql(raw), item.script.name);
        } catch (e) {
          console.error(e);
        }
      } else {
        item.onAction();
      }
      onClose();
    },
    [onTableSelect, onScriptOpen, onClose],
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

  const prefix = query.startsWith(">") ? ">" : query.startsWith("#") ? "#" : null;
  const placeholder =
    prefix === ">" ? "Buscar acciones…" :
    prefix === "#" ? "Buscar scripts…" :
    "Buscar tablas…";

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
          <span className="palette-input-hint">&gt; acciones · # scripts</span>
        </div>

        <div className="palette-results">
          {filtered.length === 0 ? (
            <div className="palette-empty">Sin resultados</div>
          ) : (
            filtered.map((item, i) => (
              <div
                key={item.id}
                className={`palette-item${i === selectedIndex ? " palette-item--selected" : ""}`}
                onClick={() => execute(item)}
                onMouseEnter={() => setSelectedIndex(i)}
              >
                <span className="palette-item-icon">
                  {ITEM_ICON[item.kind]}
                </span>
                <span className="palette-item-label">{item.label}</span>
                <span className="palette-item-category">{ITEM_CATEGORY[item.kind]}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
