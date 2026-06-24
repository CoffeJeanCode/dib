import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Database, Pencil, Trash2 } from "lucide-react";
import { useSavedConnections } from "../hooks/useSavedConnections";
import { useContextMenu } from "../hooks/useContextMenu";
import { ContextMenu } from "./ContextMenu";
import { SidebarHeader, DatabaseSelector, SidebarNav } from "./SidebarParts";
import { ENGINE_COLORS } from "./SidebarParts";
import type { InternalScript, SavedConnection } from "../types/db";
import "./Sidebar.css";

interface SidebarProps {
  collapsed: boolean;
  width?: number;
  activeConnectionId?: string | null;
  onToggle: () => void;
  onResizeStart?: (e: React.MouseEvent) => void;
  onConnectionSelect?: (savedId: string) => void;
  onScriptOpen?: (sql: string, title: string, id: string) => void;
  onEditConnection?: (conn: SavedConnection) => void;
  onSettingsOpen?: () => void;
}

export function Sidebar({
  collapsed,
  width,
  activeConnectionId,
  onToggle,
  onResizeStart,
  onConnectionSelect,
  onScriptOpen,
  onEditConnection,
  onSettingsOpen,
}: SidebarProps) {
  const { connections, remove, save } = useSavedConnections();
  const { menuState, openMenu, closeMenu } = useContextMenu();
  const [contextConnId, setContextConnId] = useState<string | null>(null);

  const [scripts, setScripts] = useState<InternalScript[]>([]);
  const [scriptsLoading, setScriptsLoading] = useState(false);

  const [undoStack, setUndoStack] = useState<SavedConnection[]>([]);

  const refreshScripts = useCallback(() => {
    setScriptsLoading(true);
    invoke<InternalScript[]>("get_internal_scripts")
      .then(setScripts)
      .catch(() => setScripts([]))
      .finally(() => setScriptsLoading(false));
  }, []);

  useEffect(() => { refreshScripts(); }, [refreshScripts]);

  useEffect(() => {
    const handler = () => refreshScripts();
    window.addEventListener("dib:script-saved", handler);
    return () => window.removeEventListener("dib:script-saved", handler);
  }, [refreshScripts]);

  const deleteConn = useCallback(
    (conn: SavedConnection) => {
      setUndoStack((prev) => [...prev.slice(-4), conn]);
      remove(conn.id);
    },
    [remove],
  );

  const undoDelete = useCallback(() => {
    const last = undoStack[undoStack.length - 1];
    if (last) {
      save(last);
      setUndoStack((prev) => prev.slice(0, -1));
    }
  }, [undoStack, save]);

  const handleClose = () => {
    closeMenu();
    setContextConnId(null);
  };

  const handleContextMenu = (e: React.MouseEvent, connId: string) => {
    setContextConnId(connId);
    openMenu(e);
  };

  const menuItems = [
    {
      icon: <Pencil size={14} />,
      label: "Editar Conexión",
      onClick: () => {
        const conn = connections.find((c) => c.id === contextConnId);
        if (conn) onEditConnection?.(conn);
        handleClose();
      },
    },
    {
      icon: <Trash2 size={14} />,
      label: "Eliminar",
      danger: true,
      onClick: () => {
        const conn = connections.find((c) => c.id === contextConnId);
        if (conn) deleteConn(conn);
        handleClose();
      },
    },
  ];

  if (collapsed) {
    return (
      <aside className="sidebar sidebar--collapsed">
        <div className="sidebar-header">
          <button className="sidebar-toggle" onClick={onToggle} aria-label="Expand sidebar">
            »
          </button>
        </div>

        <nav className="sidebar-nav">
          <div className="sidebar-collapsed-icons">
            {connections.map((conn) => (
              <div
                key={conn.id}
                className={`sidebar-collapsed-icon${conn.id === activeConnectionId ? " sidebar-collapsed-icon--active" : ""}`}
                title={conn.name}
                onClick={() => onConnectionSelect?.(conn.id)}
              >
                <Database
                  size={18}
                  className={`sidebar-icon sidebar-icon--${ENGINE_COLORS[conn.engine?.toLowerCase()] ?? "gray"}`}
                />
              </div>
            ))}
          </div>
        </nav>

        <div className="sidebar-flyout">
          <SidebarHeader onToggle={onToggle} onSettingsOpen={onSettingsOpen} collapsed />
          <DatabaseSelector
            connections={connections}
            activeConnectionId={activeConnectionId}
            onConnectionSelect={onConnectionSelect}
          />
          <nav className="sidebar-nav">
            <div className="sidebar-section">
              <span className="sidebar-section-title">Connections</span>
              {connections.map((conn) => (
                <div
                  key={conn.id}
                  className="sidebar-item"
                  onClick={() => onConnectionSelect?.(conn.id)}
                >
                  <Database
                    size={14}
                    className={`sidebar-icon sidebar-icon--${ENGINE_COLORS[conn.engine?.toLowerCase()] ?? "gray"}`}
                  />
                  <div className="sidebar-item-texts">
                    <span className="sidebar-item-text">{conn.name}</span>
                  </div>
                </div>
              ))}
            </div>
          </nav>
        </div>
      </aside>
    );
  }

  return (
    <aside
      className="sidebar"
      style={width ? { width, minWidth: width } : undefined}
    >
      {onResizeStart && (
        <div className="sidebar-resize-handle" onMouseDown={onResizeStart} />
      )}
      <SidebarHeader onToggle={onToggle} onSettingsOpen={onSettingsOpen} />
      <DatabaseSelector
        connections={connections}
        activeConnectionId={activeConnectionId}
        onConnectionSelect={onConnectionSelect}
      />
      <SidebarNav
        connections={connections}
        scripts={scripts}
        scriptsLoading={scriptsLoading}
        activeConnectionId={activeConnectionId}
        onConnectionSelect={onConnectionSelect}
        onScriptOpen={onScriptOpen}
        onRefreshScripts={refreshScripts}
        onDeleteConnection={deleteConn}
        onUndoDelete={undoDelete}
        undoStack={undoStack}
        onContextMenu={handleContextMenu}
      />
      <ContextMenu
        open={menuState.open}
        x={menuState.x}
        y={menuState.y}
        items={menuItems}
        onClose={handleClose}
      />
    </aside>
  );
}