import { useState, useEffect, useCallback, useRef } from "react";
import { useUiState } from "../hooks/useUiState";
import { Sidebar } from "./Sidebar";
import type { ScriptInfo, SavedConnection } from "../types/db";
import "./Layout.css";

const SIDEBAR_MIN = 160;
const SIDEBAR_SNAP = 140;

interface LayoutProps {
  children: React.ReactNode;
  onConnectionSelect?: (connectionId: string) => void;
  onScriptOpen?: (script: ScriptInfo) => void;
  onEditConnection?: (conn: SavedConnection) => void;
  onSettingsOpen?: () => void;
}

export function Layout({ children, onConnectionSelect, onScriptOpen, onEditConnection, onSettingsOpen }: LayoutProps) {
  const { state, loaded, toggleSidebar, updateState } = useUiState();

  const resizingRef = useRef(false);
  const resizeStartXRef = useRef(0);
  const resizeStartWRef = useRef(260);
  // Force re-render when resizing stops to persist final width
  const [, forceRender] = useState(0);

  const handleResizeStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      resizingRef.current = true;
      resizeStartXRef.current = e.clientX;
      resizeStartWRef.current = state.sidebar_width ?? 260;
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    },
    [state.sidebar_width],
  );

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!resizingRef.current) return;
      const delta = e.clientX - resizeStartXRef.current;
      const newW = resizeStartWRef.current + delta;
      if (newW < SIDEBAR_SNAP) {
        resizingRef.current = false;
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
        updateState({ is_sidebar_open: false });
        return;
      }
      const clamped = Math.max(SIDEBAR_MIN, newW);
      // Update CSS var immediately for smooth drag (no setState overhead)
      document.documentElement.style.setProperty("--sidebar-width-dynamic", `${clamped}px`);
    };

    const onUp = (e: MouseEvent) => {
      if (!resizingRef.current) return;
      resizingRef.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      const delta = e.clientX - resizeStartXRef.current;
      const finalW = Math.max(SIDEBAR_MIN, resizeStartWRef.current + delta);
      document.documentElement.style.removeProperty("--sidebar-width-dynamic");
      updateState({ sidebar_width: finalW });
      forceRender((n) => n + 1);
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [updateState]);

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
      <Sidebar
        collapsed={!state.is_sidebar_open}
        width={sidebarW}
        onToggle={toggleSidebar}
        onResizeStart={handleResizeStart}
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
