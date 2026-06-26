import { safeInvoke as invoke } from "@/utils/ipc";
import type { ConnectionInfo, SavedConnection } from "@/types/db";

export const connectionService = {
  connectSaved: (savedId: string, password: string | null, savePassword: boolean) =>
    invoke<ConnectionInfo>("connect_saved", { savedId, password, savePassword }),

  connectToDb: (config: Record<string, unknown>) =>
    invoke<ConnectionInfo>("connect_to_db", { config }),

  disconnect: (connectionId: string) =>
    invoke<void>("disconnect", { connectionId }),

  switchDatabase: (connectionId: string, dbName: string) =>
    invoke<void>("switch_database", { connectionId, dbName }),

  testConnection: (config: Record<string, unknown>) =>
    invoke<void>("test_connection", { config }),

  getSavedConnections: () =>
    invoke<SavedConnection[]>("get_saved_connections"),

  saveConnection: (connection: SavedConnection) =>
    invoke<void>("save_connection", { connection }),

  deleteConnection: (connectionId: string) =>
    invoke<void>("delete_connection", { connectionId }),
};
