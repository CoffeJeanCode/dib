import { create } from "zustand";
import { persist } from "zustand/middleware";

/**
 * Concurrent expansion memory for every tree in the app (DBeaver-style).
 *
 * One flat map, compound keys. There is deliberately NO `activeConnection`
 * concept here: five databases can be expanded at once and interacting with
 * one never collapses another — no forced/punitive closes. State is only
 * ever *merged into*, never wiped by connection lifecycle events.
 *
 * Keys are compound ids built with `treeKey(namespace, ...segments)`, e.g.
 *   treeKey("dbitem", connectionId, schemaId, tableId)
 *     → "dbitem:conn-42:public:users"
 *
 * IMPORTANT: segments must be STABLE identifiers (saved-connection id,
 * schema name, path). Never key by ephemeral session uuids — that was the
 * previous implementation's retention bug: every reconnect minted a new
 * session id, orphaning all saved expansion state.
 *
 * Reserved namespaces:
 *   fs      workspace file tree            treeKey("fs", absolutePath)
 *   dbcat   schema category folders        treeKey("dbcat", connId, cat)
 *   dbitem  expandable schema items        treeKey("dbitem", connId, table)
 *   dbtree  lazy catalog tree              treeKey("dbtree", connId, nodeId)
 *   conn    connection rows                treeKey("conn", connId)
 *
 * Persisted to localStorage; survives layout switches, reconnects, restarts.
 */

const KEY_SEP = ":";

/** Builds a compound node key: treeKey("dbitem", connId, schema, table). */
export function treeKey(namespace: string, ...segments: (string | number)[]): string {
  return [namespace, ...segments].join(KEY_SEP);
}

interface TreeState {
  /** compound key -> explicit expansion state. Missing key = caller default. */
  expandedNodes: Record<string, boolean>;

  /** Flip one node. `defaultOpen` is what a missing key currently renders as. */
  toggleNode: (key: string, defaultOpen?: boolean) => void;
  setNode: (key: string, open: boolean) => void;
  /**
   * Rehydration entry point: merge a batch of expansion states WITHOUT
   * touching any other key. Use after connect/refresh when the backend
   * (or a saved UI-state snapshot) reports branches — user-opened branches
   * outside the patch stay intact.
   */
  mergeExpansion: (patch: Record<string, boolean>) => void;
  /**
   * Explicit cleanup only (e.g. a connection was *deleted*). Never call on
   * disconnect/reconnect/refresh — that would be a punitive reset.
   */
  pruneScope: (prefix: string) => void;
}

export const useTreeStateStore = create<TreeState>()(
  persist(
    (set) => ({
      expandedNodes: {},

      toggleNode: (key, defaultOpen = false) =>
        set((s) => ({
          expandedNodes: { ...s.expandedNodes, [key]: !(s.expandedNodes[key] ?? defaultOpen) },
        })),

      setNode: (key, open) =>
        set((s) => ({ expandedNodes: { ...s.expandedNodes, [key]: open } })),

      mergeExpansion: (patch) =>
        set((s) => ({ expandedNodes: { ...s.expandedNodes, ...patch } })),

      pruneScope: (prefix) =>
        set((s) => {
          const next: Record<string, boolean> = {};
          for (const [k, v] of Object.entries(s.expandedNodes)) {
            if (!k.startsWith(prefix)) next[k] = v;
          }
          return { expandedNodes: next };
        }),
    }),
    {
      name: "dib-tree-state",
      version: 2,
      // v1 stored the map under `expanded` — carry it over, don't reset.
      migrate: (persisted: unknown) => {
        const p = persisted as { expanded?: Record<string, boolean>; expandedNodes?: Record<string, boolean> };
        return { expandedNodes: p?.expandedNodes ?? p?.expanded ?? {} };
      },
    },
  ),
);

/** Reactive expansion check with a per-node default. */
export function useNodeExpanded(key: string, defaultOpen = false): boolean {
  return useTreeStateStore((s) => s.expandedNodes[key] ?? defaultOpen);
}
