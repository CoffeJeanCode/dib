import { useState, useCallback } from "react";
import { ChevronRight, Box, Eye, Zap, Folder } from "lucide-react";

interface DatabaseCategoriesProps {
  isActive: boolean;
  activeConnectionId?: string | null;
}

const CATEGORIES = [
  { key: "tables", label: "Tablas", icon: <Box size={14} /> },
  { key: "views", label: "Vistas", icon: <Eye size={14} /> },
  { key: "procedures", label: "Procedimientos", icon: <Zap size={14} /> },
  { key: "functions", label: "Funciones", icon: <Folder size={14} /> },
];

export function DatabaseCategories({ isActive, activeConnectionId }: DatabaseCategoriesProps) {
  const [dbCategoriesOpen, setDbCategoriesOpen] = useState<Record<string, boolean>>({
    tables: true,
    views: false,
    procedures: false,
    functions: false,
  });

  const toggleDbCategory = useCallback((cat: string) => {
    setDbCategoriesOpen((prev) => ({ ...prev, [cat]: !prev[cat] }));
  }, []);

  if (!isActive || !activeConnectionId) return null;

  return (
    <div className="sidebar-db-categories">
      {CATEGORIES.map((cat) => (
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
          </button>
          {dbCategoriesOpen[cat.key] && (
            <div className="sidebar-db-category-items">
              <span className="sidebar-item-text sidebar-item-text--muted" style={{ paddingLeft: 24 }}>
                {cat.key === "tables" ? "Cargando…" : "Próximamente"}
              </span>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}