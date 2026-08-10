import { useState, useCallback, useEffect, useRef } from "react";
import { Database, Folder, RefreshCw, FilePlus, FolderPlus, ChevronDown } from "lucide-react";
import { DangerConfirmDialog } from "@/shared/ui/DangerConfirmDialog";
import { SystemStatusBar } from "@/features/Sidebar/Parts/SystemStatusBar";
import { useSavedConnections } from "@/shared/hooks/useSavedConnections";
import { useSidebarScripts } from "@/shared/hooks/useSidebarScripts";
import { useConnectionStore } from "@/store/connectionStore";
import { useWorkspaceStore } from "@/store/workspaceStore";
import { useToastStore } from "@/store/toastStore";
import { workspaceService } from "@/services/workspaceService";
import { EntityBrowser } from "./EntityBrowser";
import {
  DatabaseSelector,
  WorkspaceTree,
  WorkspaceList,
  QueryHistoryPanel,
} from "./Parts";
import type { WorkspaceTreeRef } from "./Parts/WorkspaceTree";
import type { SavedConnection } from "@/types/db";
import type { FsNode } from "@/types/workspace";
import "./Sidebar.css";

type Panel = "explorer" | "files" | "history" | "workspaces";

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

  const setOpenScript = useWorkspaceStore((s) => s.setOpenScript);
  const setPendingScriptRun = useWorkspaceStore((s) => s.setPendingScriptRun);
  const onScriptOpen = useCallback((sql: string, name: string, id: string) => setOpenScript({ sql, name, id: id ?? `ext-${Date.now()}`, v: Date.now() } as any), [setOpenScript]);
  const { virtualTree, scriptsLoading, refreshScripts } = useSidebarScripts(activeConnectionId);
  const toastError = useToastStore((s) => s.error);

  const workspaceTreeRef = useRef<WorkspaceTreeRef>(null);

  const [deleteTarget, setDeleteTarget] = useState<SavedConnection | null>(null);
  const [undoStack, setUndoStack] = useState<SavedConnection[]>([]);
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const workspaceTree = useWorkspaceStore((s) => s.workspaceTree);
  const activeWorkspacePath = useWorkspaceStore((s) => s.activeWorkspacePath);

  const onScriptRun = useCallback(async (node: FsNode) => {
    if (node.isDir || node.is_dir) return;
    if (!activeSessionId) {
      toastError("Connect to a database to run scripts");
      return;
    }
    try {
      let sql = node.content ?? "";
      if (activeWorkspacePath) {
        sql = await workspaceService.readTextFile(node.path);
      }
      if (!sql.trim()) {
        toastError("Script is empty");
        return;
      }
      setPendingScriptRun({ sql, name: node.name, id: node.path, v: Date.now() });
    } catch (e) {
      console.error("Failed to read script for run", e);
      toastError("Failed to read script");
    }
  }, [activeSessionId, activeWorkspacePath, setPendingScriptRun, toastError]);

  // The Files panel header doubles as the workspace switcher: no workspace
  // open means the picker is what you need, so it opens on that.
  const [showWorkspaces, setShowWorkspaces] = useState(!activeWorkspacePath);
  useEffect(() => { if (activeWorkspacePath) setShowWorkspaces(false); }, [activeWorkspacePath]);
  const workspaceLabel = activeWorkspacePath
    ? (activeWorkspacePath.split(/[/\\]/).filter(Boolean).pop() ?? "Workspace")
    : "App scripts";
  const filesHeaderTitle = activeWorkspacePath
    ? "Workspace folder on disk"
    : "Scripts stored inside DIB (standalone)";

  useEffect(() => {
    if (undoStack.length === 0) return;
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    undoTimerRef.current = setTimeout(() => setUndoStack([]), 5000);
    return () => { if (undoTimerRef.current) clearTimeout(undoTimerRef.current); };
  }, [undoStack.length]);

  const deleteConn = useCallback(
    (conn: SavedConnection) => {
      setUndoStack((prev) => [...prev.slice(-4), conn]);
      remove(conn.id);
      setDeleteTarget(null);
    },
    [remove],
  );

  return (
    <aside
      className="sidebar"
      id="dib-sidebar-nav"
      tabIndex={-1}
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
        <EntityBrowser
          onScriptOpen={onScriptOpen}
          onDeleteTarget={setDeleteTarget}
        />
      ) : activeView === "workspaces" ? (
        <nav className="sidebar-nav dg-scroll" aria-label="Workspaces">
          <WorkspaceList onConnectionSelect={selectConnection} />
        </nav>
      ) : activeView === "history" ? (
        <nav className="sidebar-nav dg-scroll" aria-label="Query history">
          <QueryHistoryPanel activeConnectionId={activeConnectionId} onScriptOpen={onScriptOpen} />
        </nav>
      ) : (
        <nav className="sidebar-nav dg-scroll" aria-label="Files">
          <div className="sidebar-section-block" style={{ display: "flex", flexDirection: "column", flex: 1 }}>
            <SectionHeader
              Icon={activeWorkspacePath ? Folder : Database}
              label={workspaceLabel}
              title={filesHeaderTitle}
              expanded={showWorkspaces}
              onToggle={() => setShowWorkspaces((v) => !v)}
              onRefresh={!showWorkspaces && activeWorkspacePath ? () => useWorkspaceStore.getState().loadWorkspaceTree(activeWorkspacePath, useWorkspaceStore.getState().activeWorkspaceId) : undefined}
              actions={
                // The tree is unmounted while the picker is open — its actions
                // would be silent no-ops, so don't offer them.
                showWorkspaces ? null : (
                  <>
                    <button type="button" className="sidebar-section-header-action" onClick={(e) => { e.stopPropagation(); workspaceTreeRef.current?.createFile(); }} title="New File"><FilePlus /></button>
                    <button type="button" className="sidebar-section-header-action" onClick={(e) => { e.stopPropagation(); workspaceTreeRef.current?.createFolder(); }} title="New Folder"><FolderPlus /></button>
                  </>
                )
              }
            />
            {showWorkspaces ? (
              <WorkspaceList onConnectionSelect={selectConnection} />
            ) : (activeWorkspacePath ? workspaceTree : virtualTree) ? (
              <WorkspaceTree 
                ref={workspaceTreeRef}
                tree={(activeWorkspacePath ? workspaceTree : virtualTree)!} 
                connectionId={activeWorkspacePath ? undefined : activeConnectionId}
                onRefresh={activeWorkspacePath ? undefined : refreshScripts}
                onNodeRun={onScriptRun}
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

function SectionHeader({ Icon, label, title, onRefresh, actions, expanded, onToggle }: {
  Icon: React.ComponentType<{ size?: number | string }>;
  label: string;
  title?: string;
  onRefresh?: () => void;
  actions?: React.ReactNode;
  /** When provided, the label becomes a button that swaps in the workspace picker. */
  expanded?: boolean;
  onToggle?: () => void;
}) {
  return (
    <div className="sidebar-section-header">
      {onToggle ? (
        <button
          className="sidebar-section-header-toggle"
          onClick={onToggle}
          aria-expanded={expanded}
          title={title ?? "Switch workspace"}
        >
          <Icon size={13} />
          <span>{label}</span>
          <ChevronDown
            size={11}
            aria-hidden
            style={{
              transition: "transform var(--transition-fast, 0.15s)",
              transform: expanded ? "rotate(180deg)" : undefined,
            }}
          />
        </button>
      ) : (
        <>
          <Icon size={13} />
          <span title={title}>{label}</span>
        </>
      )}
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
