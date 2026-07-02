import { Database, Plus, FolderOpen } from "lucide-react";
import { useSavedConnections } from "@/hooks/useSavedConnections";
import { workspaceService } from "@/services/workspaceService";
import { useWorkspaceStore } from "@/store/workspaceStore";
import type { SavedConnection } from "@/types/db";
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
  const { connections } = useSavedConnections();
  const setActiveWorkspacePath = useWorkspaceStore(s => s.setActiveWorkspacePath);

  const getLabel = (conn: SavedConnection) => {
    if (conn.db_name) return conn.db_name;
    if (conn.path) return conn.path.split(/[/\\]/).pop() || conn.path;
    return conn.name;
  };

  const handleCreateWorkspace = async () => {
    try {
      const selectedPath = await open({ directory: true, multiple: false });
      if (!selectedPath || typeof selectedPath !== 'string') return;
      
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
    <div className="home">
      <div className="home-hero">
        <h1 className="home-title">DIB</h1>
        <p className="home-subtitle">Data Illustrative Base</p>
      </div>

      <div className="home-actions" style={{ gap: "12px", justifyContent: "center", display: "flex" }}>
        <button className="home-new-btn" onClick={onNewConnection}>
          <Plus size={16} />
          New Connection
        </button>
        <button className="home-new-btn" onClick={handleCreateWorkspace} style={{ background: "var(--color-bg-tertiary)", color: "var(--color-text)", border: "1px solid var(--color-border)" }}>
          <FolderOpen size={16} />
          Open Folder / Workspace
        </button>
      </div>

      <div style={{ display: "flex", gap: "32px", justifyContent: "center", flexWrap: "wrap", width: "100%", maxWidth: "800px" }}>
        {connections.length > 0 && (
          <div className="home-recent" style={{ flex: 1, minWidth: "250px" }}>
            <span className="home-section-label">Global Connections</span>
            <div className="home-conn-list">
              {connections.map((conn) => (
                <div
                  key={conn.id}
                  className="home-conn-card"
                  onClick={() => onConnectionSelect(conn.id)}
                >
                  <Database
                    size={18}
                    className={`home-conn-icon home-conn-icon--${ENGINE_COLORS[conn.engine?.toLowerCase()] ?? "gray"}`}
                  />
                  <div className="home-conn-info">
                    <span className="home-conn-name">{conn.name}</span>
                    <span className="home-conn-detail">
                      {conn.engine} · {getLabel(conn)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
