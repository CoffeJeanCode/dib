import { useState, useCallback, createContext, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Layout } from "./components/Layout";
import { ConnectionManager } from "./components/ConnectionManager";
import { QueryPanel } from "./components/QueryPanel";
import { CommandPalette } from "./components/CommandPalette";
import { PasswordPrompt } from "./components/PasswordPrompt";
import { HomeView } from "./components/HomeView";
import { SettingsPanel } from "./components/SettingsPanel";
import { ToastContainer } from "./components/Toast";
import { useSavedConnections } from "./hooks/useSavedConnections";
import { useUiState } from "./hooks/useUiState";
import { useKeybindings } from "./hooks/useKeybindings";
import { useToast } from "./hooks/useToast";
import type { ConnectionInfo, TableInfo, SavedConnection } from "./types/db";
import "./App.css";

interface ActiveConn {
  activeId: string;
  name: string;
  engine: string;
}

interface NavTable { table: TableInfo; v: number }
interface OpenScript { sql: string; name: string; id: string; v: number }

export interface ToastCtx {
  info: (msg: string) => void;
  error: (msg: string) => void;
}

export const ToastContext = createContext<ToastCtx>({ info: () => {}, error: () => {} });

function App() {
  const { connections } = useSavedConnections();
  const { state: uiState } = useUiState();
  const [active, setActive] = useState<ActiveConn | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const { toasts, info, error, remove } = useToast();

  const [navigateTo, setNavigateTo] = useState<NavTable | null>(null);
  const [openScript, setOpenScript] = useState<OpenScript | null>(null);
  const [editingConn, setEditingConn] = useState<SavedConnection | null>(null);
  const [showNewConnection, setShowNewConnection] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [passwordPrompt, setPasswordPrompt] = useState<{ savedId: string; name: string } | null>(null);

  // Monaco fires this when Ctrl+P is pressed inside the editor
  useEffect(() => {
    const handler = () => setPaletteOpen(true);
    window.addEventListener("dib:open-palette", handler);
    return () => window.removeEventListener("dib:open-palette", handler);
  }, []);

  useKeybindings([
    { combo: "ctrl+p", handler: () => setPaletteOpen((p) => !p) },
    { combo: "ctrl+k", handler: () => setPaletteOpen((p) => !p) },
    {
      combo: "ctrl+1",
      handler: () => (document.getElementById("dib-sidebar-nav") as HTMLElement | null)?.focus(),
      allowInMonaco: true,
    },
    {
      combo: "ctrl+2",
      handler: () => (document.getElementById("dib-main-panel") as HTMLElement | null)?.focus(),
      allowInMonaco: true,
    },
    {
      combo: "ctrl+r",
      handler: () => window.dispatchEvent(new CustomEvent("dib:reload")),
      allowInMonaco: true,
    },
    {
      combo: "ctrl+shift+r",
      handler: () => window.location.reload(),
      allowInMonaco: true,
    },
  ]);

  const handleConnectionSelect = useCallback(
    async (savedId: string, password?: string) => {
      setConnecting(true);
      try {
        const info = await invoke<ConnectionInfo>("connect_saved", {
          savedId,
          password: password ?? null,
          savePassword: uiState.save_password,
        });
        const saved = connections.find((c) => c.id === savedId);
        setActive({
          activeId: info.id,
          name: saved?.name || info.config.database || info.config.path || info.id,
          engine: info.config.db_type,
        });
      } catch (e: unknown) {
        const err = e as { code?: string; message?: string };
        if (err?.code === "PASSWORD_REQUIRED") {
          const saved = connections.find((c) => c.id === savedId);
          setPasswordPrompt({ savedId, name: saved?.name || savedId });
        } else {
          const msg = err?.message || String(e);
          error(msg);
        }
      } finally {
        setConnecting(false);
      }
    },
    [connections, uiState.save_password, error],
  );

  const handleNewConnection = useCallback((info: ConnectionInfo) => {
    setActive({
      activeId: info.id,
      name: info.config.database || info.config.path || info.id,
      engine: info.config.db_type,
    });
    setShowNewConnection(false);
  }, []);

  const handleDisconnect = useCallback(async () => {
    if (active) {
      await invoke("disconnect", { connectionId: active.activeId }).catch(() => {});
    }
    setActive(null);
    setNavigateTo(null);
    setOpenScript(null);
  }, [active]);

  const handleTableSelect = useCallback((table: TableInfo) => {
    setNavigateTo({ table, v: Date.now() });
  }, []);

  const handleScriptOpen = useCallback((sql: string, name: string, id?: string) => {
    setOpenScript({ sql, name, id: id ?? `ext-${Date.now()}`, v: Date.now() });
  }, []);

  const handleEditConnection = useCallback((conn: SavedConnection) => {
    setEditingConn(conn);
  }, []);

  const handleDatabaseSwitch = useCallback(async (dbName: string) => {
    if (!active) return;
    try {
      await invoke("switch_database", { connectionId: active.activeId, dbName });
      setActive((prev) => prev ? { ...prev, name: dbName } : prev);
      window.dispatchEvent(new CustomEvent("dib:reload"));
      info(`Conectado a "${dbName}"`);
    } catch (e: unknown) {
      const msg = e && typeof e === "object" && "message" in e ? String((e as { message: unknown }).message) : String(e);
      error(msg);
    }
  }, [active, info, error]);

  const handlePasswordSubmit = useCallback(
    (password: string) => {
      const prompt = passwordPrompt;
      setPasswordPrompt(null);
      if (prompt) handleConnectionSelect(prompt.savedId, password);
    },
    [passwordPrompt, handleConnectionSelect],
  );

  const handlePasswordCancel = useCallback(() => {
    setPasswordPrompt(null);
  }, []);

  return (
    <ToastContext.Provider value={{ info, error }}>
    <Layout
      activeConnectionId={active?.activeId ?? null}
      onConnectionSelect={handleConnectionSelect}
      onEditConnection={handleEditConnection}
      onSettingsOpen={() => setSettingsOpen(true)}
    >
      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        connectionId={active?.activeId ?? null}
        onTableSelect={handleTableSelect}
        onScriptOpen={handleScriptOpen}
        onDatabaseSwitch={handleDatabaseSwitch}
        actions={[
          ...(active ? [{ id: "disconnect", label: "Desconectar", onAction: handleDisconnect }] : []),
          { id: "new-connection", label: "Nueva Conexión", onAction: () => { setPaletteOpen(false); setShowNewConnection(true); } },
        ]}
      />

      {connecting && <div className="app-connecting">Connecting…</div>}

      {editingConn ? (
        <div className="app-container">
          <ConnectionManager
            editing={editingConn}
            onEditSaved={() => setEditingConn(null)}
          />
        </div>
      ) : showNewConnection ? (
        <div className="app-container">
          <ConnectionManager
            onConnected={handleNewConnection}
          />
          <button className="app-back-btn" onClick={() => setShowNewConnection(false)}>
            Back
          </button>
        </div>
      ) : !connecting && active ? (
        <QueryPanel
          connectionId={active.activeId}
          connectionName={active.name}
          engine={active.engine}
          onDisconnect={handleDisconnect}
          navigateTo={navigateTo}
          openScript={openScript}
        />
      ) : (
        !connecting && (
          <HomeView
            onConnectionSelect={handleConnectionSelect}
            onNewConnection={() => setShowNewConnection(true)}
          />
        )
      )}
    </Layout>
      {passwordPrompt && (
        <PasswordPrompt
          connectionName={passwordPrompt.name}
          onSubmit={handlePasswordSubmit}
          onCancel={handlePasswordCancel}
        />
      )}
      <SettingsPanel
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
      />
      <ToastContainer toasts={toasts} onDismiss={remove} />
    </ToastContext.Provider>
  );
}

export default App;
