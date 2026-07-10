import { useState, useCallback, useEffect, useRef } from "react";
import { Database, Folder, RefreshCw, FilePlus, FolderPlus } from "lucide-react";
import { DangerConfirmDialog } from "@/shared/ui/DangerConfirmDialog";
import { SystemStatusBar } from "@/features/Sidebar/Parts/SystemStatusBar";
import { useSavedConnections } from "@/shared/hooks/useSavedConnections";
import { useSidebarScripts } from "@/shared/hooks/useSidebarScripts";
import { useConnectionStore } from "@/store/connectionStore";
import { useWorkspaceStore } from "@/store/workspaceStore";
import { workspaceService } from "@/services/workspaceService";
import { connectionService } from "@/services/connectionService";
import {
  DatabaseSelector,
  ConnectionItem,
  WorkspaceTree,
  DatabaseTree,
  WorkspaceList,
  QueryHistoryPanel,
} from "./Parts";
import type { WorkspaceTreeRef } from "./Parts/WorkspaceTree";
import type { SavedConnection, TableInfo } from "@/types/db";
import "./Sidebar.css";

import { useUiStore } from "@/store/uiStore";

type Panel = "explorer" | "connections" | "scripts" | "history" | "database" | "workspaces";
type DbActionType = "create" | "rename" | "drop";

interface SidebarProps {
  activeView: Panel;
  width?: number;
  onResizeStart?: (e: React.MouseEvent) => void;
}

export function Sidebar({
  activeView,
  width,
  onResizeStart,
}: SidebarProps) {
  const { connections, remove } = useSavedConnections();
  
  const active = useConnectionStore((s) => s.active);
  const selectConnection = useConnectionStore((s) => s.selectConnection);
  const switchDatabase = useConnectionStore((s) => s.switchDatabase);
  const disconnect = useConnectionStore((s) => s.disconnect);
  const activeConnectionId = active?.savedId ?? null;
  const activeSessionId = active?.activeId ?? null;
  const connectionName = active?.name;
  const activeDb = active?.name;

  const setOpenScript = useWorkspaceStore((s) => s.setOpenScript);
  const setNavigateTo = useWorkspaceStore((s) => s.setNavigateTo);
  const onScriptOpen = useCallback((sql: string, name: string, id: string) => setOpenScript({ sql, name, id: id ?? `ext-${Date.now()}`, v: Date.now() } as any), [setOpenScript]);
  const onTableSelect = useCallback((table: TableInfo) => setNavigateTo({ table, v: Date.now() } as any), [setNavigateTo]);

  const setDbAction = useUiStore((s) => s.setDbAction);
  const setEditingConn = useUiStore((s) => s.setEditingConn);
  const onDbAction = useCallback((action: DbActionType, dbName?: string) => setDbAction({ action, dbName }), [setDbAction]);
  const onEditConnection = useCallback((conn: SavedConnection) => setEditingConn(conn), [setEditingConn]);
  const { virtualTree, scriptsLoading, refreshScripts } = useSidebarScripts(activeConnectionId);

  const workspaceTreeRef = useRef<WorkspaceTreeRef>(null);

  const [deleteTarget, setDeleteTarget] = useState<SavedConnection | null>(null);
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
      setDeleteTarget(null);
    },
    [remove],
  );

  return (
    <aside
      className="sidebar"
      id="dib-sidebar-nav"
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
        onConnectionSelect={selectConnection}
        onDatabaseSwitch={switchDatabase}
        onDisconnect={disconnect}
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
                    onSelect={(_navIdx, connId) => selectConnection(connId)}
                    onDbSwitch={switchDatabase}
                    onEdit={onEditConnection}
                    onDelete={setDeleteTarget}
                    onNewQuery={!activeWorkspacePath && conn.id === activeConnectionId ? () => onScriptOpen("", "New Query", `new-${Date.now()}`) : undefined}
                    onCreateDatabase={conn.id === activeConnectionId && activeSessionId ? () => onDbAction("create") : undefined}
                    onRenameDb={conn.id === activeConnectionId ? (db) => onDbAction("rename", db) : undefined}
                    onDropDb={conn.id === activeConnectionId ? (db) => onDbAction("drop", db) : undefined}
                    onTableSelect={onTableSelect}
                    onScriptOpen={onScriptOpen}
                  />
               ))
             )}
           </div>
          </nav>
       ) : activeView === "workspaces" ? (
        <nav className="sidebar-nav dg-scroll" aria-label="Workspaces">
          <WorkspaceList onConnectionSelect={selectConnection} />
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
                  onSelect={(_navIdx, connId) => selectConnection(connId)}
                  onDbSwitch={switchDatabase}
                  onEdit={onEditConnection}
                   onDelete={setDeleteTarget}
                   onNewQuery={conn.id === activeConnectionId ? () => onScriptOpen("", "New Query", `new-${Date.now()}`) : undefined}
                   onCreateDatabase={conn.id === activeConnectionId && activeSessionId ? () => onDbAction("create") : undefined}
                   onRenameDb={conn.id === activeConnectionId ? (db) => onDbAction("rename", db) : undefined}
                   onDropDb={conn.id === activeConnectionId ? (db) => onDbAction("drop", db) : undefined}
                 />
               ))
             )}
           </div>
         </nav>
       ) : activeView === "database" ? (
        // Split layout, tab 2/4 — Entities (tables/views/functions/procedures/triggers), isolated.
        <nav className="sidebar-nav dg-scroll" aria-label="Entities">
          <DatabaseTree
            onNodeClick={(node) => {
              if (node.type === "table") {
                setNavigateTo({ table: { name: node.label, schema: null }, v: Date.now() } as any);
              }
            }}
          />
        </nav>
      ) : (
        <nav className="sidebar-nav dg-scroll" aria-label="Scripts">
          <div className="sidebar-section-block" style={{ display: "flex", flexDirection: "column", flex: 1 }}>
            <SectionHeader 
              Icon={activeWorkspacePath ? Folder : Database} 
              label={activeWorkspacePath ? "Workspace" : "Scripts"} 
              onRefresh={activeWorkspacePath ? () => useWorkspaceStore.getState().loadWorkspaceTree(activeWorkspacePath, useWorkspaceStore.getState().activeWorkspaceId) : undefined} 
              actions={
                <>
                  <button className="sidebar-section-header-action" onClick={(e) => { e.stopPropagation(); workspaceTreeRef.current?.createFile(); }} title="New File"><FilePlus /></button>
                  <button className="sidebar-section-header-action" onClick={(e) => { e.stopPropagation(); workspaceTreeRef.current?.createFolder(); }} title="New Folder"><FolderPlus /></button>
                </>
              }
            />
            {(activeWorkspacePath ? workspaceTree : virtualTree) ? (
              <WorkspaceTree 
                ref={workspaceTreeRef}
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

      {deleteTarget && (
        <DangerConfirmDialog
          message={`Delete connection "${deleteTarget.name}"? This cannot be undone.`}
          confirmLabel="Delete"
          onConfirm={async () => deleteConn(deleteTarget)}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </aside>
  );
}

function SectionHeader({ Icon, label, onRefresh, actions }: { Icon: React.ComponentType<{ size?: number | string }>; label: string; onRefresh?: () => void; actions?: React.ReactNode }) {
  return (
    <div className="sidebar-section-header">
      <Icon size={13} />
      <span>{label}</span>
      <div style={{ marginLeft: "auto", display: "flex", gap: "4px" }}>
        {actions}
        {onRefresh && (
          <button
            className="sidebar-section-header-action"
            onClick={(e) => { e.stopPropagation(); onRefresh(); }}
            title="Refresh file tree"
          >
            <RefreshCw />
          </button>
        )}
      </div>
    </div>
  );
}
