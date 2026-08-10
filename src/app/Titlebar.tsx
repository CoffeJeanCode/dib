import { useCallback } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { ArrowLeft, Home, Search, Moon, Sun, Settings, Minus, Square, X } from "lucide-react";
import { mod } from "@/shared/utils/platform";
import { useUiStore } from "@/store/uiStore";
import { useTheme, setTheme } from "@/shared/hooks/useTheme";
import { useSessionEgress } from "@/shared/hooks/useSessionEgress";
import { Dropzone, type ImportResult } from "@/shared/ui/Dropzone";
import { Tooltip } from "@/shared/ui/Tooltip";
import { useConnectionStore } from "@/store/connectionStore";
import { useWorkspaceStore } from "@/store/workspaceStore";
import { ReadonlyBadge } from "@/shared/ui/ReadonlyBadge";
import type { OpenScript } from "@/types/workspace";
// Same source of truth as the app icon, so the titlebar can never drift from it.
// The 32px variant, not the 512px master: this renders at 14px (28px on hidpi) and
// staying under Vite's 4 KB inline limit keeps it a data URI instead of a request.
import logoUrl from "../../src-tauri/icons/32x32.png";
import "./Titlebar.css";

const appWindow = getCurrentWindow();

export function Titlebar() {
  const { theme } = useTheme();
  const togglePalette = useUiStore((s) => s.togglePalette);
  const setSettingsOpen = useUiStore((s) => s.setSettingsOpen);
  const activeWorkspacePath = useWorkspaceStore((s) => s.activeWorkspacePath);
  const active = useConnectionStore((s) => s.active);
  const egress = useSessionEgress();

  const contextLabel = activeWorkspacePath
    ? (activeWorkspacePath.split(/[/\\]/).pop() ?? "Workspace")
    : (active?.name ?? null);
  const contextKind = activeWorkspacePath ? "Workspace" : active ? "Instance" : null;
  const pillModifier = contextKind === "Workspace" ? "workspace" : "instance";

  const handleMinimize = useCallback(() => { appWindow.minimize(); }, []);
  const handleMaximize = useCallback(() => { appWindow.toggleMaximize(); }, []);
  const handleClose = useCallback(() => { appWindow.close(); }, []);
  const handleToggleTheme = useCallback(() => {
    setTheme(theme === "dark" ? "light" : "dark");
  }, [theme]);

  const handleImport = useCallback((result: ImportResult) => {
    useWorkspaceStore.getState().setOpenScript({ sql: result.content, name: result.name, id: `import-${Date.now()}`, v: Date.now() } as OpenScript);
  }, []);

  return (
    <div className="titlebar" data-tauri-drag-region>
      <div className="titlebar-start" data-tauri-drag-region>
        <span className="titlebar-brand" data-tauri-drag-region>
          <img className="titlebar-logo" src={logoUrl} alt="" width={14} height={14} data-tauri-drag-region />
          DIB
        </span>
        {egress.visible && (
          <Tooltip content={egress.title}>
            <button type="button" className="titlebar-egress" onClick={egress.run}>
              {egress.label === "Go home" ? <Home size={12} /> : <ArrowLeft size={12} />}
              <span>{egress.label}</span>
            </button>
          </Tooltip>
        )}
        {contextLabel && contextKind && (
          <Tooltip content={activeWorkspacePath ?? contextLabel}>
            <div className={`titlebar-context-pill titlebar-context-pill--${pillModifier}`}>
              <span className="titlebar-context-kind">{contextKind}</span>
              <span className="titlebar-context-name">{contextLabel}</span>
              {active?.readonly && !activeWorkspacePath ? (
                <ReadonlyBadge size={11} className="titlebar-context-ro" />
              ) : null}
            </div>
          </Tooltip>
        )}
      </div>

      <div className="titlebar-center" data-tauri-drag-region />

      <div className="titlebar-end">
        <Dropzone onImport={handleImport} />
        <Tooltip content={`Quick Command (${mod("Ctrl+K")})`}>
          <button type="button" className="titlebar-btn" onClick={togglePalette}>
            <Search size={15} />
          </button>
        </Tooltip>
        <Tooltip content={theme === "dark" ? "Light mode" : "Dark mode"}>
          <button type="button" className="titlebar-btn" onClick={handleToggleTheme}>
            {theme === "dark" ? <Sun size={15} /> : <Moon size={15} />}
          </button>
        </Tooltip>
        <Tooltip content="Settings">
          <button type="button" className="titlebar-btn" onClick={() => setSettingsOpen(true)}>
            <Settings size={15} />
          </button>
        </Tooltip>

        <div className="titlebar-separator" />

        <Tooltip content="Minimize">
          <button type="button" className="titlebar-btn titlebar-winctrl" onClick={handleMinimize}>
            <Minus size={15} />
          </button>
        </Tooltip>
        <Tooltip content="Maximize">
          <button type="button" className="titlebar-btn titlebar-winctrl" onClick={handleMaximize}>
            <Square size={13} />
          </button>
        </Tooltip>
        <Tooltip content="Close">
          <button type="button" className="titlebar-btn titlebar-winctrl titlebar-close" onClick={handleClose}>
            <X size={15} />
          </button>
        </Tooltip>
      </div>
    </div>
  );
}
