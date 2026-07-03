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
  
  selectConnection: (savedId: string, password?: string, savePassword?: boolean) => Promise<boolean>;
  disconnect: () => Promise<void>;
  switchDatabase: (dbName: string) => Promise<void>;
  submitPassword: (password: string, savePassword?: boolean) => Promise<boolean>;
  cancelPassword: () => void;
}

export const useConnectionStore = create<ConnectionState>((set, get) => ({
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

  selectConnection: async (savedId, password, savePassword) => {
    set({ connecting: true });
    try {
      const { connectionService } = await import("@/services/connectionService");
      const connInfo = await connectionService.connectSaved(savedId, password ?? null, savePassword ?? false);
      
      const allSaved = await connectionService.getSavedConnections();
      const saved = allSaved.find(c => c.id === savedId);
      const finalName = connInfo.config.database || connInfo.config.path || saved?.name || connInfo.id;
      
      set({
        active: {
          activeId: connInfo.id,
          savedId,
          name: finalName,
          engine: connInfo.config.db_type,
          dbVersion: 0,
        }
      });
      const { useWorkspaceStore } = await import("@/store/workspaceStore");
      const { rememberLastConnection } = await import("@/utils/quickConnect");
      rememberLastConnection(useWorkspaceStore.getState().activeWorkspaceId, savedId);
      get().triggerReload();
      return true;
    } catch (e: any) {
      if (e?.code === "PASSWORD_REQUIRED" || e?.code === "AuthRequired" || e?.code === "MissingCredentials") {
        const { connectionService } = await import("@/services/connectionService");
        const allSaved = await connectionService.getSavedConnections();
        const saved = allSaved.find(c => c.id === savedId);
        set({ passwordPrompt: { savedId, name: saved?.name || savedId } });
      } else {
        const { useToastStore } = await import("@/store/toastStore");
        useToastStore.getState().error(e?.message || String(e));
      }
      return false;
    } finally {
      set({ connecting: false });
    }
  },

  disconnect: async () => {
    const { active } = get();
    if (active) {
      const { connectionService } = await import("@/services/connectionService");
      await connectionService.disconnect(active.activeId).catch(() => {});
    }
    set({ active: null });
  },

  switchDatabase: async (dbName) => {
    const { active } = get();
    if (!active) return;
    try {
      const { connectionService } = await import("@/services/connectionService");
      await connectionService.switchDatabase(active.activeId, dbName);
      set({ active: { ...active, name: dbName, dbVersion: active.dbVersion + 1 } });
      get().triggerReload();
      const { useToastStore } = await import("@/store/toastStore");
      useToastStore.getState().info(`Conectado a "${dbName}"`);
    } catch (e: any) {
      const { useToastStore } = await import("@/store/toastStore");
      useToastStore.getState().error(e?.message || String(e));
    }
  },

  submitPassword: async (password, savePassword) => {
    const { passwordPrompt } = get();
    if (!passwordPrompt) return false;
    const success = await get().selectConnection(passwordPrompt.savedId, password, savePassword);
    if (success) {
      set({ passwordPrompt: null });
    }
    return success;
  },

  cancelPassword: () => set({ passwordPrompt: null }),
}));
