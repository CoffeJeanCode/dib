import { create } from "zustand";
import type { ConnectionInfo } from "@/types/db";

export interface ActiveConn {
  activeId: string;
  savedId: string;
  name: string;
  engine: string;
  dbVersion: number;
}

interface ConnectionState {
  active: ActiveConn | null;
  connecting: boolean;
  passwordPrompt: { savedId: string; name: string } | null;
  /** Incremented whenever a reload of sidebar/panel data is needed */
  reloadVersion: number;

  setActive: (a: ActiveConn | null) => void;
  setConnecting: (v: boolean) => void;
  setPasswordPrompt: (p: { savedId: string; name: string } | null) => void;
  triggerReload: () => void;
  bumpDbVersion: () => void;
  applyNewConnection: (connInfo: ConnectionInfo) => void;
}

export const useConnectionStore = create<ConnectionState>((set) => ({
  active: null,
  connecting: false,
  passwordPrompt: null,
  reloadVersion: 0,

  setActive: (a) => set({ active: a }),
  setConnecting: (v) => set({ connecting: v }),
  setPasswordPrompt: (p) => set({ passwordPrompt: p }),
  triggerReload: () => set((s) => ({ reloadVersion: s.reloadVersion + 1 })),
  bumpDbVersion: () =>
    set((s) =>
      s.active ? { active: { ...s.active, dbVersion: s.active.dbVersion + 1 } } : {},
    ),
  applyNewConnection: (connInfo) =>
    set({
      active: {
        activeId: connInfo.id,
        savedId: connInfo.id,
        name: connInfo.config.database || connInfo.config.path || connInfo.id,
        engine: connInfo.config.db_type,
        dbVersion: 0,
      },
    }),
}));
