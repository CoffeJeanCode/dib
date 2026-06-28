import { useState, useCallback, useEffect, useRef } from "react";
import { Pencil, Trash2, FileCode2, Plus, Edit3 } from "lucide-react";
import { SystemStatusBar } from "@/components/SystemStatusBar";
import { useSavedConnections } from "@/hooks/useSavedConnections";
import { useSidebarScripts } from "@/hooks/useSidebarScripts";
import { useContextMenu } from "@/hooks/useContextMenu";
import { useConnectionStore } from "@/store/connectionStore";
import { connectionService } from "@/services/connectionService";
import { ContextMenu } from "@/components/ContextMenu";
import { DatabaseSelector, SidebarNav } from "./Parts";
import type { SavedConnection, TableInfo } from "@/types/db";
import "./Sidebar.css";

type Panel = "connections" | "scripts" | "history" | "database" | "files";

type DbActionType = "create" | "rename" | "drop";

interface SidebarProps {
  activeView: Panel;
  width?: number;
  activeConnectionId?: string | null;
  activeSessionId?: string | null;
  onResizeStart?: (e: React.MouseEvent) => void;
  onConnectionSelect?: (savedId: string) => void;
  connectionName?: string;
  onScriptOpen?: (sql: string, title: string, id: string) => void;
  onTableSelect?: (table: TableInfo) => void;
  onDatabaseSwitch?: (db: string) => void;
  onDisconnect?: () => void;
  onEditConnection?: (conn: SavedConnection) => void;
  onDbAction?: (action: DbActionType) => void;
}

export function Sidebar({
  activeView,
  width,
  activeConnectionId,
  activeSessionId,
  onResizeStart,
  connectionName,
  onConnectionSelect,
  onScriptOpen,
  onTableSelect,
  onDatabaseSwitch,
  onDisconnect,
  onEditConnection,
  onDbAction,
}: SidebarProps) {
  const { connections, remove, save } = useSavedConnections();
  const { scripts, scriptsLoading, refreshScripts } = useSidebarScripts(activeConnectionId);
  const { menuState, openMenu, closeMenu } = useContextMenu();
  const [contextConnId, setContextConnId] = useState<string | null>(null);
  const [undoStack, setUndoStack] = useState<SavedConnection[]>([]);
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (undoStack.length === 0) return;
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    undoTimerRef.current = setTimeout(() => setUndoStack([]), 5000);
    return () => { if (undoTimerRef.current) clearTimeout(undoTimerRef.current); };
  }, [undoStack.length]);

  const deleteConn = useCallback(
    (conn: SavedConnection) => {
      setUndoStack((prev) => [...prev.slice(-4), conn]);
      // Disconnect the session if this is the currently active connection.
      const { active, setActive } = useConnectionStore.getState();
      if (active?.savedId === conn.id) {
        connectionService.disconnect(active.activeId).catch(() => {});
        setActive(null);
      }
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
      label: "New SQL Query",
      onClick: () => {
        handleClose();
        onScriptOpen?.("", "New Query", `new-${Date.now()}`);
      },
    }] : []),
    ...(activeSessionId ? [
      { icon: <Plus size={14} />,    label: "Create Database…", onClick: () => { handleClose(); onDbAction?.("create"); } },
      { icon: <Edit3 size={14} />,   label: "Rename Database…", onClick: () => { handleClose(); onDbAction?.("rename"); } },
      { icon: <Trash2 size={14} />,  label: "Delete Database…", danger: true as const, onClick: () => { handleClose(); onDbAction?.("drop"); } },
    ] : []),
    {
      icon: <Pencil size={14} />,
      label: "Edit Connection",
      onClick: () => {
        const conn = connections.find((c) => c.id === contextConnId);
        if (conn) onEditConnection?.(conn);
        handleClose();
      },
    },
    {
      icon: <Trash2 size={14} />,
      label: "Delete",
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
      style={width ? { "--sidebar-width": `${width}px` } as React.CSSProperties : undefined}
    >
      {onResizeStart && (
        <div className="sidebar-resize-handle" onMouseDown={onResizeStart} />
      )}

      {/* ── Unified Database/Connection Selector ── */}
      <DatabaseSelector
        connections={connections}
        activeConnectionId={activeConnectionId}
        activeSessionId={activeSessionId}
        connectionName={connectionName}
        onConnectionSelect={onConnectionSelect}
        onDatabaseSwitch={onDatabaseSwitch}
        onDisconnect={onDisconnect}
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
        onTableSelect={onTableSelect}
        onRefreshScripts={refreshScripts}
        onDeleteConnection={deleteConn}
        onEditConnection={onEditConnection}
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
      <SystemStatusBar />
    </aside>
  );
}
