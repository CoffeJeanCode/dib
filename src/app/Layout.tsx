import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { FileCode2, Clock, Settings, Compass, Server, Folder } from "lucide-react";
import { useUiState } from "@/shared/hooks/useUiState";
import { useKeybindings } from "@/shared/hooks/useKeybindings";
import { Sidebar } from "@/features/Sidebar";
import { Titlebar } from "@/app/Titlebar";
import { JsonPanel } from "@/features/JsonViewer/JsonPanel";
import { Tooltip } from "@/shared/ui/Tooltip";
import { useWorkspaceStore } from "@/store/workspaceStore";
import { useConnectionStore } from "@/store/connectionStore";
import { useUiStore } from "@/store/uiStore";
import { combo, display } from "@/shared/shortcuts";
import "./Layout.css";

const SIDEBAR_MIN = 160;
const SIDEBAR_SNAP = 140;

type Panel = "explorer" | "files" | "history" | "workspaces";

/**
 * Activity-bar slots map to Ctrl+Shift+1/2/3 (see SHORTCUT_CATALOG).
 * Slot 2 is Workspaces on home, Files when connected — one combo, mode-resolved.
 * Always register all three (useKeybindings freezes combos at mount).
 */
const PANEL_SHORTCUTS: Array<{ combo: string; resolve: (home: boolean) => Panel | null }> = [
  { combo: combo("sidebar.activity.1"), resolve: () => "explorer" },
  {
    combo: combo("sidebar.activity.2"),
    resolve: (home) => (home ? "workspaces" : "files"),
  },
  {
    combo: combo("sidebar.activity.3"),
    resolve: (home) => (home ? null : "history"),
  },
];

const CONNECTED_PANELS: Array<{ id: Panel; icon: React.ReactNode; title: string }> = [
  { id: "explorer", icon: <Compass size={20} />, title: `Explorer — databases (${display("sidebar.activity.1")})` },
  { id: "files", icon: <FileCode2 size={20} />, title: `Files — workspace folder or app scripts (${display("sidebar.activity.2")})` },
  { id: "history", icon: <Clock size={20} />, title: `History (${display("sidebar.activity.3")})` },
];

const HOME_PANELS: Array<{ id: Panel; icon: React.ReactNode; title: string }> = [
  { id: "explorer", icon: <Server size={20} />, title: `Instances (${display("sidebar.activity.1")})` },
  { id: "workspaces", icon: <Folder size={20} />, title: `Workspaces (${display("sidebar.activity.2")})` },
];

interface LayoutProps {
  children: React.ReactNode;
  onSettingsOpen?: () => void;
}

export function Layout({ children, onSettingsOpen }: LayoutProps) {
  const { state, loaded, updateState } = useUiState();
  const activeConnectionId = useConnectionStore((s) => s.active?.activeId ?? null);
  const isHome = !activeConnectionId;
  const panels = isHome ? HOME_PANELS : CONNECTED_PANELS;
  const [activePanel, setActivePanel] = useState<Panel>("explorer");

  useEffect(() => {
    if (activeConnectionId) {
      setActivePanel("explorer");
      if (!state.is_sidebar_open) updateState({ is_sidebar_open: true });
      return;
    }
    // Home: only Instances + Workspaces — drop Files/History if we landed there.
    setActivePanel((prev) => {
      if (prev === "files" || prev === "history") return "explorer";
      return prev;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeConnectionId]);

  const handleActivityClick = useCallback((panel: Panel) => {
    if (state.is_sidebar_open && activePanel === panel) {
      updateState({ is_sidebar_open: false });
      return;
    }
    setActivePanel(panel);
    if (!state.is_sidebar_open) updateState({ is_sidebar_open: true });
    requestAnimationFrame(() => document.getElementById("dib-sidebar-nav")?.focus());
  }, [state.is_sidebar_open, activePanel, updateState]);

  const jsonPanel = useWorkspaceStore((s) => s.jsonPanel);
  const closeJsonPanel = useWorkspaceStore((s) => s.closeJsonPanel);

  const panelBindings = useMemo(
    () =>
      PANEL_SHORTCUTS.map(({ combo: c, resolve }) => ({
        combo: c,
        handler: () => {
          const panel = resolve(isHome);
          if (!panel || !panels.some((p) => p.id === panel)) return;
          handleActivityClick(panel);
        },
        allowInMonaco: true,
      })),
    [isHome, panels, handleActivityClick],
  );

  useKeybindings([
    ...panelBindings,
    {
      combo: combo("sidebar.toggle"),
      handler: () => updateState({ is_sidebar_open: !state.is_sidebar_open }),
      allowInMonaco: true,
    },
    {
      combo: combo("layout.bottomPanel"),
      handler: () => useUiStore.getState().toggleBottomPanel(),
      allowInMonaco: true,
    },
    {
      combo: "escape",
      handler: () => { if (jsonPanel) closeJsonPanel(); },
      allowInMonaco: true,
    },
  ]);

  // ── High-performance resize via DOM manipulation ────────
  // Sidebar width updates through a CSS var (no React state during drag).
  // Main panel *inner* width is frozen so DataGrid/Monaco do not reflow every frame —
  // that was the lag when a table is open.
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

      const main = document.getElementById("dib-main-panel");
      const freezeW = main?.clientWidth ?? 0;
      const root = document.documentElement;
      root.style.setProperty("--main-freeze-width", `${freezeW}px`);
      root.classList.add("is-sidebar-resizing");

      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";

      const onMove = (moveEvt: MouseEvent) => {
        if (!resizingRef.current) return;
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
        rafRef.current = requestAnimationFrame(() => {
          const delta = moveEvt.clientX - resizeStartXRef.current;
          const newW = resizeStartWRef.current + delta;
          const clamped = Math.max(SIDEBAR_MIN, newW);
          root.style.setProperty("--sidebar-width-dynamic", `${clamped}px`);
        });
      };

      const cleanup = () => {
        resizingRef.current = false;
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
        root.classList.remove("is-sidebar-resizing");
        root.style.removeProperty("--main-freeze-width");
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
        const finalWidth = Math.max(SIDEBAR_MIN, newW);
        root.style.setProperty("--sidebar-width", `${finalWidth}px`);
        root.style.removeProperty("--sidebar-width-dynamic");
        if (newW < SIDEBAR_SNAP) {
          updateState({ is_sidebar_open: false });
        } else {
          updateState({ sidebar_width: finalWidth });
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
            {panels.map(({ id, icon, title }) => (
              <Tooltip key={id} content={title} side="right">
                <button
                  type="button"
                  className={`activity-btn${state.is_sidebar_open && activePanel === id ? " activity-btn--active" : ""}`}
                  onClick={() => handleActivityClick(id)}
                >
                  {icon}
                </button>
              </Tooltip>
            ))}
          </div>
          <div className="activity-bar-bottom">
            {onSettingsOpen && (
              <Tooltip content="Settings" side="right">
                <button type="button" className="activity-btn" onClick={onSettingsOpen}>
                  <Settings size={20} />
                </button>
              </Tooltip>
            )}
          </div>
        </div>

        {state.is_sidebar_open && (
          <Sidebar
            activeView={activePanel}
            width={sidebarW}
            onResizeStart={handleResizeStart}
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
