import { useEffect, useCallback } from "react";
import { create } from "zustand";
import { connectionService } from "@/services/connectionService";
import type { SavedConnection } from "@/types/db";

// Module-level store — all hook instances share one connections list.
const useConnectionsStore = create<{
  connections: SavedConnection[];
  loaded: boolean;
  set: (c: SavedConnection[]) => void;
  setLoaded: (v: boolean) => void;
}>((set) => ({
  connections: [],
  loaded: false,
  set: (connections) => set({ connections }),
  setLoaded: (loaded) => set({ loaded }),
}));

const refresh = () =>
  connectionService.getSavedConnections()
    .then(useConnectionsStore.getState().set)
    .catch(() => useConnectionsStore.getState().set([]))
    .finally(() => useConnectionsStore.getState().setLoaded(true));

export function useSavedConnections() {
  const { connections, loaded } = useConnectionsStore();

  useEffect(() => {
    if (!loaded) refresh();
  }, [loaded]);

  const save = useCallback((connection: SavedConnection) => {
    connectionService.saveConnection(connection).then(refresh).catch(() => {});
  }, []);

  const remove = useCallback((connectionId: string) => {
    connectionService.deleteConnection(connectionId).then(refresh).catch(() => {});
  }, []);

  return { connections, loaded, save, remove, refresh };
}
