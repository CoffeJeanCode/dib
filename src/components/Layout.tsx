import { useUiState } from "../hooks/useUiState";
import { Sidebar } from "./Sidebar";
import type { ScriptInfo, SavedConnection } from "../types/db";
import "./Layout.css";

interface LayoutProps {
  children: React.ReactNode;
  onConnectionSelect?: (connectionId: string) => void;
  onScriptOpen?: (script: ScriptInfo) => void;
  onEditConnection?: (conn: SavedConnection) => void;
  onSettingsOpen?: () => void;
}

export function Layout({ children, onConnectionSelect, onScriptOpen, onEditConnection, onSettingsOpen }: LayoutProps) {
  const { state, loaded, toggleSidebar } = useUiState();

  if (!loaded) {
    return (
      <div className="layout">
        <div className="main-content" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
          <span className="sidebar-item-text sidebar-item-text--muted">Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="layout">
      <Sidebar
        collapsed={!state.is_sidebar_open}
        onToggle={toggleSidebar}
        onConnectionSelect={onConnectionSelect}
        onScriptOpen={onScriptOpen}
        onEditConnection={onEditConnection}
        onSettingsOpen={onSettingsOpen}
      />

      <main className="main-content">
        {children}
      </main>
    </div>
  );
}
