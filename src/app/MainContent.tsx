import { ArrowLeft } from "lucide-react";
import { Skeleton } from "@/shared/ui/Skeleton";
import { ConnectionManager } from "@/features/Connections/ConnectionManager";
import { QueryPanel } from "@/features/QueryPanel";
import { HomeView } from "@/features/Home/HomeView";
import { useWorkspaceStore } from "@/store/workspaceStore";
import type { ConnectionInfo, SavedConnection } from "@/types/db";
import type { ActiveConn } from "@/store/connectionStore";
import type { NavTable, OpenScript } from "@/types/workspace";

interface Props {
  editingConn: SavedConnection | null;
  showNewConnection: boolean;
  connecting: boolean;
  active: ActiveConn | null;
  navigateTo: NavTable | null;
  openScript: OpenScript | null;
  onEditSaved: () => void;
  onConnected: (connInfo: ConnectionInfo) => void;
  onBack: () => void;
  onConnectionSelect: (savedId: string, password?: string) => Promise<boolean | void>;
  onNewConnection: () => void;
}

export function MainContent({ editingConn, showNewConnection, connecting, active, navigateTo, openScript, onEditSaved, onConnected, onBack, onConnectionSelect, onNewConnection }: Props) {
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);

  if (editingConn) {
    return (
      <div className="app-centered">
        <button className="app-back-btn" onClick={onEditSaved}>
          <ArrowLeft size={14} />
          Back
        </button>
        <ConnectionManager editing={editingConn} onEditSaved={onEditSaved} />
      </div>
    );
  }
  if (showNewConnection) {
    return (
      <div className="app-centered">
        <button className="app-back-btn" onClick={onBack}>
          <ArrowLeft size={14} />
          Back
        </button>
        <ConnectionManager onConnected={onConnected} />
      </div>
    );
  }
  if (!connecting && active) {
    // Tab scope: in a workspace, tabs belong to the WORKSPACE (survive
    // connection switches); standalone, they belong to the specific database
    // (each database restores its own tab set). 
    // We do not force remounts unnecessarily in workspace mode; useDatabaseEngine 
    // handles connectionId changes gracefully, maintaining UI state (scroll, cursor).
    const scopeKey = activeWorkspaceId ? `ws:${activeWorkspaceId}` : `conn:${active.savedId}:${active.name}`;
    return (
      <QueryPanel
        key={scopeKey}
        scopeKey={scopeKey}
        connectionId={active.activeId}
        connectionName={active.name}
        engine={active.engine}
        navigateTo={navigateTo}
        openScript={openScript}
      />
    );
  }
  if (!connecting) {
    return <HomeView onConnectionSelect={onConnectionSelect} onNewConnection={onNewConnection} />;
  }
  // Connecting: skeleton instead of a blank flash while the driver handshakes.
  return (
    <div className="skeleton-panel" aria-busy>
      <Skeleton width={220} height={22} />
      <Skeleton height={32} />
      <Skeleton height="100%" style={{ flex: 1 }} />
    </div>
  );
}
