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
    // ── Palette shortcuts (allowInMonaco: must fire while the SQL editor has focus too) ──
    { combo: "ctrl+p",       handler: () => { if (isConnected) onTogglePalette(); }, allowInMonaco: true },
    { combo: "ctrl+k",       handler: () => { if (isConnected) onTogglePalette(); }, allowInMonaco: true },
    // Ctrl+Shift+P → actions list (> prefix)
    { combo: "ctrl+shift+p", handler: () => { if (isConnected) useUiStore.getState().openPaletteWithQuery(">"); }, allowInMonaco: true },
    // Ctrl+Shift+D → switch database (@ prefix)
    { combo: "ctrl+shift+d", handler: () => { if (isConnected) useUiStore.getState().openPaletteWithQuery("@"); }, allowInMonaco: true },
    // Ctrl+Shift+S → open script (# prefix)
    { combo: "ctrl+shift+s", handler: () => { useUiStore.getState().openPaletteWithQuery("#"); }, allowInMonaco: true },
    // Ctrl+Shift+O → DB objects (% prefix)
    { combo: "ctrl+shift+o", handler: () => { if (isConnected) useUiStore.getState().openPaletteWithQuery("%"); }, allowInMonaco: true },
    // Ctrl+Shift+A → Alter Table (DDL mode)
    { combo: "ctrl+shift+a", handler: () => { if (isConnected) useUiStore.setState({ paletteOpen: true, paletteInitialDdlMode: "alter" }); }, allowInMonaco: true },
    // Ctrl+Shift+X → Drop Table (DDL mode)
    { combo: "ctrl+shift+x", handler: () => { if (isConnected) useUiStore.setState({ paletteOpen: true, paletteInitialDdlMode: "drop" }); }, allowInMonaco: true },
    // Ctrl+Shift+I → Insert Row (DDL mode)
    { combo: "ctrl+shift+i", handler: () => { if (isConnected) useUiStore.setState({ paletteOpen: true, paletteInitialDdlMode: "insert" }); }, allowInMonaco: true },

    // ── Navigation ─────────────────────────────────────────
    // Ctrl+1..3 select a sidebar panel (and focus it) — owned by Layout.
    // Ctrl+L only exists while QueryPanel is mounted, so main-panel focus
    // keeps its own global binding here.
    { combo: "ctrl+0",       handler: () => (document.getElementById("dib-main-panel") as HTMLElement | null)?.focus(), allowInMonaco: true },

    // ── Dev / reload ───────────────────────────────────────
    { combo: "ctrl+r",       handler: () => useConnectionStore.getState().triggerReload(), allowInMonaco: true },
    { combo: "ctrl+shift+r", handler: () => window.location.reload(), allowInMonaco: true },

    // ── Help ───────────────────────────────────────────────
    { combo: "ctrl+/",       handler: onToggleCheatSheet, allowInMonaco: true },
  ]);
}
