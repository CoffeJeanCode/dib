import { useEffect, useCallback, useRef } from "react";
import { useUiState } from "../hooks/useUiState";
import { useKeybindings } from "../hooks/useKeybindings";
import { Sidebar } from "./Sidebar";
import type { SavedConnection } from "../types/db";
import "./Layout.css";

const SIDEBAR_MIN = 160;
const SIDEBAR_SNAP = 140;

interface LayoutProps {
  children: React.ReactNode;
  activeConnectionId?: string | null;
  onConnectionSelect?: (connectionId: string) => void;
  onScriptOpen?: (sql: string, title: string, id: string) => void;
  onEditConnection?: (conn: SavedConnection) => void;
  onSettingsOpen?: () => void;
}

export function Layout({ children, activeConnectionId, onConnectionSelect, onScriptOpen, onEditConnection, onSettingsOpen }: LayoutProps) {
  const { state, loaded, toggleSidebar, updateState } = useUiState();

  useKeybindings([
    { combo: "ctrl+b", handler: toggleSidebar, allowInMonaco: true },
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
      // Overlay blocks Monaco pointer capture during drag
      const overlay = document.createElement("div");
      overlay.id = "dib-drag-overlay";
      overlay.style.cssText = "position:fixed;inset:0;z-index:9999;cursor:col-resize;";
      document.body.appendChild(overlay);
    },
    [state.sidebar_width],
  );

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!resizingRef.current) return;

      // Cancel any pending frame to avoid stacking
      if (rafRef.current) cancelAnimationFrame(rafRef.current);

      rafRef.current = requestAnimationFrame(() => {
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
        document.documentElement.style.setProperty("--sidebar-width-dynamic", `${clamped}px`);
      });
    };

    const onUp = (e: MouseEvent) => {
      if (!resizingRef.current) return;
      resizingRef.current = false;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      document.getElementById("dib-drag-overlay")?.remove();

      const delta = e.clientX - resizeStartXRef.current;
      const finalW = Math.max(SIDEBAR_MIN, resizeStartWRef.current + delta);
      document.documentElement.style.removeProperty("--sidebar-width-dynamic");
      updateState({ sidebar_width: finalW });
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
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
        activeConnectionId={activeConnectionId}
        onToggle={toggleSidebar}
        onResizeStart={handleResizeStart}
        onConnectionSelect={onConnectionSelect}
        onScriptOpen={onScriptOpen}
        onEditConnection={onEditConnection}
        onSettingsOpen={onSettingsOpen}
      />
      <main id="dib-main-panel" className="main-content" tabIndex={-1}>
        {children}
      </main>
    </div>
  );
}
