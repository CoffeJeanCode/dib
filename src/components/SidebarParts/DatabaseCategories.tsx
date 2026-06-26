import { useState, useCallback, useEffect, useRef, useContext } from "react";
import { ChevronRight, Box, Eye, Zap, Folder, Bolt } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import type { SchemaObjects, TableInfo, TriggerInfo } from "../../types/db";
import { ToastContext } from "../../App";

interface DatabaseCategoriesProps {
  sessionId: string | null | undefined;
}

const CATEGORIES = [
  { key: "tables",     label: "Tablas",        icon: <Box size={14} /> },
  { key: "views",      label: "Vistas",         icon: <Eye size={14} /> },
  { key: "functions",  label: "Funciones",      icon: <Folder size={14} /> },
  { key: "procedures", label: "Procedimientos", icon: <Zap size={14} /> },
  { key: "triggers",   label: "Triggers",       icon: <Bolt size={14} /> },
] as const;

function fmtErr(e: unknown): string {
  if (typeof e === "string") return e;
  if (e && typeof e === "object") {
    const o = e as Record<string, unknown>;
    return String(o.message ?? o.error ?? o.msg ?? JSON.stringify(e));
  }
  return "Error desconocido";
}

export function DatabaseCategories({ sessionId }: DatabaseCategoriesProps) {
  const toast = useContext(ToastContext);
  // ponytail: ref avoids toast identity in useEffect deps → prevents infinite refetch
  const toastRef = useRef(toast);
  useEffect(() => { toastRef.current = toast; });

  const [open, setOpen] = useState<Record<string, boolean>>({
    tables: true, views: false, functions: false, procedures: false, triggers: false,
  });
  const [objects, setObjects] = useState<SchemaObjects | null>(null);
  const [loading, setLoading] = useState(false);

  const toggle = useCallback((cat: string) => {
    setOpen((prev) => ({ ...prev, [cat]: !prev[cat] }));
  }, []);

  useEffect(() => {
    if (!sessionId) {
      setObjects(null);
      return;
    }
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
    window.addEventListener("dib:reload", load);
    return () => {
      cancelled = true;
      window.removeEventListener("dib:reload", load);
    };
  }, [sessionId]); // sessionId only — no toast/objects in deps

  if (!sessionId) {
    return (
      <div className="sidebar-db-categories">
        <span className="sidebar-item-text sidebar-item-text--muted" style={{ padding: "12px 16px", display: "block" }}>
          Sin conexión activa
        </span>
      </div>
    );
  }

  const itemsFor = (key: string): (TableInfo | TriggerInfo)[] => {
    if (!objects) return [];
    return (objects[key as keyof SchemaObjects] as (TableInfo | TriggerInfo)[]) ?? [];
  };

  const displayName = (it: TableInfo | TriggerInfo): string =>
    "trigger_name" in it ? it.trigger_name : it.name;

  return (
    <div className="sidebar-db-categories">
      {CATEGORIES.map((cat) => {
        const items = itemsFor(cat.key);
        return (
          <div key={cat.key} className="sidebar-db-category">
            <button className="sidebar-section-toggle" onClick={() => toggle(cat.key)}>
              <ChevronRight
                size={12}
                className={`sidebar-chevron${open[cat.key] ? " sidebar-chevron--open" : ""}`}
              />
              {cat.icon}
              <span className="sidebar-section-title" style={{ margin: 0 }}>{cat.label}</span>
              {objects && <span className="sidebar-section-count">{items.length}</span>}
            </button>
            {open[cat.key] && (
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
                  items.map((it) => {
                    const name = displayName(it);
                    const schema = "schema" in it ? it.schema : null;
                    return (
                      <span
                        key={`${schema ?? ""}.${name}`}
                        className="sidebar-item-text"
                        style={{ paddingLeft: 24, display: "block" }}
                        title={schema ? `${schema}.${name}` : name}
                      >
                        {name}
                      </span>
                    );
                  })
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
