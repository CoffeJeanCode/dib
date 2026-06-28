import { create } from "zustand";
import type { SavedConnection } from "@/types/db";

function getInitialTheme(): "dark" | "light" {
  const stored = localStorage.getItem("dib-theme") as "dark" | "light" | null;
  const t = stored ?? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  document.documentElement.setAttribute("data-theme", t);
  return t;
}

interface UiState {
  paletteOpen: boolean;
  settingsOpen: boolean;
  cheatSheetOpen: boolean;
  showNewConnection: boolean;
  editingConn: SavedConnection | null;
  theme: "dark" | "light";
  /** Set by ipc.ts on backend connection errors — replaces dib:backend-error */
  backendError: { command: string; message: string } | null;

  openPalette: () => void;
  closePalette: () => void;
  togglePalette: () => void;
  setSettingsOpen: (v: boolean) => void;
  setCheatSheetOpen: (v: boolean) => void;
  setShowNewConnection: (v: boolean) => void;
  setEditingConn: (c: SavedConnection | null) => void;
  setTheme: (t: "dark" | "light") => void;
  setBackendError: (e: { command: string; message: string } | null) => void;
}

export const useUiStore = create<UiState>(() => ({
  paletteOpen: false,
  settingsOpen: false,
  cheatSheetOpen: false,
  showNewConnection: false,
  editingConn: null,
  theme: getInitialTheme(),
  backendError: null,

  openPalette: () => useUiStore.setState({ paletteOpen: true }),
  closePalette: () => useUiStore.setState({ paletteOpen: false }),
  togglePalette: () => useUiStore.setState((s) => ({ paletteOpen: !s.paletteOpen })),
  setSettingsOpen: (v) => useUiStore.setState({ settingsOpen: v }),
  setCheatSheetOpen: (v) => useUiStore.setState({ cheatSheetOpen: v }),
  setShowNewConnection: (v) => useUiStore.setState({ showNewConnection: v }),
  setEditingConn: (c) => useUiStore.setState({ editingConn: c }),
  setTheme: (t) => useUiStore.setState({ theme: t }),
  setBackendError: (e) => useUiStore.setState({ backendError: e }),
}));
