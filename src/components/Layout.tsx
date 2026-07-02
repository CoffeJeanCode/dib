import { useState, useCallback, useRef, useEffect } from "react";
import { Database, FileCode2, Clock, LayoutGrid, Settings, Compass, FolderOpen } from "lucide-react";
import { useUiState } from "@/hooks/useUiState";
import { useKeybindings } from "@/hooks/useKeybindings";
import { Sidebar } from "@/features/Sidebar";
import { Titlebar } from "@/components/Titlebar";
import { JsonPanel } from "@/features/JsonViewer/JsonPanel";
import { useWorkspaceStore } from "@/store/workspaceStore";
import { useSettingsStore } from "@/store/settingsStore";
import type { SavedConnection, TableInfo } from "@/types/db";
import "./Layout.css";

const SIDEBAR_MIN = 160;
const SIDEBAR_SNAP = 140;

// "explorer" only exists in unified layout; the other 4 only exist in split layout.
type Panel = "explorer" | "connections" | "scripts" | "history" | "database" | "workspaces";

// Home (no active connection) — Instances and Workspaces.
const HOME_PANELS: Array<{ id: Panel; icon: React.ReactNode; title: string }> = [
  { id: "connections", icon: <Database size={20} />, title: "Instances" },
  { id: "workspaces", icon: <FolderOpen size={20} />, title: "Workspaces" },
];

const UNIFIED_PANELS: Array<{ id: Panel; icon: React.ReactNode; title: string }> = [
  { id: "workspaces", icon: <FolderOpen size={20} />, title: "Workspaces" },
  { id: "explorer", icon: <Compass size={20} />,   title: "Explorer" },
  { id: "scripts",  icon: <FileCode2 size={20} />, title: "Scripts" },
  { id: "history",  icon: <Clock size={20} />,      title: "History" },
];

const SPLIT_PANELS: Array<{ id: Panel; icon: React.ReactNode; title: string }> = [
  { id: "workspaces", icon: <FolderOpen size={20} />, title: "Workspaces" },
  { id: "connections", icon: <Database size={20} />,    title: "Instances" },
  { id: "database",    icon: <LayoutGrid size={20} />,  title: "Entities" },
  { id: "scripts",     icon: <FileCode2 size={20} />,   title: "Scripts" },
  { id: "history",     icon: <Clock size={20} />,       title: "History" },
];

type DbActionType = "create" | "rename" | "drop";

interface LayoutProps {
  children: React.ReactNode;
  activeConnectionId?: string | null;
  activeSessionId?: string | null;
  onConnectionSelect?: (connectionId: string) => void;
  connectionName?: string;
  onScriptOpen?: (sql: string, title: string, id: string) => void;
  onTableSelect?: (table: TableInfo) => void;
  onDatabaseSwitch?: (db: string) => void;
  onDisconnect?: () => void;
  onEditConnection?: (conn: SavedConnection) => void;
  onSettingsOpen?: () => void;
  onDbAction?: (action: DbActionType, dbName?: string) => void;
}

export function Layout({ children, activeConnectionId, activeSessionId, connectionName, onConnectionSelect, onScriptOpen, onTableSelect, onDatabaseSwitch, onDisconnect, onEditConnection, onSettingsOpen, onDbAction }: LayoutProps) {
  const { state, loaded, updateState } = useUiState();
  const workspaceLayout = useSettingsStore((s) => s.workspaceLayout);
  // No active connection AND no active workspace = Home (instance selection screen)
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);
  const isHome = !activeConnectionId && !activeWorkspaceId;
  const PANELS = isHome ? HOME_PANELS : (workspaceLayout === "unified" ? UNIFIED_PANELS : SPLIT_PANELS);
  const [activePanel, setActivePanel] = useState<Panel>(() =>
    isHome ? "connections" : (workspaceLayout === "unified" ? "explorer" : "database"),
  );

  useEffect(() => {
    if (activeConnectionId) {
      setActivePanel(workspaceLayout === "unified" ? "explorer" : "database");
      if (!state.is_sidebar_open) updateState({ is_sidebar_open: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeConnectionId]);

  // Normalize the active tab whenever Home/workspace status or the layout
  // preference changes — a tab valid in one context may not exist in another.
  useEffect(() => {
    const validIds = (isHome ? HOME_PANELS : (workspaceLayout === "unified" ? UNIFIED_PANELS : SPLIT_PANELS)).map((p) => p.id);
    if (validIds.includes(activePanel)) return;
    setActivePanel(isHome ? "connections" : (workspaceLayout === "unified" ? "explorer" : "database"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceLayout, isHome]);

  const handleActivityClick = useCallback((panel: Panel) => {
    if (state.is_sidebar_open && activePanel === panel) {
      updateState({ is_sidebar_open: false });
    } else {
      setActivePanel(panel);
      if (!state.is_sidebar_open) updateState({ is_sidebar_open: true });
    }
  }, [state.is_sidebar_open, activePanel, updateState]);

  const jsonPanel = useWorkspaceStore((s) => s.jsonPanel);
  const closeJsonPanel = useWorkspaceStore((s) => s.closeJsonPanel);

  useKeybindings([
    {
      combo: "ctrl+b",
      handler: () => updateState({ is_sidebar_open: !state.is_sidebar_open }),
      allowInMonaco: true,
    },
    {
      combo: "escape",
      handler: () => { if (jsonPanel) closeJsonPanel(); },
      allowInMonaco: true,
    },
  ]);

  // ── High-performance resize via DOM manipulation ────────
  const resizingRef = useRef(false);
  const resizeStartXRef = useRef(0);
  const resizeStartWRef = useRef(260);
  const rafRef = useRef<number>(0);

  const handleResizeStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      resizingRef.current = true;
      resizeStartXRef.current = e.clientX;
      resizeStartWRef.current = state.sidebar_width ?? 260;

      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";

      const onMove = (moveEvt: MouseEvent) => {
        if (!resizingRef.current) return;
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
        rafRef.current = requestAnimationFrame(() => {
          const delta = moveEvt.clientX - resizeStartXRef.current;
          const newW = resizeStartWRef.current + delta;
          // Clamp to min during drag; snap-to-close happens on mouseup
          const clamped = Math.max(SIDEBAR_MIN, newW);
          document.documentElement.style.setProperty("--sidebar-width-dynamic", `${clamped}px`);
        });
      };

      const cleanup = () => {
        resizingRef.current = false;
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
      };

      const onUp = (upEvt: MouseEvent) => {
        if (!resizingRef.current) return;
        const delta = upEvt.clientX - resizeStartXRef.current;
        const newW = resizeStartWRef.current + delta;
        cleanup();
        document.documentElement.style.removeProperty("--sidebar-width-dynamic");
        if (newW < SIDEBAR_SNAP) {
          updateState({ is_sidebar_open: false });
        } else {
          updateState({ sidebar_width: Math.max(SIDEBAR_MIN, newW) });
        }
      };

      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    },
    [state.sidebar_width, updateState],
  );

  if (!loaded) {
    return (
      <div className="layout">
        <Titlebar />
        <div className="layout-body">
          <div className="main-content" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span className="sidebar-item-text sidebar-item-text--muted">Loading...</span>
          </div>
        </div>
      </div>
    );
  }

  const sidebarW = state.sidebar_width ?? 260;

  return (
    <div className="layout">
      <Titlebar />
      <div className="layout-body">
        <div className="activity-bar">
          <div className="activity-bar-top">
            {PANELS.map(({ id, icon, title }) => (
              <button
                key={id}
                className={`activity-btn${state.is_sidebar_open && activePanel === id ? " activity-btn--active" : ""}`}
                onClick={() => handleActivityClick(id)}
                title={title}
              >
                {icon}
              </button>
            ))}
          </div>
          <div className="activity-bar-bottom">
            {onSettingsOpen && (
              <button className="activity-btn" onClick={onSettingsOpen} title="Settings">
                <Settings size={20} />
              </button>
            )}
          </div>
        </div>

        {state.is_sidebar_open && (
          <Sidebar
            activeView={activePanel}
            width={sidebarW}
            activeConnectionId={activeConnectionId}
            activeSessionId={activeSessionId}
            onResizeStart={handleResizeStart}
            connectionName={connectionName}
            onConnectionSelect={onConnectionSelect}
            onScriptOpen={onScriptOpen}
            onTableSelect={onTableSelect}
            onDatabaseSwitch={onDatabaseSwitch}
            onDisconnect={onDisconnect}
            onEditConnection={onEditConnection}
            onDbAction={onDbAction}
            activeDb={connectionName}
          />
        )}

        <main id="dib-main-panel" className="main-content" tabIndex={-1}>
          {children}
        </main>

        <JsonPanel />
      </div>
    </div>
  );
}
