import { create } from "zustand";
import type { UiState, Theme, RecentCommand } from "@/types/store";

function getInitialTheme(): Theme {
  const stored = localStorage.getItem("dib-theme") as Theme | null;
  const t = stored ?? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  document.documentElement.setAttribute("data-theme", t);
  return t;
}

function getInitialRecents(): RecentCommand[] {
  try {
    const stored = localStorage.getItem("dib_recent_commands");
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
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
  recentCommands: getInitialRecents(),

  openPalette: () => useUiStore.setState({ paletteOpen: true }),
  closePalette: () => useUiStore.setState({ paletteOpen: false }),
  togglePalette: () => useUiStore.setState((s) => ({ paletteOpen: !s.paletteOpen })),
  setSettingsOpen: (v) => useUiStore.setState({ settingsOpen: v }),
  setCheatSheetOpen: (v) => useUiStore.setState({ cheatSheetOpen: v }),
  setShowNewConnection: (v) => useUiStore.setState({ showNewConnection: v }),
  setEditingConn: (c) => useUiStore.setState({ editingConn: c }),
  setTheme: (t) => useUiStore.setState({ theme: t }),
  setBackendError: (e) => useUiStore.setState({ backendError: e }),

  renameTarget: null,
  alterTarget: null,
  dbAction: null,
  dangerDialog: null,
  setRenameTarget: (t) => useUiStore.setState({ renameTarget: t }),
  setAlterTarget: (t) => useUiStore.setState({ alterTarget: t }),
  setDbAction: (action) => useUiStore.setState({ dbAction: action }),
  setDangerDialog: (d) => useUiStore.setState({ dangerDialog: d }),
  pushToRecents: (cmd) => useUiStore.setState((s) => {
    // Remove if already exists (by ID) to push to top
    const filtered = s.recentCommands.filter((c) => c.id !== cmd.id);
    const next = [cmd, ...filtered].slice(0, 5);
    try {
      localStorage.setItem("dib_recent_commands", JSON.stringify(next));
    } catch (e) {
      console.error("Failed to save recent commands", e);
    }
    return { recentCommands: next };
  }),
}));
