import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  Database,
  FileCode2,
  FileText,
  ChevronRight,
  Pencil,
  Trash2,
  Settings,
} from "lucide-react";

function PostgresIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" fill="none" className={className} width="10" height="10">
      <path d="M8 1C4.1 1 1 3.6 1 7c0 1.8 1 3.4 2.6 4.5-.1.5-.4 1.4-.6 1.9-.1.2 0 .5.3.5.2 0 .5-.1.8-.3C5.2 12.8 6.6 12 8 12c3.9 0 7-2.6 7-5.5S11.9 1 8 1z" fill="currentColor" opacity="0.2"/>
      <path d="M8 1c1.4 0 2.7.5 3.8 1.2-.1.5-.3 1.1-.5 1.6-.6-.2-1.3-.3-2-.3-2.5 0-4.6 1.5-5.4 3.6C2.4 6.3 1.5 5.2 1.5 4 1.5 2.3 4.4 1 8 1z" fill="currentColor" opacity="0.5"/>
      <circle cx="5.5" cy="6.5" r="0.8" fill="currentColor" opacity="0.6"/>
      <circle cx="8" cy="5.5" r="0.8" fill="currentColor" opacity="0.6"/>
      <circle cx="10.5" cy="6.5" r="0.8" fill="currentColor" opacity="0.6"/>
    </svg>
  );
}

function SqliteIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" fill="none" className={className} width="10" height="10">
      <rect x="2" y="2" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="1.2" opacity="0.5"/>
      <path d="M5 5h6M5 8h6M5 11h6" stroke="currentColor" strokeWidth="1" opacity="0.4"/>
      <ellipse cx="8" cy="3.5" rx="3" ry="1.5" stroke="currentColor" strokeWidth="1" opacity="0.6"/>
    </svg>
  );
}
import { useSavedConnections } from "../hooks/useSavedConnections";
import { useContextMenu } from "../hooks/useContextMenu";
import { ContextMenu } from "./ContextMenu";
import type { ScriptInfo, SavedConnection } from "../types/db";
import "./Sidebar.css";

interface SidebarProps {
  collapsed: boolean;
  width?: number;
  onToggle: () => void;
  onResizeStart?: (e: React.MouseEvent) => void;
  onConnectionSelect?: (savedId: string) => void;
  onScriptOpen?: (script: ScriptInfo) => void;
  onEditConnection?: (conn: SavedConnection) => void;
  onSettingsOpen?: () => void;
}

const ENGINE_COLORS: Record<string, string> = {
  postgres: "blue",
  postgresql: "blue",
  sqlite: "gray",
};

export function Sidebar({
  collapsed,
  width,
  onToggle,
  onResizeStart,
  onConnectionSelect,
  onScriptOpen,
  onEditConnection,
  onSettingsOpen,
}: SidebarProps) {
  const { connections, remove } = useSavedConnections();
  const { menuState, openMenu, closeMenu } = useContextMenu();
  const [contextConnId, setContextConnId] = useState<string | null>(null);

  const [sectionsOpen, setSectionsOpen] = useState({
    connections: true,
    workspace: true,
  });

  const [scripts, setScripts] = useState<ScriptInfo[]>([]);
  const [scriptsLoading, setScriptsLoading] = useState(false);

  useEffect(() => {
    if (sectionsOpen.workspace) {
      setScriptsLoading(true);
      invoke<ScriptInfo[]>("list_scripts")
        .then(setScripts)
        .catch(() => setScripts([]))
        .finally(() => setScriptsLoading(false));
    }
  }, [sectionsOpen.workspace]);

  const toggleSection = useCallback((key: "connections" | "workspace") => {
    setSectionsOpen((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const getEngineIcon = (engine: string) => {
    switch (engine?.toLowerCase()) {
      case "postgres":
      case "postgresql":
        return <PostgresIcon className="sidebar-detail-icon" />;
      case "sqlite":
        return <SqliteIcon className="sidebar-detail-icon" />;
      default:
        return <Database size={10} className="sidebar-detail-icon" />;
    }
  };

  const getDbName = (conn: (typeof connections)[0]) => {
    return conn.db_name || conn.path?.split(/[/\\]/).pop() || "";
  };

  const getScriptIcon = (name: string) => {
    if (name.endsWith(".sql")) return <FileCode2 size={14} />;
    return <FileText size={14} />;
  };

  const handleContextMenu = (e: React.MouseEvent, connId: string) => {
    setContextConnId(connId);
    openMenu(e);
  };

  const handleClose = () => {
    closeMenu();
    setContextConnId(null);
  };

  const menuItems = [
    {
      icon: <Pencil size={14} />,
      label: "Editar Conexión",
      onClick: () => {
        const conn = connections.find((c) => c.id === contextConnId);
        if (conn) onEditConnection?.(conn);
        handleClose();
      },
    },
    {
      icon: <Trash2 size={14} />,
      label: "Eliminar",
      danger: true,
      onClick: () => {
        if (contextConnId) remove(contextConnId);
        handleClose();
      },
    },
  ];

  if (collapsed) {
    return (
      <aside className="sidebar sidebar--collapsed">
        <div className="sidebar-header">
          <button className="sidebar-toggle" onClick={onToggle} aria-label="Expand sidebar">
            »
          </button>
        </div>

        <nav className="sidebar-nav">
          <div className="sidebar-collapsed-icons">
            {connections.map((conn) => (
              <div
                key={conn.id}
                className="sidebar-collapsed-icon"
                title={conn.name}
                onClick={() => onConnectionSelect?.(conn.id)}
              >
                <Database
                  size={18}
                  className={`sidebar-icon sidebar-icon--${ENGINE_COLORS[conn.engine?.toLowerCase()] ?? "gray"}`}
                />
              </div>
            ))}
          </div>
        </nav>

        {/* Flyout on hover */}
        <div className="sidebar-flyout">
          <div className="sidebar-header">
            <span className="sidebar-logo">DIB</span>
            <div className="sidebar-header-actions">
              {onSettingsOpen && (
                <button className="sidebar-icon-btn" onClick={onSettingsOpen} title="Settings">
                  <Settings size={14} />
                </button>
              )}
              <button className="sidebar-toggle" onClick={onToggle} aria-label="Expand sidebar">
                «
              </button>
            </div>
          </div>
          <nav className="sidebar-nav">
            <div className="sidebar-section">
              <span className="sidebar-section-title">Connections</span>
              {connections.map((conn) => (
                <div
                  key={conn.id}
                  className="sidebar-item"
                  onClick={() => onConnectionSelect?.(conn.id)}
                >
                  <Database
                    size={14}
                    className={`sidebar-icon sidebar-icon--${ENGINE_COLORS[conn.engine?.toLowerCase()] ?? "gray"}`}
                  />
                  <div className="sidebar-item-texts">
                    <span className="sidebar-item-text">{conn.name}</span>
                    <span className="sidebar-item-detail">
                      {getEngineIcon(conn.engine)} {getDbName(conn)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </nav>
        </div>
      </aside>
    );
  }

  return (
    <aside
      className="sidebar"
      style={width ? { width, minWidth: width } : undefined}
    >
      {onResizeStart && (
        <div className="sidebar-resize-handle" onMouseDown={onResizeStart} />
      )}
      <div className="sidebar-header">
        <span className="sidebar-logo">DIB</span>
        <div className="sidebar-header-actions">
          {onSettingsOpen && (
            <button className="sidebar-icon-btn" onClick={onSettingsOpen} title="Settings">
              <Settings size={14} />
            </button>
          )}
          <button className="sidebar-toggle" onClick={onToggle} aria-label="Collapse sidebar">
            «
          </button>
        </div>
      </div>

      <nav className="sidebar-nav">
        {/* ── Connections ──────────────────────────────── */}
        <div className="sidebar-section">
          <button
            className="sidebar-section-title sidebar-section-toggle"
            onClick={() => toggleSection("connections")}
          >
            <ChevronRight
              size={12}
              className={`sidebar-chevron${sectionsOpen.connections ? " sidebar-chevron--open" : ""}`}
            />
            Connections
          </button>

          {sectionsOpen.connections && (
            <>
              {connections.length === 0 ? (
                <div className="sidebar-item sidebar-item--empty">
                  <span className="sidebar-item-text sidebar-item-text--muted">No connections yet</span>
                </div>
              ) : (
                connections.map((conn) => (
                  <div
                    key={conn.id}
                    className="sidebar-item"
                    onClick={() => onConnectionSelect?.(conn.id)}
                    onContextMenu={(e) => handleContextMenu(e, conn.id)}
                  >
                    <Database
                      size={14}
                      className={`sidebar-icon sidebar-icon--${ENGINE_COLORS[conn.engine?.toLowerCase()] ?? "gray"}`}
                    />
                    <div className="sidebar-item-texts">
                      <span className="sidebar-item-text">{conn.name}</span>
                      <span className="sidebar-item-detail">
                        {getEngineIcon(conn.engine)} {getDbName(conn)}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </>
          )}
        </div>

        {/* ── Workspace / Scripts ──────────────────────── */}
        <div className="sidebar-section">
          <button
            className="sidebar-section-title sidebar-section-toggle"
            onClick={() => toggleSection("workspace")}
          >
            <ChevronRight
              size={12}
              className={`sidebar-chevron${sectionsOpen.workspace ? " sidebar-chevron--open" : ""}`}
            />
            Workspace / Scripts
          </button>

          {sectionsOpen.workspace && (
            <>
              {scriptsLoading ? (
                <div className="sidebar-item sidebar-item--empty">
                  <span className="sidebar-item-text sidebar-item-text--muted">Loading…</span>
                </div>
              ) : scripts.length === 0 ? (
                <div className="sidebar-item sidebar-item--empty">
                  <span className="sidebar-item-text sidebar-item-text--muted">No scripts found</span>
                </div>
              ) : (
                scripts.map((script) => (
                  <div
                    key={script.path}
                    className="sidebar-item"
                    onClick={() => onScriptOpen?.(script)}
                    title={script.path}
                  >
                    <span className="sidebar-icon sidebar-icon--file">
                      {getScriptIcon(script.name)}
                    </span>
                    <span className="sidebar-item-text">{script.name}</span>
                  </div>
                ))
              )}
            </>
          )}
        </div>
      </nav>

      <ContextMenu
        open={menuState.open}
        x={menuState.x}
        y={menuState.y}
        items={menuItems}
        onClose={handleClose}
      />
    </aside>
  );
}
