import { useState } from "react";
import { Database, Pencil, Trash2, ChevronRight, ChevronDown } from "lucide-react";
import { ENGINE_COLORS, getEngineIcon, getDbName } from "./utils";
import { InstanceContextMenu } from "./InstanceContextMenu";
import { DbContextMenu } from "./DbContextMenu";
import { useDatabases } from "@/hooks/useDatabases";
import type { SavedConnection } from "@/types/db";

interface ConnectionItemProps {
  conn: SavedConnection;
  isSelected: boolean;
  isActive: boolean;
  navIdx: number;
  sessionId?: string | null;
  activeDb?: string;
  onSelect: (navIdx: number, connId: string) => void;
  onDbSwitch?: (dbName: string) => void;
  onEdit: (conn: SavedConnection) => void;
  onDelete: (conn: SavedConnection) => void;
  // instance context menu actions
  onNewQuery?: () => void;
  onCreateDatabase?: () => void;
  // db context menu actions
  onRenameDb?: (dbName: string) => void;
  onDropDb?: (dbName: string) => void;
}

export function ConnectionItem({
  conn, isSelected, isActive, navIdx, sessionId, activeDb,
  onSelect, onDbSwitch, onEdit, onDelete,
  onNewQuery, onCreateDatabase, onRenameDb, onDropDb,
}: ConnectionItemProps) {
  const [expanded, setExpanded] = useState(isActive);
  const { databases, loading } = useDatabases(expanded && isActive && sessionId ? sessionId : null);

  return (
    <div>
      <InstanceContextMenu
        onNewQuery={onNewQuery}
        onCreateDatabase={onCreateDatabase}
        onEditConnection={() => onEdit(conn)}
        onRemoveConnection={() => onDelete(conn)}
      >
        <div
          className={`sidebar-item${isSelected ? " sidebar-item--keyboard-selected" : ""}${isActive ? " sidebar-item--active" : ""}`}
          onClick={() => onSelect(navIdx, conn.id)}
        >
          {isActive ? (
            <button
              className="sidebar-item-expand-btn"
              title={expanded ? "Collapse" : "Expand databases"}
              onClick={(e) => { e.stopPropagation(); setExpanded((v) => !v); }}
            >
              {expanded ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
            </button>
          ) : (
            <span className="sidebar-item-expand-spacer" />
          )}
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
              title="Edit connection (F2)"
              onClick={(e) => { e.stopPropagation(); onEdit(conn); }}
            >
              <Pencil size={12} />
            </button>
            <button
              className="sidebar-item-action-btn sidebar-item-action-btn--danger"
              title="Delete (Delete)"
              onClick={(e) => { e.stopPropagation(); onDelete(conn); }}
            >
              <Trash2 size={12} />
            </button>
          </div>
        </div>
      </InstanceContextMenu>

      {isActive && expanded && (
        <div className="sidebar-db-tree">
          {loading ? (
            <div className="sidebar-db-tree-item sidebar-db-tree-item--loading">Loading…</div>
          ) : databases.length === 0 ? (
            <div className="sidebar-db-tree-item sidebar-db-tree-item--empty">No databases</div>
          ) : (
            databases.map((db) => (
              <DbContextMenu
                key={db}
                onRename={onRenameDb ? () => onRenameDb(db) : undefined}
                onDrop={onDropDb ? () => onDropDb(db) : undefined}
              >
                <div
                  className={`sidebar-db-tree-item${db === activeDb ? " sidebar-db-tree-item--active" : ""}`}
                  onClick={() => onDbSwitch?.(db)}
                >
                  <Database size={11} className="sidebar-db-tree-item-icon" />
                  <span className="sidebar-db-tree-item-name">{db}</span>
                  {db === activeDb && <span className="sidebar-db-tree-item-dot" aria-hidden>●</span>}
                </div>
              </DbContextMenu>
            ))
          )}
        </div>
      )}
    </div>
  );
}
