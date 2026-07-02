import { useState, useCallback, useEffect, useRef } from "react";
import { Database, Folder } from "lucide-react";
import { SystemStatusBar } from "@/components/SystemStatusBar";
import { useSavedConnections } from "@/hooks/useSavedConnections";
import { useSidebarScripts } from "@/hooks/useSidebarScripts";
import { useConnectionStore } from "@/store/connectionStore";
import { useWorkspaceStore } from "@/store/workspaceStore";
import { workspaceService } from "@/services/workspaceService";
import { connectionService } from "@/services/connectionService";
import {
  DatabaseSelector,
  ConnectionItem,
  WorkspaceTree,
  DatabaseCategories,
  WorkspaceList,
  QueryHistoryPanel,
} from "./Parts";
import type { SavedConnection, TableInfo } from "@/types/db";
import "./Sidebar.css";

// "explorer" only exists in unified layout; the other 4 only exist in split layout — kept in sync with Layout.tsx's Panel type.
type Panel = "explorer" | "connections" | "scripts" | "history" | "database" | "workspaces";
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
  const { connections, remove } = useSavedConnections();
  const { virtualTree, scriptsLoading, refreshScripts } = useSidebarScripts(activeConnectionId);
  const [undoStack, setUndoStack] = useState<SavedConnection[]>([]);
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const workspaceTree = useWorkspaceStore((s) => s.workspaceTree);
  const activeWorkspacePath = useWorkspaceStore((s) => s.activeWorkspacePath);

  useEffect(() => {
    if (undoStack.length === 0) return;
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    undoTimerRef.current = setTimeout(() => setUndoStack([]), 5000);
    return () => { if (undoTimerRef.current) clearTimeout(undoTimerRef.current); };
  }, [undoStack.length]);

  const deleteConn = useCallback(
    (conn: SavedConnection) => {
      setUndoStack((prev) => [...prev.slice(-4), conn]);
      const { active, setActive } = useConnectionStore.getState();
      if (active?.savedId === conn.id) {
        connectionService.disconnect(active.activeId).catch(() => {});
        setActive(null);
      }
      remove(conn.id);
    },
    [remove],
  );

  return (
    <aside
      className="sidebar"
      style={width ? { "--sidebar-width": `${width}px` } as React.CSSProperties : undefined}
    >
      {onResizeStart && (
        <div className="sidebar-resize-handle" onMouseDown={onResizeStart} />
      )}

      <DatabaseSelector
        connections={connections}
        activeConnectionId={activeConnectionId}
        activeSessionId={activeSessionId}
        connectionName={connectionName}
        onConnectionSelect={onConnectionSelect}
        onDatabaseSwitch={onDatabaseSwitch}
        onDisconnect={onDisconnect}
      />

      {activeView === "explorer" ? (
        // Unified layout, tab 1/3 — instances (compact root nodes) + entities + workspace tree.
        <nav className="sidebar-nav dg-scroll" aria-label="Explorer">
          <div className="sidebar-section-block">
            <SectionHeader Icon={Database} label="Instances" />
            {connections.length === 0 ? (
              <div className="sidebar-item sidebar-item--empty">
                <span className="sidebar-item-text sidebar-item-text--muted">No connections</span>
              </div>
            ) : (
              connections.map((conn) => (
                <ConnectionItem
                  key={conn.id}
                  conn={conn}
                  compact
                  showEntities
                  isSelected={false}
                  isActive={conn.id === activeConnectionId}
                  navIdx={-1}
                  sessionId={conn.id === activeConnectionId ? activeSessionId : null}
                  activeDb={conn.id === activeConnectionId ? activeDb : undefined}
                  onSelect={(_navIdx, connId) => onConnectionSelect?.(connId)}
                  onDbSwitch={onDatabaseSwitch}
                  onEdit={onEditConnection ?? (() => {})}
                  onDelete={deleteConn}
                  onNewQuery={conn.id === activeConnectionId ? () => onScriptOpen?.("", "New Query", `new-${Date.now()}`) : undefined}
                  onCreateDatabase={conn.id === activeConnectionId && activeSessionId ? () => onDbAction?.("create") : undefined}
                  onRenameDb={conn.id === activeConnectionId ? (db) => onDbAction?.("rename", db) : undefined}
                  onDropDb={conn.id === activeConnectionId ? (db) => onDbAction?.("drop", db) : undefined}
                  onTableSelect={onTableSelect}
                  onScriptOpen={onScriptOpen}
                />
              ))
            )}
          </div>
        </nav>
      ) : activeView === "workspaces" ? (
        <nav className="sidebar-nav dg-scroll" aria-label="Workspaces">
          <WorkspaceList />
        </nav>
      ) : activeView === "history" ? (
        // Unified tab 3/3, and split tab 4/4 — same panel, both layouts.
        <nav className="sidebar-nav dg-scroll" aria-label="Query history">
          <QueryHistoryPanel activeConnectionId={activeConnectionId} onScriptOpen={onScriptOpen} />
        </nav>
      ) : activeView === "connections" ? (
        // Home layout — Standalone instances, isolated.
        <nav className="sidebar-nav dg-scroll" aria-label="Instances">
          <div className="sidebar-section-block">
            <SectionHeader Icon={Database} label="Standalone" />
            {connections.length === 0 ? (
              <div className="sidebar-item sidebar-item--empty">
                <span className="sidebar-item-text sidebar-item-text--muted">No connections</span>
              </div>
            ) : (
              connections.map((conn) => (
                <ConnectionItem
                  key={conn.id}
                  conn={conn}
                  isSelected={false}
                  isActive={conn.id === activeConnectionId}
                  navIdx={-1}
                  sessionId={conn.id === activeConnectionId ? activeSessionId : null}
                  activeDb={conn.id === activeConnectionId ? activeDb : undefined}
                  onSelect={(_navIdx, connId) => onConnectionSelect?.(connId)}
                  onDbSwitch={onDatabaseSwitch}
                  onEdit={onEditConnection ?? (() => {})}
                  onDelete={deleteConn}
                  onNewQuery={conn.id === activeConnectionId ? () => onScriptOpen?.("", "New Query", `new-${Date.now()}`) : undefined}
                  onCreateDatabase={conn.id === activeConnectionId && activeSessionId ? () => onDbAction?.("create") : undefined}
                  onRenameDb={conn.id === activeConnectionId ? (db) => onDbAction?.("rename", db) : undefined}
                  onDropDb={conn.id === activeConnectionId ? (db) => onDbAction?.("drop", db) : undefined}
                />
              ))
            )}
          </div>
        </nav>
      ) : activeView === "database" ? (
        // Split layout, tab 2/4 — Entities (tables/views/functions/procedures/triggers), isolated.
        <nav className="sidebar-nav dg-scroll" aria-label="Entities">
          <DatabaseCategories
            sessionId={activeSessionId}
            onTableSelect={onTableSelect}
            onScriptOpen={onScriptOpen}
          />
        </nav>
      ) : (
        // Unified tab 2/3, and split tab 3/4 — Scripts, isolated (own tab, own mount).
        <nav className="sidebar-nav dg-scroll" aria-label="Scripts">
          <div className="sidebar-section-block">
            <SectionHeader Icon={activeWorkspacePath ? Folder : Database} label={activeWorkspacePath ? "Workspace" : "Scripts"} />
            {(activeWorkspacePath ? workspaceTree : virtualTree) ? (
              <WorkspaceTree 
                tree={(activeWorkspacePath ? workspaceTree : virtualTree)!} 
                connectionId={activeWorkspacePath ? undefined : activeConnectionId}
                onRefresh={activeWorkspacePath ? undefined : refreshScripts}
                onNodeClick={async (node) => {
                  if (node.isDir) return;
                  if (activeWorkspacePath) {
                    try {
                      const content = await workspaceService.readTextFile(node.path);
                      onScriptOpen?.(content, node.name, node.path);
                    } catch (e) {
                      console.error("Failed to read file", e);
                    }
                  } else {
                    onScriptOpen?.(node.content || "", node.name, node.path);
                  }
                }}
              />
            ) : scriptsLoading ? (
              <div className="sidebar-item sidebar-item--empty">
                <span className="sidebar-item-text sidebar-item-text--muted">Loading...</span>
              </div>
            ) : (
              <div className="sidebar-item sidebar-item--empty">
                <span className="sidebar-item-text sidebar-item-text--muted">Empty workspace</span>
              </div>
            )}
          </div>
        </nav>
      )}

      <SystemStatusBar />
    </aside>
  );
}

function SectionHeader({ Icon, label }: { Icon: React.ComponentType<{ size?: number | string }>; label: string }) {
  return (
    <div className="sidebar-section-header">
      <Icon size={13} />
      <span>{label}</span>
    </div>
  );
}
