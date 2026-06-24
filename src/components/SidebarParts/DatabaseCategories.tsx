import { useState, useCallback, useEffect, useContext } from "react";
import { ChevronRight, Box, Eye, Zap, Folder } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import type { SchemaObjects, TableInfo } from "../../types/db";
import { ToastContext } from "../../App";

interface DatabaseCategoriesProps {
  isActive: boolean;
  activeConnectionId?: string | null;
}

const CATEGORIES = [
  { key: "tables", label: "Tablas", icon: <Box size={14} /> },
  { key: "views", label: "Vistas", icon: <Eye size={14} /> },
  { key: "procedures", label: "Procedimientos", icon: <Zap size={14} /> },
  { key: "functions", label: "Funciones", icon: <Folder size={14} /> },
] as const;

function fmtErr(e: unknown): string {
  if (typeof e === "string") return e;
  if (e && typeof e === "object") {
    const o = e as Record<string, unknown>;
    return String(o.message ?? o.error ?? o.msg ?? JSON.stringify(e));
  }
  return "Error desconocido";
}

export function DatabaseCategories({ isActive, activeConnectionId }: DatabaseCategoriesProps) {
  const toast = useContext(ToastContext);
  const [dbCategoriesOpen, setDbCategoriesOpen] = useState<Record<string, boolean>>({
    tables: true,
    views: false,
    procedures: false,
    functions: false,
  });
  const [objects, setObjects] = useState<SchemaObjects | null>(null);
  const [loading, setLoading] = useState(false);

  const toggleDbCategory = useCallback((cat: string) => {
    setDbCategoriesOpen((prev) => ({ ...prev, [cat]: !prev[cat] }));
  }, []);

  // Deep schema fetch + cache invalidation on DB switch (dib:reload).
  useEffect(() => {
    if (!isActive || !activeConnectionId) {
      setObjects(null);
      return;
    }
    let cancelled = false;
    const load = () => {
      setObjects(null); // clear tree instantly while the new structure loads
      setLoading(true);
      invoke<SchemaObjects>("fetch_schema_objects", { connectionId: activeConnectionId })
        .then((o) => { if (!cancelled) setObjects(o); })
        .catch((e) => { if (!cancelled) toast.error(fmtErr(e)); })
        .finally(() => { if (!cancelled) setLoading(false); });
    };
    load();
    window.addEventListener("dib:reload", load);
    return () => {
      cancelled = true;
      window.removeEventListener("dib:reload", load);
    };
  }, [isActive, activeConnectionId, toast]);

  if (!isActive || !activeConnectionId) return null;

  const itemsFor = (key: string): TableInfo[] => {
    if (!objects) return [];
    return (objects[key as keyof SchemaObjects] as TableInfo[]) ?? [];
  };

  return (
    <div className="sidebar-db-categories">
      {CATEGORIES.map((cat) => {
        const items = itemsFor(cat.key);
        return (
          <div key={cat.key} className="sidebar-db-category">
            <button
              className="sidebar-section-toggle"
              onClick={() => toggleDbCategory(cat.key)}
            >
              <ChevronRight
                size={12}
                className={`sidebar-chevron${dbCategoriesOpen[cat.key] ? " sidebar-chevron--open" : ""}`}
              />
              {cat.icon}
              <span className="sidebar-section-title" style={{ margin: 0 }}>{cat.label}</span>
              {objects && <span className="sidebar-section-count">{items.length}</span>}
            </button>
            {dbCategoriesOpen[cat.key] && (
              <div className="sidebar-db-category-items">
                {loading ? (
                  <span className="sidebar-item-text sidebar-item-text--muted" style={{ paddingLeft: 24 }}>
                    Cargando…
                  </span>
                ) : items.length === 0 ? (
                  <span className="sidebar-item-text sidebar-item-text--muted" style={{ paddingLeft: 24 }}>
                    Vacío
                  </span>
                ) : (
                  // ponytail: read-only listing — table navigation stays in QueryPanel's navigator
                  items.map((it) => (
                    <span
                      key={`${it.schema ?? ""}.${it.name}`}
                      className="sidebar-item-text"
                      style={{ paddingLeft: 24, display: "block" }}
                      title={it.schema ? `${it.schema}.${it.name}` : it.name}
                    >
                      {it.name}
                    </span>
                  ))
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
