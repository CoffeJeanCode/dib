import { useState, useCallback } from "react";
import { Pencil, Trash2, FileCode2 } from "lucide-react";
import { useSavedConnections } from "../hooks/useSavedConnections";
import { useSidebarScripts } from "../hooks/useSidebarScripts";
import { useContextMenu } from "../hooks/useContextMenu";
import { ContextMenu } from "./ContextMenu";
import { DatabaseSelector, SidebarNav } from "./SidebarParts";
import type { SavedConnection } from "../types/db";
import "./Sidebar.css";

type Panel = "connections" | "scripts" | "history" | "database";

interface SidebarProps {
  activeView: Panel;
  width?: number;
  activeConnectionId?: string | null;
  activeSessionId?: string | null;
  onResizeStart?: (e: React.MouseEvent) => void;
  onConnectionSelect?: (savedId: string) => void;
  onScriptOpen?: (sql: string, title: string, id: string) => void;
  onEditConnection?: (conn: SavedConnection) => void;
}

export function Sidebar({
  activeView,
  width,
  activeConnectionId,
  activeSessionId,
  onResizeStart,
  onConnectionSelect,
  onScriptOpen,
  onEditConnection,
}: SidebarProps) {
  const { connections, remove, save } = useSavedConnections();
  const { scripts, scriptsLoading, refreshScripts } = useSidebarScripts();
  const { menuState, openMenu, closeMenu } = useContextMenu();
  const [contextConnId, setContextConnId] = useState<string | null>(null);
  const [undoStack, setUndoStack] = useState<SavedConnection[]>([]);

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

  const handleClose = useCallback(() => {
    closeMenu();
    setContextConnId(null);
  }, [closeMenu]);

  const handleContextMenu = useCallback((e: React.MouseEvent, connId: string) => {
    if (!activeConnectionId) return;
    setContextConnId(connId);
    openMenu(e);
  }, [openMenu, activeConnectionId]);

  const menuItems = [
    ...(activeConnectionId ? [{
      icon: <FileCode2 size={14} />,
      label: "Nueva Consulta SQL",
      onClick: () => {
        handleClose();
        onScriptOpen?.("", "Nueva Consulta", `new-${Date.now()}`);
      },
    }] : []),
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

  return (
    <aside
      className="sidebar"
      style={width ? { width, minWidth: width } : undefined}
    >
      {onResizeStart && (
        <div className="sidebar-resize-handle" onMouseDown={onResizeStart} />
      )}
      <DatabaseSelector
        connections={connections}
        activeConnectionId={activeConnectionId}
        onConnectionSelect={onConnectionSelect}
      />
      <SidebarNav
        activeView={activeView}
        activeSessionId={activeSessionId}
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
