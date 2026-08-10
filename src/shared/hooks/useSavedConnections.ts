import { useEffect, useCallback } from "react";
import { create } from "zustand";
import { connectionService } from "@/services/connectionService";
import type { SavedConnection } from "@/types/db";
import { useWorkspaceStore } from "@/store/workspaceStore";
import { useConnectionStore } from "@/store/connectionStore";

const useConnectionsStore = create<{
  connections: SavedConnection[];
  loaded: boolean;
  lastWorkspaceId: string | null | undefined;
  set: (c: SavedConnection[]) => void;
  setLoaded: (v: boolean, wid: string | null) => void;
}>((set) => ({
  connections: [],
  loaded: false,
  lastWorkspaceId: undefined,
  set: (connections) => set({ connections }),
  setLoaded: (loaded, wid) => set({ loaded, lastWorkspaceId: wid }),
}));

export function useSavedConnections() {
  const { connections, loaded, lastWorkspaceId } = useConnectionsStore();
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);

  const refresh = useCallback(() => {
    connectionService.getSavedConnections(activeWorkspaceId)
      .then(useConnectionsStore.getState().set)
      .catch(() => useConnectionsStore.getState().set([]))
      .finally(() => useConnectionsStore.getState().setLoaded(true, activeWorkspaceId));
  }, [activeWorkspaceId]);

  useEffect(() => {
    if (!loaded || lastWorkspaceId !== activeWorkspaceId) {
      refresh();
    }
  }, [loaded, lastWorkspaceId, activeWorkspaceId, refresh]);

  const save = useCallback((connection: SavedConnection) => {
    // Force current workspace id if not set
    const connToSave = { ...connection };
    if (activeWorkspaceId && connToSave.workspace_id === undefined) {
      connToSave.workspace_id = activeWorkspaceId;
    }
    return connectionService.saveConnection(connToSave).then(refresh);
  }, [activeWorkspaceId, refresh]);

  const remove = useCallback((connectionId: string) => {
    // Deleting the connection you are currently on would otherwise leave a live
    // session pointing at a row that no longer exists. Every caller needs this,
    // so it lives here rather than in each menu.
    const { active, setActive } = useConnectionStore.getState();
    if (active?.savedId === connectionId) {
      connectionService.disconnect(active.activeId).catch(() => {});
      setActive(null);
    }
    connectionService.deleteConnection(connectionId).then(refresh).catch(() => {});
  }, [refresh]);

  return { connections, loaded, save, remove, refresh };
}
