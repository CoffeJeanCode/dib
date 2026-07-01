import { create } from "zustand";
import type { NavTable, OpenScript } from "@/types/workspace";
import type { TableInfo, QueryResult } from "@/types/db";

export interface JsonPanelData {
  title: string;
  /** Query result — enables the row-limit selector */
  result?: QueryResult;
  /** Arbitrary JSON (e.g. connection config) — rendered as-is, no row limit */
  raw?: string;
}

interface WorkspaceState {
  navigateTo: NavTable | null;
  openScript: OpenScript | null;
  /** Active table highlighted in sidebar — replaces dib:active-table */
  activeTable: { name: string; schema: string | null } | null;
  /** Incremented after each query run — replaces dib:query-executed */
  queryVersion: number;
  /** Incremented after a script is saved — replaces dib:script-saved */
  scriptVersion: number;
  /** Pending open-structure action from sidebar/palette — replaces dib:open-table-structure */
  pendingOpenStructure: TableInfo | null;
  /** Pending open-relations action — replaces dib:open-table-relations */
  pendingOpenRelations: TableInfo | null;
  /** Pending insert-row trigger — replaces dib:insert-row */
  pendingInsertRow: number;
  /** Pending tab action from Monaco keybindings — replaces dib:close-tab / dib:new-tab */
  tabAction: { type: "close" | "new"; v: number } | null;
  /** Right-side sliding JSON viewer panel */
  jsonPanel: JsonPanelData | null;

  setNavigateTo: (t: NavTable | null) => void;
  setOpenScript: (s: OpenScript | null) => void;
  setActiveTable: (t: { name: string; schema: string | null } | null) => void;
  incrementQueryVersion: () => void;
  incrementScriptVersion: () => void;
  openTableStructure: (t: TableInfo) => void;
  clearPendingOpenStructure: () => void;
  openTableRelations: (t: TableInfo) => void;
  clearPendingOpenRelations: () => void;
  triggerInsertRow: () => void;
  dispatchTabAction: (type: "close" | "new") => void;
  openJsonPanel: (data: JsonPanelData) => void;
  closeJsonPanel: () => void;
}

export const useWorkspaceStore = create<WorkspaceState>((set) => ({
  navigateTo: null,
  openScript: null,
  activeTable: null,
  queryVersion: 0,
  scriptVersion: 0,
  pendingOpenStructure: null,
  pendingOpenRelations: null,
  pendingInsertRow: 0,
  tabAction: null,
  jsonPanel: null,

  setNavigateTo: (t) => set({ navigateTo: t }),
  setOpenScript: (s) => set({ openScript: s }),
  setActiveTable: (t) => set({ activeTable: t }),
  incrementQueryVersion: () => set((s) => ({ queryVersion: s.queryVersion + 1 })),
  incrementScriptVersion: () => set((s) => ({ scriptVersion: s.scriptVersion + 1 })),
  openTableStructure: (t) => set({ pendingOpenStructure: t }),
  clearPendingOpenStructure: () => set({ pendingOpenStructure: null }),
  openTableRelations: (t) => set({ pendingOpenRelations: t }),
  clearPendingOpenRelations: () => set({ pendingOpenRelations: null }),
  triggerInsertRow: () => set((s) => ({ pendingInsertRow: s.pendingInsertRow + 1 })),
  dispatchTabAction: (type) => set({ tabAction: { type, v: Date.now() } }),
  openJsonPanel: (data) => set({ jsonPanel: data }),
  closeJsonPanel: () => set({ jsonPanel: null }),
}));
