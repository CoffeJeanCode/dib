import { useCallback } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Search, Moon, Sun, Settings, Minus, Square, X } from "lucide-react";
import { mod } from "@/shared/utils/platform";
import { useUiStore } from "@/store/uiStore";
import { useTheme, setTheme } from "@/shared/hooks/useTheme";
import { Dropzone, type ImportResult } from "@/shared/ui/Dropzone";
import { useWorkspaceStore } from "@/store/workspaceStore";
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
  const setActiveWorkspacePath = useWorkspaceStore((s) => s.setActiveWorkspacePath);

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
        {activeWorkspacePath && (
          <div className="titlebar-workspace-pill">
            <span className="titlebar-workspace-name">{activeWorkspacePath.split(/[/\\]/).pop()}</span>
            <button className="titlebar-workspace-close" onClick={() => setActiveWorkspacePath(null)} title="Close Workspace">
              <X size={12} />
            </button>
          </div>
        )}
      </div>

      <div className="titlebar-center" data-tauri-drag-region />

      <div className="titlebar-end">
        <Dropzone onImport={handleImport} />
        <button className="titlebar-btn" onClick={togglePalette} title={`Quick Command (${mod("Ctrl+K")})`}>
          <Search size={15} />
        </button>
        <button className="titlebar-btn" onClick={handleToggleTheme} title={theme === "dark" ? "Light mode" : "Dark mode"}>
          {theme === "dark" ? <Sun size={15} /> : <Moon size={15} />}
        </button>
        <button className="titlebar-btn" onClick={() => setSettingsOpen(true)} title="Settings">
          <Settings size={15} />
        </button>

        <div className="titlebar-separator" />

        <button className="titlebar-btn titlebar-winctrl" onClick={handleMinimize} title="Minimize">
          <Minus size={15} />
        </button>
        <button className="titlebar-btn titlebar-winctrl" onClick={handleMaximize} title="Maximize">
          <Square size={13} />
        </button>
        <button className="titlebar-btn titlebar-winctrl titlebar-close" onClick={handleClose} title="Close">
          <X size={15} />
        </button>
      </div>
    </div>
  );
}
