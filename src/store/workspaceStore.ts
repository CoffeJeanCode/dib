import { create } from "zustand";
import type { NavTable, OpenScript, FsNode, DbConnectionStatus, WorkspaceLayout } from "@/types/workspace";
import type { TableInfo, QueryResult, InternalScript } from "@/types/db";
import { workspaceService } from "@/services/workspaceService";
import { connectionService } from "@/services/connectionService";
import { useConnectionStore } from "@/store/connectionStore";
import { disposeAllMonacoModels } from "@/shared/utils/monacoRegistry";

// Monotonic request id for readWorkspaceTree. A response is applied only if
// no newer request started meanwhile — otherwise a slow read from Workspace A
// would overwrite Workspace B's tree (and its activeWorkspacePath).
let treeReq = 0;

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
  /** Pending tab action from Monaco keybindings or sidebar deletes */
  tabAction: { type: "close" | "new" | "close_by_path"; payload?: string; v: number } | null;
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
  dispatchTabAction: (type: "close" | "new" | "close_by_path", payload?: string) => void;
  openJsonPanel: (data: JsonPanelData) => void;
  closeJsonPanel: () => void;
  internalScripts: InternalScript[];
  setInternalScripts: (scripts: InternalScript[]) => void;
  upsertInternalScript: (script: InternalScript) => void;

  activeWorkspacePath: string | null;
  activeWorkspaceId: string | null;
  workspaceTree: FsNode | null;
  isTreeLoading: boolean;
  /** connectionId -> status, drives DB nodes in the tree/panel */
  dbConnectionStatus: Record<string, DbConnectionStatus>;
  /** Item currently being dragged in the tree, if any */
  draggingPath: string | null;
  /** True while a move_fs_item + rehydrate round-trip is in flight (non-blocking) */
  isMovingItem: boolean;

  setActiveWorkspacePath: (path: string | null, id?: string | null) => void;
  /** Purges all per-workspace state (editor models, session, history, tree). */
  cleanupWorkspace: () => void;
  loadWorkspaceTree: (rootPath: string, workspaceId?: string | null) => Promise<void>;
  setDbConnectionStatus: (connectionId: string, status: DbConnectionStatus) => void;
  setDraggingPath: (path: string | null) => void;
  moveFsItem: (sourcePath: string, targetDir: string) => Promise<void>;
}

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
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
  internalScripts: [],

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
  dispatchTabAction: (type, payload) => set({ tabAction: { type, payload, v: Date.now() } }),
  openJsonPanel: (data) => set({ jsonPanel: data }),
  closeJsonPanel: () => set({ jsonPanel: null }),
  setInternalScripts: (scripts) => set({ internalScripts: scripts }),
  upsertInternalScript: (script) => set((s) => {
    const exists = s.internalScripts.some((i) => i.id === script.id);
    if (exists) {
      return { internalScripts: s.internalScripts.map((i) => i.id === script.id ? script : i) };
    }
    return { internalScripts: [script, ...s.internalScripts] };
  }),

  activeWorkspacePath: null,
  activeWorkspaceId: null,
  workspaceTree: null,
  isTreeLoading: false,
  dbConnectionStatus: {},
  draggingPath: null,
  isMovingItem: false,

  cleanupWorkspace: () => {
    treeReq++; // invalidate any in-flight tree read from the old workspace

    // Kill the backend DB session first — dropping the driver discards
    // Postgres session variables (SET ...) along with it.
    const connStore = useConnectionStore.getState();
    const activeSessionId = connStore.active?.activeId;
    connStore.setActive(null);
    connStore.setPasswordPrompt(null);
    if (activeSessionId) {
      connectionService.disconnect(activeSessionId).catch(() => {});
    }

    // Purge every piece of in-memory workspace state.
    set({
      navigateTo: null,
      openScript: null,
      activeTable: null,
      pendingOpenStructure: null,
      pendingOpenRelations: null,
      tabAction: null,
      jsonPanel: null,
      internalScripts: [],
      workspaceTree: null,
      dbConnectionStatus: {},
      draggingPath: null,
      isMovingItem: false,
    });

    // Dispose Monaco models after React has unmounted the editors that hold
    // them — disposing a model still attached to a live editor throws.
    requestAnimationFrame(() => disposeAllMonacoModels());
  },

  setActiveWorkspacePath: (path, id) => {
    get().cleanupWorkspace();
    // Register the switch in the Rust backend so the execution guard knows
    // the real active workspace (never trusted from per-query args).
    workspaceService.setActiveWorkspace(id ?? null).catch((e) => {
      console.error("[DIB] set_active_workspace failed:", e);
    });
    set({ activeWorkspacePath: path, activeWorkspaceId: id ?? null });
    if (path) {
      get().loadWorkspaceTree(path, id);
    }
  },

  loadWorkspaceTree: async (rootPath, workspaceId) => {
    const req = ++treeReq;
    set({ isTreeLoading: true });
    try {
      const tree = await workspaceService.readWorkspaceTree(rootPath, workspaceId ?? null);
      if (req !== treeReq) return; // stale response — a newer workspace won
      set({ workspaceTree: tree, activeWorkspacePath: rootPath, activeWorkspaceId: workspaceId ?? null });
    } catch (e) {
      if (req !== treeReq) return;
      // Root deleted/renamed from the OS explorer mid-read. Backend returns a
      // typed "NotFound: ..." error — degrade to an empty tree, don't crash.
      console.error("[DIB] read_workspace_tree failed:", e);
      set({ workspaceTree: null });
    } finally {
      if (req === treeReq) set({ isTreeLoading: false });
    }
  },

  setDbConnectionStatus: (connectionId, status) => set((s) => ({
    dbConnectionStatus: { ...s.dbConnectionStatus, [connectionId]: status },
  })),

  setDraggingPath: (path) => set({ draggingPath: path }),

  moveFsItem: async (sourcePath, targetDir) => {
    const root = get().activeWorkspacePath;
    const wid = get().activeWorkspaceId;
    set({ isMovingItem: true });
    try {
      const req = treeReq;
      // move_fs_item is a rename — build the full destination path.
      const sep = targetDir.includes("\\") ? "\\" : "/";
      const base = sourcePath.split(/[\\/]/).pop() ?? sourcePath;
      await workspaceService.moveFsItem(sourcePath, `${targetDir}${sep}${base}`, wid, root);
      if (root && req === treeReq) {
        const tree = await workspaceService.readWorkspaceTree(root, wid);
        if (req === treeReq) set({ workspaceTree: tree });
      }
    } catch (e) {
      console.error("[DIB] move_fs_item failed:", e);
    } finally {
      set({ isMovingItem: false, draggingPath: null });
    }
  },
}));

// Selector: returns tree + scripts combined (unified) or as separate panels (split),
// per the user's workspaceLayout preference (now sourced from useSettingsStore).
export function selectWorkspacePanels(s: WorkspaceState, layout: WorkspaceLayout) {
  if (layout === "split") {
    return { mode: "split" as const, tree: s.workspaceTree, scripts: s.internalScripts };
  }
  return {
    mode: "unified" as const,
    items: [
      ...(s.workspaceTree?.children ?? []),
      ...s.internalScripts.map((sc) => ({ name: sc.title, path: sc.id, isDir: false, isScript: true as const })),
    ],
  };
}
