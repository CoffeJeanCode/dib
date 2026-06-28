import { useCallback } from "react";
import { connectionService } from "@/services/connectionService";
import { useConnectionStore } from "@/store/connectionStore";
import type { ConnectionInfo, SavedConnection } from "@/types/db";

interface Options {
  connections: SavedConnection[];
  savePassword: boolean;
  onError: (msg: string) => void;
  onInfo: (msg: string) => void;
}

export function useConnectionManager({ connections, savePassword, onError, onInfo }: Options) {
  const { active, connecting, passwordPrompt,
    setActive, setConnecting, setPasswordPrompt, triggerReload } = useConnectionStore();

  const handleConnectionSelect = useCallback(
    async (savedId: string, password?: string): Promise<boolean> => {
      setConnecting(true);
      try {
        const connInfo = await connectionService.connectSaved(savedId, password ?? null, savePassword);
        const saved = connections.find((c) => c.id === savedId);
        setActive({
          activeId: connInfo.id,
          savedId,
          name: connInfo.config.database || connInfo.config.path || saved?.name || connInfo.id,
          engine: connInfo.config.db_type,
          dbVersion: 0,
        });
        triggerReload();
        return true;
      } catch (e: unknown) {
        const err = e as { code?: string; message?: string };
        if (err?.code === "PASSWORD_REQUIRED") {
          const saved = connections.find((c) => c.id === savedId);
          setPasswordPrompt({ savedId, name: saved?.name || savedId });
        } else {
          onError(err?.message || String(e));
        }
        return false;
      } finally {
        setConnecting(false);
      }
    },
    [connections, savePassword, onError, setActive, setConnecting, setPasswordPrompt, triggerReload],
  );

  const handleNewConnection = useCallback((connInfo: ConnectionInfo) => {
    setActive({
      activeId: connInfo.id,
      savedId: connInfo.id,
      name: connInfo.config.database || connInfo.config.path || connInfo.id,
      engine: connInfo.config.db_type,
      dbVersion: 0,
    });
  }, [setActive]);

  const handleDisconnect = useCallback(async () => {
    if (active) await connectionService.disconnect(active.activeId).catch(() => {});
    setActive(null);
  }, [active, setActive]);

  const handleDatabaseSwitch = useCallback(
    async (dbName: string) => {
      if (!active) return;
      try {
        await connectionService.switchDatabase(active.activeId, dbName);
        setActive({ ...active, name: dbName, dbVersion: active.dbVersion + 1 });
        triggerReload();
        onInfo(`Conectado a "${dbName}"`);
      } catch (e: unknown) {
        const msg = e && typeof e === "object" && "message" in e
          ? String((e as { message: unknown }).message)
          : String(e);
        onError(msg);
      }
    },
    [active, onInfo, onError, setActive, triggerReload],
  );

  const handlePasswordSubmit = useCallback(
    async (password: string) => {
      if (!passwordPrompt) return;
      const success = await handleConnectionSelect(passwordPrompt.savedId, password);
      if (success) {
        setPasswordPrompt(null);
      }
    },
    [passwordPrompt, handleConnectionSelect, setPasswordPrompt],
  );

  const handlePasswordCancel = useCallback(() => setPasswordPrompt(null), [setPasswordPrompt]);

  return {
    active,
    connecting,
    passwordPrompt,
    handleConnectionSelect,
    handleNewConnection,
    handleDisconnect,
    handleDatabaseSwitch,
    handlePasswordSubmit,
    handlePasswordCancel,
  };
}
