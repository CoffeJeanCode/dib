import { useState, useCallback, useRef } from "react";
import { Database, FileCode2, Clock, Settings, LayoutGrid } from "lucide-react";
import { useUiState } from "../hooks/useUiState";
import { useKeybindings } from "../hooks/useKeybindings";
import { Sidebar } from "./Sidebar";
import type { SavedConnection } from "../types/db";
import "./Layout.css";

const SIDEBAR_MIN = 160;
const SIDEBAR_SNAP = 140;

type Panel = "connections" | "scripts" | "history" | "database";

const PANELS: Array<{ id: Panel; icon: React.ReactNode; title: string }> = [
  { id: "connections", icon: <Database size={20} />,    title: "Conexiones" },
  { id: "database",    icon: <LayoutGrid size={20} />,  title: "Base de Datos" },
  { id: "scripts",     icon: <FileCode2 size={20} />,   title: "Scripts" },
  { id: "history",     icon: <Clock size={20} />,       title: "Historial" },
];

interface LayoutProps {
  children: React.ReactNode;
  activeConnectionId?: string | null;
  activeSessionId?: string | null;
  onConnectionSelect?: (connectionId: string) => void;
  onScriptOpen?: (sql: string, title: string, id: string) => void;
  onEditConnection?: (conn: SavedConnection) => void;
  onSettingsOpen?: () => void;
}

export function Layout({ children, activeConnectionId, activeSessionId, onConnectionSelect, onScriptOpen, onEditConnection, onSettingsOpen }: LayoutProps) {
  const { state, loaded, updateState } = useUiState();
  const [activePanel, setActivePanel] = useState<Panel>("connections");

  const handleActivityClick = useCallback((panel: Panel) => {
    if (state.is_sidebar_open && activePanel === panel) {
      updateState({ is_sidebar_open: false });
    } else {
      setActivePanel(panel);
      if (!state.is_sidebar_open) updateState({ is_sidebar_open: true });
    }
  }, [state.is_sidebar_open, activePanel, updateState]);

  useKeybindings([
    {
      combo: "ctrl+b",
      handler: () => updateState({ is_sidebar_open: !state.is_sidebar_open }),
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
      document.body.style.pointerEvents = "none";
      document.body.style.userSelect = "none";

      const onMove = (moveEvt: MouseEvent) => {
        if (!resizingRef.current) return;
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
        rafRef.current = requestAnimationFrame(() => {
          const delta = moveEvt.clientX - resizeStartXRef.current;
          const newW = resizeStartWRef.current + delta;
          if (newW < SIDEBAR_SNAP) {
            cleanup();
            updateState({ is_sidebar_open: false });
            return;
          }
          const clamped = Math.max(SIDEBAR_MIN, newW);
          document.documentElement.style.setProperty("--sidebar-width-dynamic", `${clamped}px`);
        });
      };

      const cleanup = () => {
        resizingRef.current = false;
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
        document.body.style.cursor = "";
        document.body.style.pointerEvents = "";
        document.body.style.userSelect = "";
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
      };

      const onUp = (upEvt: MouseEvent) => {
        if (!resizingRef.current) return;
        const delta = upEvt.clientX - resizeStartXRef.current;
        const finalW = Math.max(SIDEBAR_MIN, resizeStartWRef.current + delta);
        cleanup();
        document.documentElement.style.removeProperty("--sidebar-width-dynamic");
        updateState({ sidebar_width: finalW });
      };

      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    },
    [state.sidebar_width, updateState],
  );

  if (!loaded) {
    return (
      <div className="layout">
        <div className="main-content" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
          <span className="sidebar-item-text sidebar-item-text--muted">Loading...</span>
        </div>
      </div>
    );
  }

  const sidebarW = state.sidebar_width ?? 260;

  return (
    <div className="layout">
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
            <button className="activity-btn" onClick={onSettingsOpen} title="Configuración">
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
          onConnectionSelect={onConnectionSelect}
          onScriptOpen={onScriptOpen}
          onEditConnection={onEditConnection}
        />
      )}

      <main id="dib-main-panel" className="main-content" tabIndex={-1}>
        {children}
      </main>
    </div>
  );
}
