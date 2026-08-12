import { useEffect } from "react";
import { useKeybindings } from "./useKeybindings";
import { useUiStore } from "@/store/uiStore";
import { useConnectionStore } from "@/store/connectionStore";
import { combo, combos } from "@/shared/shortcuts";

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
    // ── Palette (allowInMonaco: must fire while the SQL editor has focus too) ──
    ...combos("palette.open").map((c) => ({
      combo: c,
      handler: () => { if (isConnected) onTogglePalette(); },
      allowInMonaco: true,
    })),
    { combo: combo("palette.actions"), handler: () => { if (isConnected) useUiStore.getState().openPaletteWithQuery(">"); }, allowInMonaco: true },
    { combo: combo("palette.database"), handler: () => { if (isConnected) useUiStore.getState().openPaletteWithQuery("@"); }, allowInMonaco: true },
    { combo: combo("palette.script"), handler: () => { useUiStore.getState().openPaletteWithQuery("#"); }, allowInMonaco: true },
    { combo: combo("palette.objects"), handler: () => { if (isConnected) useUiStore.getState().openPaletteWithQuery("%"); }, allowInMonaco: true },
    { combo: combo("palette.alter"), handler: () => { if (isConnected) useUiStore.setState({ paletteOpen: true, paletteInitialDdlMode: "alter" }); }, allowInMonaco: true },
    { combo: combo("palette.drop"), handler: () => { if (isConnected) useUiStore.setState({ paletteOpen: true, paletteInitialDdlMode: "drop" }); }, allowInMonaco: true },
    { combo: combo("palette.insert"), handler: () => { if (isConnected) useUiStore.setState({ paletteOpen: true, paletteInitialDdlMode: "insert" }); }, allowInMonaco: true },

    // ── Navigation ─────────────────────────────────────────
    // Sidebar activity Shift+Alt+Q/W/E — owned by Layout (see SHORTCUT_CATALOG).
    { combo: combo("panel.focusMain"), handler: () => (document.getElementById("dib-main-panel") as HTMLElement | null)?.focus(), allowInMonaco: true },

    // ── Dev / reload ───────────────────────────────────────
    { combo: combo("app.reloadData"), handler: () => useConnectionStore.getState().triggerReload(), allowInMonaco: true },
    { combo: combo("app.reloadApp"), handler: () => window.location.reload(), allowInMonaco: true },

    // ── Help ───────────────────────────────────────────────
    { combo: combo("help.cheatSheet"), handler: onToggleCheatSheet, allowInMonaco: true },
  ]);
}
