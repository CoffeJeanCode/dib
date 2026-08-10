import { useEffect, useState } from "react";
import { Server, Plus, FolderOpen, Folder, ArrowLeft } from "lucide-react";
import { useSavedConnections } from "@/shared/hooks/useSavedConnections";
import { workspaceService } from "@/services/workspaceService";
import { useWorkspaceStore } from "@/store/workspaceStore";
import { useUiStore } from "@/store/uiStore";
import { openWorkspaceAndConnect, getLastSessionScope } from "@/shared/utils/quickConnect";
import { SkeletonCard } from "@/shared/ui/Skeleton";
import { DangerConfirmDialog } from "@/shared/ui/DangerConfirmDialog";
import { Tooltip } from "@/shared/ui/Tooltip";
import { InstanceContextMenu } from "@/features/Sidebar/Parts/InstanceContextMenu";
import { ReadonlyBadge } from "@/shared/ui/ReadonlyBadge";
import { confirmToggleConnectionReadonly } from "@/shared/utils/toggleConnectionReadonly";
import type { SavedConnection } from "@/types/db";
import type { Workspace } from "@/types/workspace";
import { open } from "@tauri-apps/plugin-dialog";
import "./HomeView.css";

interface HomeViewProps {
  onConnectionSelect: (savedId: string) => void;
  onNewConnection: () => void;
}

const ENGINE_COLORS: Record<string, string> = {
  postgres: "blue",
  postgresql: "blue",
  sqlite: "gray",
};

export function HomeView({ onConnectionSelect, onNewConnection }: HomeViewProps) {
  const { connections, loaded, remove, save } = useSavedConnections();
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);
  const activeWorkspacePath = useWorkspaceStore((s) => s.activeWorkspacePath);
  const setActiveWorkspacePath = useWorkspaceStore((s) => s.setActiveWorkspacePath);
  const setEditingConn = useUiStore((s) => s.setEditingConn);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [wsLoading, setWsLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<SavedConnection | null>(null);

  const inWorkspace = !!activeWorkspaceId;
  const workspaceName =
    workspaces.find((w) => w.id === activeWorkspaceId)?.name ??
    activeWorkspacePath?.split(/[/\\]/).pop() ??
    "Workspace";

  const lastScope = getLastSessionScope();
  // Emphasize the door the user is more likely to use — still both clickable.
  const preferWorkspaces =
    !inWorkspace &&
    !wsLoading &&
    loaded &&
    workspaces.length > 0 &&
    ((lastScope !== null && lastScope !== "__global__") || connections.length === 0);
  const preferConnect = !inWorkspace && !preferWorkspaces;

  useEffect(() => {
    workspaceService
      .getWorkspaces()
      .then(setWorkspaces)
      .catch(() => setWorkspaces([]))
      .finally(() => setWsLoading(false));
  }, []);

  const getLabel = (conn: SavedConnection) => {
    if (conn.db_name) return conn.db_name;
    if (conn.path) return conn.path.split(/[/\\]/).pop() || conn.path;
    return conn.name;
  };

  const handleCreateWorkspace = async () => {
    try {
      const selectedPath = await open({ directory: true, multiple: false });
      if (!selectedPath || typeof selectedPath !== "string") return;

      const folderName = selectedPath.split(/[/\\]/).pop() || "New Workspace";
      const name = prompt("Workspace Name:", folderName);
      if (!name) return;

      const ws = await workspaceService.createWorkspace(name, selectedPath);
      setActiveWorkspacePath(ws.root_path, ws.id);
    } catch (e) {
      console.error(e);
      alert("Failed to create workspace: " + String(e));
    }
  };

  return (
    <div className={`home${inWorkspace ? " home--workspace" : ""}`}>
      <div className="home-hero">
        <h1 className="home-title">DIB</h1>
        {inWorkspace ? (
          <Tooltip content={activeWorkspacePath ?? workspaceName}>
            <p className="home-mode-badge">
              <Folder size={12} />
              <span>{workspaceName}</span>
            </p>
          </Tooltip>
        ) : (
          <p className="home-subtitle">Data Illustrative Base</p>
        )}
      </div>

      {inWorkspace ? (
        <div className="home-actions home-actions-wrapper">
          <Tooltip content="Back to global home">
            <button
              type="button"
              className="home-new-btn home-new-btn--secondary"
              onClick={() => setActiveWorkspacePath(null)}
            >
              <ArrowLeft size={16} />
              Leave
            </button>
          </Tooltip>
          <Tooltip content="Create a connection in this workspace">
            <button type="button" className="home-new-btn" onClick={onNewConnection}>
              <Plus size={16} />
              Add
            </button>
          </Tooltip>
        </div>
      ) : (
        <div className="home-path-grid">
          <Tooltip content="Connect without a project folder">
            <button
              type="button"
              className={`home-path-card${preferConnect ? " home-path-card--emphasis" : ""}`}
              onClick={onNewConnection}
            >
              <Server size={22} className="home-path-icon home-path-icon--teal" />
              <span className="home-path-title">Connect</span>
              <span className="home-path-sub">Quick database access</span>
            </button>
          </Tooltip>
          <Tooltip content="Open a folder as a workspace">
            <button
              type="button"
              className={`home-path-card${preferWorkspaces ? " home-path-card--emphasis" : ""}`}
              onClick={() => void handleCreateWorkspace()}
            >
              <FolderOpen size={22} className="home-path-icon home-path-icon--orange" />
              <span className="home-path-title">Open</span>
              <span className="home-path-sub">Project folder with scripts</span>
            </button>
          </Tooltip>
        </div>
      )}

      <div className="home-sections-container">
        {!inWorkspace && (wsLoading || workspaces.length > 0) && (
          <div className="home-recent home-recent-col">
            <span className="home-section-label">
              <Folder size={11} /> Workspaces
            </span>
            <div className="home-conn-list">
              {wsLoading && (
                <>
                  <SkeletonCard />
                  <SkeletonCard />
                </>
              )}
              {!wsLoading &&
                workspaces.map((ws) => (
                  <Tooltip key={ws.id} content={ws.root_path}>
                    <button
                      type="button"
                      className="home-conn-card"
                      onClick={() => void openWorkspaceAndConnect(ws, onConnectionSelect)}
                    >
                      <Folder size={18} className="home-conn-icon home-conn-icon--yellow" />
                      <div className="home-conn-info">
                        <span className="home-conn-name">{ws.name}</span>
                        <span className="home-conn-detail">Open</span>
                      </div>
                    </button>
                  </Tooltip>
                ))}
            </div>
          </div>
        )}

        {(!loaded || connections.length > 0 || inWorkspace) && (
          <div className="home-recent home-recent-col">
            <div className="home-section-label-row">
              <span className="home-section-label">
                <Server size={11} /> Instances
              </span>
              {inWorkspace && (
                <Tooltip content="Add instance to this workspace">
                  <button type="button" className="home-section-add" onClick={onNewConnection}>
                    <Plus size={14} />
                  </button>
                </Tooltip>
              )}
            </div>
            <div className="home-conn-list">
              {!loaded && (
                <>
                  <SkeletonCard />
                  <SkeletonCard />
                  <SkeletonCard />
                </>
              )}
              {loaded && connections.length === 0 && inWorkspace && (
                <Tooltip content="Add instance to this workspace">
                  <button
                    type="button"
                    className="home-conn-card home-conn-card--add"
                    onClick={onNewConnection}
                  >
                    <Plus size={18} className="home-conn-icon home-conn-icon--teal" />
                    <div className="home-conn-info">
                      <span className="home-conn-name">Add instance</span>
                    </div>
                  </button>
                </Tooltip>
              )}
              {loaded &&
                connections.map((conn) => (
                  <Tooltip key={conn.id} content={`Connect · ${conn.engine} · ${getLabel(conn)}`}>
                    <div className="home-conn-tooltip-target">
                      <InstanceContextMenu
                        onEditConnection={() => setEditingConn(conn)}
                        onRemoveConnection={() => setDeleteTarget(conn)}
                        onToggleReadonly={() => confirmToggleConnectionReadonly(conn, save)}
                        isReadonly={!!conn.readonly}
                      >
                        <button
                          type="button"
                          className="home-conn-card"
                          onClick={() => onConnectionSelect(conn.id)}
                        >
                          <Server
                            size={18}
                            className={`home-conn-icon home-conn-icon--${ENGINE_COLORS[conn.engine?.toLowerCase()] ?? "gray"}`}
                          />
                          <div className="home-conn-info">
                            <span className="home-conn-name">
                              {conn.name}
                              {conn.readonly ? <ReadonlyBadge size={12} /> : null}
                            </span>
                            <span className="home-conn-detail">
                              {conn.readonly ? "Read-only · Connect" : "Connect"}
                            </span>
                          </div>
                        </button>
                      </InstanceContextMenu>
                    </div>
                  </Tooltip>
                ))}
            </div>
          </div>
        )}
      </div>

      {deleteTarget && (
        <DangerConfirmDialog
          message={`Delete connection "${deleteTarget.name}"? This cannot be undone.`}
          confirmLabel="Delete"
          onConfirm={async () => {
            remove(deleteTarget.id);
            setDeleteTarget(null);
          }}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
