import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { WorkspaceLayout } from "@/types/workspace";

interface SettingsState {
  /** User's visual preference — unified (DBs + scripts together) or split panels */
  workspaceLayout: WorkspaceLayout;
  setWorkspaceLayout: (layout: WorkspaceLayout) => void;
  /** Reopen the last workspace + connection automatically when the app starts */
  autoConnectOnStartup: boolean;
  setAutoConnectOnStartup: (v: boolean) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      workspaceLayout: "simple",
      setWorkspaceLayout: (layout) => set({ workspaceLayout: layout }),
      autoConnectOnStartup: false,
      setAutoConnectOnStartup: (v) => set({ autoConnectOnStartup: v }),
    }),
    { name: "dib-settings" },
  ),
);
