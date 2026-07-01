import { useCallback } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Search, Moon, Sun, Settings, Minus, Square, X } from "lucide-react";
import { useUiStore } from "@/store/uiStore";
import { useTheme, setTheme } from "@/hooks/useTheme";
import { ImportDropdown, type ImportResult } from "@/components/ImportDropdown";
import { useWorkspaceStore } from "@/store/workspaceStore";
import type { OpenScript } from "@/types/workspace";
import "./Titlebar.css";

const appWindow = getCurrentWindow();

export function Titlebar() {
  const { theme } = useTheme();
  const togglePalette = useUiStore((s) => s.togglePalette);
  const setSettingsOpen = useUiStore((s) => s.setSettingsOpen);

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
        <span className="titlebar-brand" data-tauri-drag-region>DIB</span>
      </div>

      <div className="titlebar-center" data-tauri-drag-region />

      <div className="titlebar-end">
        <ImportDropdown onImport={handleImport} />
        <button className="titlebar-btn" onClick={togglePalette} title="Quick Command (Ctrl+K)">
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
