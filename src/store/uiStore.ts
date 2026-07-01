import { create } from "zustand";
import type { UiState, Theme } from "@/types/store";

function getInitialTheme(): Theme {
  const stored = localStorage.getItem("dib-theme") as Theme | null;
  const t = stored ?? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  document.documentElement.setAttribute("data-theme", t);
  return t;
}

export type { UiState, Theme };

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
