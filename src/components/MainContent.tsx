import { ArrowLeft } from "lucide-react";
import { ConnectionManager } from "./ConnectionManager";
import { QueryPanel } from "@/features/QueryPanel";
import { HomeView } from "./HomeView";
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
  if (editingConn) {
    return (
      <div className="app-container">
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
    return (
      <QueryPanel
        key={`${active.activeId}-${active.dbVersion}`}
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
  return null;
}
