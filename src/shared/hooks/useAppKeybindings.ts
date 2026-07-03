import { useEffect } from "react";
import { useKeybindings } from "./useKeybindings";
import { useUiStore } from "@/store/uiStore";
import { useConnectionStore } from "@/store/connectionStore";

interface Options {
  isConnected: boolean;
  onTogglePalette: () => void;
  onToggleCheatSheet: () => void;
  onBackendError: (command: string, message: string) => void;
}

export function useAppKeybindings({ isConnected, onTogglePalette, onToggleCheatSheet, onBackendError }: Options) {
  const backendError = useUiStore((s) => s.backendError);
  useEffect(() => {
    if (backendError) {
      onBackendError(backendError.command, backendError.message);
      useUiStore.getState().setBackendError(null);
    }
  }, [backendError, onBackendError]);

  useKeybindings([
    // ── Palette shortcuts ──────────────────────────────────
    { combo: "ctrl+p",       handler: () => { if (isConnected) onTogglePalette(); } },
    { combo: "ctrl+k",       handler: () => { if (isConnected) onTogglePalette(); } },
    // Ctrl+Shift+P → actions list (> prefix)
    { combo: "ctrl+shift+p", handler: () => { if (isConnected) useUiStore.getState().openPaletteWithQuery(">"); } },
    // Ctrl+Shift+D → switch database (@ prefix)
    { combo: "ctrl+shift+d", handler: () => { if (isConnected) useUiStore.getState().openPaletteWithQuery("@"); } },
    // Ctrl+Shift+S → open script (# prefix)
    { combo: "ctrl+shift+s", handler: () => { useUiStore.getState().openPaletteWithQuery("#"); } },
    // Ctrl+Shift+O → DB objects (% prefix)
    { combo: "ctrl+shift+o", handler: () => { if (isConnected) useUiStore.getState().openPaletteWithQuery("%"); } },
    // Ctrl+Shift+A → Alter Table (DDL mode)
    { combo: "ctrl+shift+a", handler: () => { if (isConnected) useUiStore.setState({ paletteOpen: true, paletteInitialDdlMode: "alter" }); } },
    // Ctrl+Shift+X → Drop Table (DDL mode)
    { combo: "ctrl+shift+x", handler: () => { if (isConnected) useUiStore.setState({ paletteOpen: true, paletteInitialDdlMode: "drop" }); } },
    // Ctrl+Shift+I → Insert Row (DDL mode)
    { combo: "ctrl+shift+i", handler: () => { if (isConnected) useUiStore.setState({ paletteOpen: true, paletteInitialDdlMode: "insert" }); } },

    // ── Navigation ─────────────────────────────────────────
    { combo: "ctrl+1",       handler: () => (document.getElementById("dib-sidebar-nav") as HTMLElement | null)?.focus(), allowInMonaco: true },
    { combo: "ctrl+2",       handler: () => (document.getElementById("dib-main-panel") as HTMLElement | null)?.focus(), allowInMonaco: true },

    // ── Dev / reload ───────────────────────────────────────
    { combo: "ctrl+r",       handler: () => useConnectionStore.getState().triggerReload(), allowInMonaco: true },
    { combo: "ctrl+shift+r", handler: () => window.location.reload(), allowInMonaco: true },

    // ── Help ───────────────────────────────────────────────
    { combo: "ctrl+/",       handler: onToggleCheatSheet, allowInMonaco: true },
  ]);
}
