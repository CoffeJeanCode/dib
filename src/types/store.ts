import type { SavedConnection } from "@/types/db";

export type Theme = "dark" | "light";

export interface UiState {
  paletteOpen: boolean;
  settingsOpen: boolean;
  cheatSheetOpen: boolean;
  showNewConnection: boolean;
  editingConn: SavedConnection | null;
  theme: Theme;
  /** Set by ipc.ts on backend connection errors */
  backendError: { command: string; message: string } | null;

  openPalette: () => void;
  closePalette: () => void;
  togglePalette: () => void;
  setSettingsOpen: (v: boolean) => void;
  setCheatSheetOpen: (v: boolean) => void;
  setShowNewConnection: (v: boolean) => void;
  setEditingConn: (c: SavedConnection | null) => void;
  setTheme: (t: Theme) => void;
  setBackendError: (e: { command: string; message: string } | null) => void;
}
