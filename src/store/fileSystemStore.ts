import { create } from "zustand";
import { persist } from "zustand/middleware";
import { safeInvoke as invoke } from "@/shared/utils/ipc";
import type { FsNode } from "@/types/workspace";

/**
 * Hybrid script filesystem.
 *
 * DIB has two parallel script origins:
 *   - "workspace"  → physical files on disk, CRUD via Tauri fs commands
 *   - "standalone" → virtual files in the app's internal SQLite
 *                    (virtual_scripts table, via Tauri commands)
 *
 * The UI never knows which one is active: it talks to `useFileSystemStore`,
 * which delegates to the current `ScriptFsAdapter` (Adapter Pattern).
 */

export type FsMode = "workspace" | "standalone";

/**
 * UI metadata attachable to any FS entity — scripts AND folders. Keyed by
 * entity id (physical path or virtual uuid), so it is origin-agnostic.
 */
export interface FsEntityMeta {
  /** Accent color: hex ("#7c3aed") or design token ("var(--color-teal)") */
  color?: string | null;
  isPinned?: boolean;
}

/** Unified script entry — same shape whether it lives on disk or in SQLite. */
export interface ScriptEntry {
  /** workspace: absolute file path · standalone: uuid */
  id: string;
  /** Visible name (filename with extension, or virtual script name) */
  name: string;
  /** Hydrated from the persisted meta map on every refresh */
  isPinned: boolean;
  /** Hydrated from the persisted meta map on every refresh */
  color?: string | null;
  /** standalone only: parent virtual folder */
  folderId?: string | null;
  updatedAt?: string;
}

/** What adapters report per entry; pin/color may come from the backend. */
export type AdapterEntry = Omit<ScriptEntry, "isPinned"> & { isPinned?: boolean };

/**
 * One CRUD contract, two origins. Backends that persist metadata natively
 * (virtual SQLite columns, workspace_item_meta) surface it in `list` and
 * accept writes via `setMeta`; the store's local meta map is the optimistic
 * cache and the fallback for ids the backend hasn't stored yet.
 */
export interface ScriptFsAdapter {
  readonly mode: FsMode;
  list(): Promise<AdapterEntry[]>;
  read(id: string): Promise<string>;
  /** Upsert. Returns the entry id (new files get their id assigned here). */
  write(id: string | null, name: string, content: string): Promise<string>;
  /** Returns the (possibly changed) id — physical renames change the path. */
  rename(id: string, newName: string): Promise<string>;
  remove(id: string): Promise<void>;
  /** Persist color/pin in the backend (works for scripts and folders). */
  setMeta(id: string, meta: FsEntityMeta): Promise<void>;
}

// ── Physical adapter (Workspace mode) ────────────────────────────────

const SCRIPT_EXT = /\.(sql|md)$/i;

function collectFiles(node: FsNode, out: AdapterEntry[]) {
  if (!node.isDir && SCRIPT_EXT.test(node.name)) {
    // color / is_pinned come from workspace_item_meta via read_workspace_tree
    out.push({ id: node.path, name: node.name, color: node.color ?? null, isPinned: node.is_pinned });
  }
  for (const child of node.children ?? []) collectFiles(child, out);
}

export function createPhysicalAdapter(rootPath: string, workspaceId: string | null): ScriptFsAdapter {
  const sep = rootPath.includes("\\") ? "\\" : "/";
  return {
    mode: "workspace",

    async list() {
      const tree = await invoke<FsNode>("read_workspace_tree", { path: rootPath, workspaceId });
      const out: AdapterEntry[] = [];
      collectFiles(tree, out);
      return out;
    },

    read: (id) => invoke<string>("read_text_file", { path: id }),

    async write(id, name, content) {
      const path = id ?? `${rootPath}${sep}${name}`;
      await invoke<void>("write_text_file", { path, content });
      return path;
    },

    async rename(id, newName) {
      const dir = id.slice(0, id.lastIndexOf(sep));
      const newPath = `${dir}${sep}${newName}`;
      await invoke<void>("rename_fs_item", { oldPath: id, newPath, workspaceId, rootPath });
      return newPath;
    },

    remove: (id) => invoke<void>("delete_fs_item", { path: id }),

    async setMeta(id, meta) {
      if (!workspaceId) return; // no meta table without a workspace
      // workspace_item_meta is keyed by root-relative forward-slash paths.
      const rel = id.startsWith(rootPath) ? id.slice(rootPath.length + 1) : id;
      await invoke<void>("save_workspace_item_meta", {
        workspaceId,
        itemPath: rel.replace(/\\/g, "/"),
        color: meta.color ?? null,
        // ponytail: sortOrder not tracked here yet — 0 until DnD ordering lands
        sortOrder: 0,
        isPinned: !!meta.isPinned,
      });
    },
  };
}

// ── Virtual adapter (Standalone mode, internal SQLite via Tauri) ─────

interface VirtualScript {
  id: string;
  name: string;
  content: string;
  folder_id: string | null;
  connection_id: string;
  updated_at: string;
  color?: string | null;
  is_pinned?: boolean;
}

export function createVirtualAdapter(connectionId: string): ScriptFsAdapter {
  const fetchAll = () => invoke<VirtualScript[]>("get_virtual_scripts", { connectionId });
  return {
    mode: "standalone",

    async list() {
      const rows = await fetchAll();
      return rows.map((r) => ({
        id: r.id,
        name: r.name,
        folderId: r.folder_id,
        updatedAt: r.updated_at,
        color: r.color ?? null,
        isPinned: r.is_pinned,
      }));
    },

    async read(id) {
      // ponytail: no single-row read command; fetch list and pick. Add a
      // get_virtual_script(id) command if script bodies get large.
      const rows = await fetchAll();
      const row = rows.find((r) => r.id === id);
      if (!row) throw new Error(`Virtual script not found: ${id}`);
      return row.content;
    },

    async write(id, name, content) {
      const scriptId = id ?? crypto.randomUUID();
      await invoke<void>("save_virtual_script", { id: scriptId, name, content, folderId: null, connectionId });
      return scriptId;
    },

    async rename(id, newName) {
      const content = await this.read(id);
      await invoke<void>("save_virtual_script", { id, name: newName, content, folderId: null, connectionId });
      return id;
    },

    remove: (id) => invoke<void>("delete_virtual_script", { id }),

    setMeta: (id, meta) =>
      invoke<void>("update_fs_metadata", {
        id,
        color: meta.color ?? null,
        isPinned: !!meta.isPinned,
      }),
  };
}

// ── Store ────────────────────────────────────────────────────────────

// Adapter is behavior, not renderable state — kept outside the store.
let adapter: ScriptFsAdapter | null = null;

interface FileSystemState {
  mode: FsMode;
  scripts: ScriptEntry[];
  loading: boolean;
  /**
   * Entity metadata (color, pin), persisted to localStorage. Uniform across
   * both modes and both entity kinds — physical paths, virtual uuids and
   * folder ids are all just keys here.
   * ponytail: frontend-only persistence; move to a backend column if meta
   * must sync across machines.
   */
  meta: Record<string, FsEntityMeta>;

  /** Switch to Workspace mode (physical FS rooted at the workspace dir). */
  configureWorkspace: (rootPath: string, workspaceId: string | null) => Promise<void>;
  /** Switch to Standalone mode (virtual FS scoped to a connection). */
  configureStandalone: (connectionId: string) => Promise<void>;
  refresh: () => Promise<void>;
  readScript: (id: string) => Promise<string>;
  /** Upsert; pass id=null to create. Returns the entry id. */
  saveScript: (id: string | null, name: string, content: string) => Promise<string>;
  renameScript: (id: string, newName: string) => Promise<void>;
  removeScript: (id: string) => Promise<void>;
  /** Works for scripts and folders — any entity id. */
  togglePin: (id: string) => void;
  /** Works for scripts and folders. Pass null to clear the color. */
  setColor: (id: string, color: string | null) => void;
}

export const useFileSystemStore = create<FileSystemState>()(
  persist(
    (set, get) => ({
      mode: "standalone",
      scripts: [],
      loading: false,
      meta: {},

      configureWorkspace: async (rootPath, workspaceId) => {
        adapter = createPhysicalAdapter(rootPath, workspaceId);
        set({ mode: "workspace", scripts: [] });
        await get().refresh();
      },

      configureStandalone: async (connectionId) => {
        adapter = createVirtualAdapter(connectionId);
        set({ mode: "standalone", scripts: [] });
        await get().refresh();
      },

      refresh: async () => {
        if (!adapter) return;
        set({ loading: true });
        try {
          const entries = await adapter.list();
          const { meta } = get();
          // Rehydration, not reset: fresh backend data merged with persisted
          // meta. Backend-stored values win; the local map fills the gaps —
          // pins/colors survive every refresh and reconnect.
          set({
            scripts: entries.map((e) => ({
              ...e,
              isPinned: e.isPinned ?? !!meta[e.id]?.isPinned,
              color: e.color ?? meta[e.id]?.color ?? null,
            })),
          });
        } catch (e) {
          console.error("[DIB] script fs list failed:", e);
          set({ scripts: [] });
        } finally {
          set({ loading: false });
        }
      },

      readScript: (id) => {
        if (!adapter) return Promise.reject(new Error("FS not configured"));
        return adapter.read(id);
      },

      saveScript: async (id, name, content) => {
        if (!adapter) throw new Error("FS not configured");
        const newId = await adapter.write(id, name, content);
        await get().refresh();
        return newId;
      },

      renameScript: async (id, newName) => {
        if (!adapter) throw new Error("FS not configured");
        const newId = await adapter.rename(id, newName);
        // Carry meta (pin + color) across a physical rename (id = path).
        if (newId !== id && get().meta[id]) {
          set((s) => {
            const meta = { ...s.meta };
            meta[newId] = meta[id];
            delete meta[id];
            return { meta };
          });
        }
        await get().refresh();
      },

      removeScript: async (id) => {
        if (!adapter) throw new Error("FS not configured");
        await adapter.remove(id);
        set((s) => {
          const meta = { ...s.meta };
          delete meta[id];
          return { meta, scripts: s.scripts.filter((sc) => sc.id !== id) };
        });
      },

      togglePin: (id) => {
        const current = get().scripts.find((sc) => sc.id === id);
        const isPinned = !(current?.isPinned ?? get().meta[id]?.isPinned);
        const merged: FsEntityMeta = { ...get().meta[id], isPinned };
        // Optimistic local update; backend write is best-effort.
        set((s) => ({
          meta: { ...s.meta, [id]: merged },
          scripts: s.scripts.map((sc) => (sc.id === id ? { ...sc, isPinned } : sc)),
        }));
        void adapter?.setMeta(id, merged).catch((e) => console.error("[DIB] setMeta failed:", e));
      },

      setColor: (id, color) => {
        const merged: FsEntityMeta = { ...get().meta[id], color };
        set((s) => ({
          meta: { ...s.meta, [id]: merged },
          scripts: s.scripts.map((sc) => (sc.id === id ? { ...sc, color } : sc)),
        }));
        void adapter?.setMeta(id, merged).catch((e) => console.error("[DIB] setMeta failed:", e));
      },
    }),
    {
      name: "dib-script-pins",
      version: 1,
      // Only meta persists; scripts/mode are re-derived per session.
      partialize: (s) => ({ meta: s.meta }),
      // v0 stored `pinnedIds: Record<string, true>` — fold into meta.
      migrate: (persisted: unknown) => {
        const p = persisted as { meta?: Record<string, FsEntityMeta>; pinnedIds?: Record<string, true> };
        if (p?.meta) return { meta: p.meta };
        const meta: Record<string, FsEntityMeta> = {};
        for (const id of Object.keys(p?.pinnedIds ?? {})) meta[id] = { isPinned: true };
        return { meta };
      },
    },
  ),
);


