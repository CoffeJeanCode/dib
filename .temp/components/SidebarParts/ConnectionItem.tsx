import { useState, useEffect, useRef, useCallback } from "react";
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
  onRename: (connId: string, newName: string) => void;
  onDelete: (conn: SavedConnection) => void;
}

export function ConnectionItem({
  conn,
  isSelected,
  isActive,
  navIdx,
  onSelect,
  onContextMenu,
  onRename,
  onDelete,
}: ConnectionItemProps) {
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const renameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isRenaming) {
      setTimeout(() => renameInputRef.current?.focus(), 0);
    }
  }, [isRenaming]);

  const commitRename = useCallback(() => {
    if (renameValue.trim()) {
      onRename(conn.id, renameValue.trim());
    }
    setIsRenaming(false);
    setRenameValue("");
  }, [conn.id, renameValue, onRename]);

  const cancelRename = useCallback(() => {
    setIsRenaming(false);
    setRenameValue("");
  }, []);

  const startRename = useCallback(() => {
    setIsRenaming(true);
    setRenameValue(conn.name);
  }, [conn.name]);

  return (
    <div>
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
          {isRenaming ? (
            <input
              ref={renameInputRef}
              className="sidebar-rename-input"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") { e.preventDefault(); commitRename(); }
                if (e.key === "Escape") { e.preventDefault(); cancelRename(); }
                e.stopPropagation();
              }}
              onBlur={commitRename}
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <>
              <span className="sidebar-item-text">{conn.name}</span>
              <span className="sidebar-item-detail">
                {getEngineIcon(conn.engine)} {getDbName(conn)}
              </span>
            </>
          )}
        </div>
        {!isRenaming && (
          <div className="sidebar-item-actions">
            <button
              className="sidebar-item-action-btn"
              title="Renombrar (F2)"
              onClick={(e) => {
                e.stopPropagation();
                startRename();
              }}
            >
              <Pencil size={12} />
            </button>
            <button
              className="sidebar-item-action-btn sidebar-item-action-btn--danger"
              title="Eliminar (Delete)"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(conn);
              }}
            >
              <Trash2 size={12} />
            </button>
          </div>
        )}
      </div>

    </div>
  );
}