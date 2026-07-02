import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { WorkspaceLayout } from "@/types/workspace";

interface SettingsState {
  /** User's visual preference — unified (DBs + scripts together) or split panels */
  workspaceLayout: WorkspaceLayout;
  setWorkspaceLayout: (layout: WorkspaceLayout) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      workspaceLayout: "unified",
      setWorkspaceLayout: (layout) => set({ workspaceLayout: layout }),
    }),
    { name: "dib-settings" },
  ),
);
