import { Database, Pencil, Trash2 } from "lucide-react";
import { ENGINE_COLORS, getEngineIcon, getDbName } from "./utils";
import type { SavedConnection } from "@/types/db";

interface ConnectionItemProps {
  conn: SavedConnection;
  isSelected: boolean;
  isActive: boolean;
  navIdx: number;
  onSelect: (navIdx: number, connId: string) => void;
  onContextMenu: (e: React.MouseEvent, connId: string) => void;
  onEdit: (conn: SavedConnection) => void;
  onDelete: (conn: SavedConnection) => void;
}

export function ConnectionItem({
  conn,
  isSelected,
  isActive,
  navIdx,
  onSelect,
  onContextMenu,
  onEdit,
  onDelete,
}: ConnectionItemProps) {
  return (
    <div
      className={`sidebar-item${isSelected ? " sidebar-item--keyboard-selected" : ""}${isActive ? " sidebar-item--active" : ""}`}
      onClick={() => onSelect(navIdx, conn.id)}
      onContextMenu={(e) => onContextMenu(e, conn.id)}
    >
      <Database
        size={14}
        className={`sidebar-icon sidebar-icon--${ENGINE_COLORS[conn.engine?.toLowerCase()] ?? "gray"}`}
      />
      <div className="sidebar-item-texts">
        <span className="sidebar-item-text">{conn.name}</span>
        <span className="sidebar-item-detail">
          {getEngineIcon(conn.engine)} {getDbName(conn)}
        </span>
      </div>
      <div className="sidebar-item-actions">
        <button
          className="sidebar-item-action-btn"
          title="Editar conexión (F2)"
          onClick={(e) => { e.stopPropagation(); onEdit(conn); }}
        >
          <Pencil size={12} />
        </button>
        <button
          className="sidebar-item-action-btn sidebar-item-action-btn--danger"
          title="Eliminar (Delete)"
          onClick={(e) => { e.stopPropagation(); onDelete(conn); }}
        >
          <Trash2 size={12} />
        </button>
      </div>
    </div>
  );
}
