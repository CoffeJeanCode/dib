import { useState, useCallback } from "react";
import { connectionService } from "@/services/connectionService";
import type { ConnectionInfo, SavedConnection } from "@/types/db";

export interface ActiveConn {
  activeId: string;
  savedId: string;
  name: string;
  engine: string;
  dbVersion: number;
}

interface Options {
  connections: SavedConnection[];
  savePassword: boolean;
  onError: (msg: string) => void;
  onInfo: (msg: string) => void;
}

export function useConnectionManager({ connections, savePassword, onError, onInfo }: Options) {
  const [active, setActive] = useState<ActiveConn | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [passwordPrompt, setPasswordPrompt] = useState<{ savedId: string; name: string } | null>(null);

  const handleConnectionSelect = useCallback(
    async (savedId: string, password?: string) => {
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
        window.dispatchEvent(new CustomEvent("dib:reload"));
      } catch (e: unknown) {
        const err = e as { code?: string; message?: string };
        if (err?.code === "PASSWORD_REQUIRED") {
          const saved = connections.find((c) => c.id === savedId);
          setPasswordPrompt({ savedId, name: saved?.name || savedId });
        } else {
          onError(err?.message || String(e));
        }
      } finally {
        setConnecting(false);
      }
    },
    [connections, savePassword, onError],
  );

  const handleNewConnection = useCallback((connInfo: ConnectionInfo) => {
    setActive({
      activeId: connInfo.id,
      savedId: connInfo.id,
      name: connInfo.config.database || connInfo.config.path || connInfo.id,
      engine: connInfo.config.db_type,
      dbVersion: 0,
    });
  }, []);

  const handleDisconnect = useCallback(async () => {
    if (active) await connectionService.disconnect(active.activeId).catch(() => {});
    setActive(null);
  }, [active]);

  const handleDatabaseSwitch = useCallback(
    async (dbName: string) => {
      if (!active) return;
      try {
        await connectionService.switchDatabase(active.activeId, dbName);
        setActive((prev) => prev ? { ...prev, name: dbName, dbVersion: prev.dbVersion + 1 } : prev);
        window.dispatchEvent(new CustomEvent("dib:reload"));
        onInfo(`Conectado a "${dbName}"`);
      } catch (e: unknown) {
        const msg = e && typeof e === "object" && "message" in e
          ? String((e as { message: unknown }).message)
          : String(e);
        onError(msg);
      }
    },
    [active, onInfo, onError],
  );

  const handlePasswordSubmit = useCallback(
    (password: string) => {
      const prompt = passwordPrompt;
      setPasswordPrompt(null);
      if (prompt) handleConnectionSelect(prompt.savedId, password);
    },
    [passwordPrompt, handleConnectionSelect],
  );

  const handlePasswordCancel = useCallback(() => setPasswordPrompt(null), []);

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
