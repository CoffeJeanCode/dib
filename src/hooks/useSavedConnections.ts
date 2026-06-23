import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { SavedConnection } from "../types/db";

export function useSavedConnections() {
  const [connections, setConnections] = useState<SavedConnection[]>([]);
  const [loaded, setLoaded] = useState(false);

  const refresh = useCallback(() => {
    invoke<SavedConnection[]>("get_saved_connections")
      .then(setConnections)
      .catch(() => setConnections([]))
      .finally(() => setLoaded(true));
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const save = useCallback(
    (connection: SavedConnection) => {
      invoke("save_connection", { connection })
        .then(() => refresh())
        .catch(() => {});
    },
    [refresh],
  );

  const remove = useCallback(
    (connectionId: string) => {
      invoke("delete_connection", { connectionId })
        .then(() => refresh())
        .catch(() => {});
    },
    [refresh],
  );

  return { connections, loaded, save, remove, refresh };
}
