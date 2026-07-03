import type { SavedConnection } from "@/types/db";

export type Theme = "dark" | "light";

export type RecentCommand = 
  | { type: "table"; id: string; label: string; table: import("@/types/db").TableInfo }
  | { type: "script"; id: string; label: string; script: import("@/types/db").InternalScript }
  | { type: "database"; id: string; label: string; dbName: string }
  | { type: "object"; id: string; label: string; subtype: string; name: string; schema: string | null }
  | { type: "action"; id: string; label: string }
  | { type: "diagram"; id: string; label: string; table: import("@/types/db").TableInfo }
  | { type: "ddl"; id: string; label: string; action: "alter" | "create"; table: import("@/types/db").TableInfo }
  | { type: "dml"; id: string; label: string; action: "insert"; table: import("@/types/db").TableInfo };

export interface UiState {
  paletteOpen: boolean;
  settingsOpen: boolean;
  cheatSheetOpen: boolean;
  showNewConnection: boolean;
  editingConn: SavedConnection | null;
  theme: Theme;
  backendError: { command: string; message: string } | null;

  renameTarget: import("@/types/db").TableInfo | null;
  alterTarget: import("@/types/db").TableInfo | null;
  dbAction: { action: "create" | "rename" | "drop"; dbName?: string } | null;
  dangerDialog: { message: string; onConfirm: () => Promise<void> } | null;
  recentCommands: RecentCommand[];

  openPalette: () => void;
  closePalette: () => void;
  togglePalette: () => void;
  setSettingsOpen: (v: boolean) => void;
  setCheatSheetOpen: (v: boolean) => void;
  setShowNewConnection: (v: boolean) => void;
  setEditingConn: (c: SavedConnection | null) => void;
  setTheme: (t: Theme) => void;
  setBackendError: (e: { command: string; message: string } | null) => void;
  setRenameTarget: (t: import("@/types/db").TableInfo | null) => void;
  setAlterTarget: (t: import("@/types/db").TableInfo | null) => void;
  setDbAction: (action: { action: "create" | "rename" | "drop"; dbName?: string } | null) => void;
  setDangerDialog: (d: { message: string; onConfirm: () => Promise<void> } | null) => void;
  pushToRecents: (cmd: RecentCommand) => void;
}
