import { useState, useCallback, useRef, useEffect } from "react";
import { FileCode2, Clock, Settings, Compass } from "lucide-react";
import { useUiState } from "@/shared/hooks/useUiState";
import { useKeybindings } from "@/shared/hooks/useKeybindings";
import { Sidebar } from "@/features/Sidebar";
import { Titlebar } from "@/app/Titlebar";
import { JsonPanel } from "@/features/JsonViewer/JsonPanel";
import { useWorkspaceStore } from "@/store/workspaceStore";
import { useConnectionStore } from "@/store/connectionStore";
import { useUiStore } from "@/store/uiStore";
import "./Layout.css";

const SIDEBAR_MIN = 160;
const SIDEBAR_SNAP = 140;

// One panel set everywhere — Home, simple and advance. "Instances" and
// "Entities" were the same browser under a flag, and "Workspaces" was a picker
// for the tree "Scripts" already showed; both folded into their host panel.
// The simple/advance setting still controls the depth of the Explorer tree.
type Panel = "explorer" | "files" | "history";

const PANELS: Array<{ id: Panel; icon: React.ReactNode; title: string }> = [
  { id: "explorer", icon: <Compass size={20} />,   title: "Explorer (Ctrl+1)" },
  { id: "files",    icon: <FileCode2 size={20} />, title: "Files (Ctrl+2)" },
  { id: "history",  icon: <Clock size={20} />,     title: "History (Ctrl+3)" },
];

interface LayoutProps {
  children: React.ReactNode;
  onSettingsOpen?: () => void;
}

export function Layout({ children, onSettingsOpen }: LayoutProps) {
  const { state, loaded, updateState } = useUiState();
  const activeConnectionId = useConnectionStore((s) => s.active?.activeId ?? null);
  const [activePanel, setActivePanel] = useState<Panel>("explorer");

  useEffect(() => {
    if (activeConnectionId) {
      setActivePanel("explorer");
      if (!state.is_sidebar_open) updateState({ is_sidebar_open: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeConnectionId]);

  const handleActivityClick = useCallback((panel: Panel) => {
    if (state.is_sidebar_open && activePanel === panel) {
      updateState({ is_sidebar_open: false });
      return;
    }
    setActivePanel(panel);
    if (!state.is_sidebar_open) updateState({ is_sidebar_open: true });
    // Ctrl+1..3 doubles as "focus the sidebar" — the old standalone binding for
    // that targeted an element with no tabIndex and never actually focused.
    requestAnimationFrame(() => document.getElementById("dib-sidebar-nav")?.focus());
  }, [state.is_sidebar_open, activePanel, updateState]);

  const jsonPanel = useWorkspaceStore((s) => s.jsonPanel);
  const closeJsonPanel = useWorkspaceStore((s) => s.closeJsonPanel);

  useKeybindings([
    ...PANELS.map(({ id }, i) => ({
      combo: `ctrl+${i + 1}`,
      handler: () => handleActivityClick(id),
      allowInMonaco: true,
    })),
    {
      combo: "ctrl+b",
      handler: () => updateState({ is_sidebar_open: !state.is_sidebar_open }),
      allowInMonaco: true,
    },
    {
      combo: "ctrl+j",
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
        // Sync the CSS variable immediately so the sidebar doesn't
        // flash back to the old width before React re-renders.
        const finalWidth = Math.max(SIDEBAR_MIN, newW);
        document.documentElement.style.setProperty("--sidebar-width", `${finalWidth}px`);
        document.documentElement.style.removeProperty("--sidebar-width-dynamic");
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
