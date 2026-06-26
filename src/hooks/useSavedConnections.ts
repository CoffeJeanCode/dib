import { useState, useEffect, useCallback } from "react";
import { connectionService } from "@/services/connectionService";
import type { SavedConnection } from "@/types/db";

export function useSavedConnections() {
  const [connections, setConnections] = useState<SavedConnection[]>([]);
  const [loaded, setLoaded] = useState(false);

  const refresh = useCallback(() => {
    connectionService.getSavedConnections()
      .then(setConnections)
      .catch(() => setConnections([]))
      .finally(() => setLoaded(true));
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const save = useCallback(
    (connection: SavedConnection) => {
      connectionService.saveConnection(connection)
        .then(() => refresh())
        .catch(() => {});
    },
    [refresh],
  );

  const remove = useCallback(
    (connectionId: string) => {
      connectionService.deleteConnection(connectionId)
        .then(() => refresh())
        .catch(() => {});
    },
    [refresh],
  );

  return { connections, loaded, save, remove, refresh };
}
