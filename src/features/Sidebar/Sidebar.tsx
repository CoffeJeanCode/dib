import { useState, useCallback, useEffect, useRef } from "react";
import { SystemStatusBar } from "@/components/SystemStatusBar";
import { useSavedConnections } from "@/hooks/useSavedConnections";
import { useSidebarScripts } from "@/hooks/useSidebarScripts";
import { useConnectionStore } from "@/store/connectionStore";
import { connectionService } from "@/services/connectionService";
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
  onDbAction?: (action: DbActionType, dbName?: string) => void;
  activeDb?: string;
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
  activeDb,
}: SidebarProps) {
  const { connections, remove, save } = useSavedConnections();
  const { scripts, scriptsLoading, refreshScripts } = useSidebarScripts(activeConnectionId);
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
        activeDb={activeDb}
        onConnectionSelect={onConnectionSelect}
        onScriptOpen={onScriptOpen}
        onTableSelect={onTableSelect}
        onRefreshScripts={refreshScripts}
        onDeleteConnection={deleteConn}
        onEditConnection={onEditConnection}
        onUndoDelete={undoDelete}
        undoStack={undoStack}
        onDatabaseSwitch={onDatabaseSwitch}
        onCreateDatabase={() => onDbAction?.("create")}
        onRenameDb={(dbName) => onDbAction?.("rename", dbName)}
        onDropDb={(dbName) => onDbAction?.("drop", dbName)}
      />
      <SystemStatusBar />
    </aside>
  );
}
