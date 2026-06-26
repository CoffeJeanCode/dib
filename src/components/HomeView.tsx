import { Database, Plus } from "lucide-react";
import { useSavedConnections } from "@/hooks/useSavedConnections";
import type { SavedConnection } from "@/types/db";
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

  const getLabel = (conn: SavedConnection) => {
    if (conn.db_name) return conn.db_name;
    if (conn.path) return conn.path.split(/[/\\]/).pop() || conn.path;
    return conn.name;
  };

  return (
    <div className="home">
      <div className="home-hero">
        <h1 className="home-title">DIB</h1>
        <p className="home-subtitle">Data Illustrative Base</p>
      </div>

      <div className="home-actions">
        <button className="home-new-btn" onClick={onNewConnection}>
          <Plus size={16} />
          New Connection
        </button>
      </div>

      {connections.length > 0 && (
        <div className="home-recent">
          <span className="home-section-label">Recent Connections</span>
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
  );
}
