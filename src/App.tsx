import { useState, useCallback, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Layout } from "./components/Layout";
import { ConnectionManager } from "./components/ConnectionManager";
import { QueryPanel } from "./components/QueryPanel";
import { CommandPalette } from "./components/CommandPalette";
import { PasswordPrompt } from "./components/PasswordPrompt";
import { HomeView } from "./components/HomeView";
import { SettingsPanel } from "./components/SettingsPanel";
import { useSavedConnections } from "./hooks/useSavedConnections";
import { useUiState } from "./hooks/useUiState";
import type { ConnectionInfo, TableInfo, SavedConnection } from "./types/db";
import "./App.css";

interface ActiveConn {
  activeId: string;
  name: string;
  engine: string;
}

interface NavTable { table: TableInfo; v: number }
interface OpenScript { sql: string; name: string; v: number }

function App() {
  const { connections } = useSavedConnections();
  const { state: uiState } = useUiState();
  const [active, setActive] = useState<ActiveConn | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);

  const [navigateTo, setNavigateTo] = useState<NavTable | null>(null);
  const [openScript, setOpenScript] = useState<OpenScript | null>(null);
  const [editingConn, setEditingConn] = useState<SavedConnection | null>(null);
  const [showNewConnection, setShowNewConnection] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [passwordPrompt, setPasswordPrompt] = useState<{ savedId: string; name: string } | null>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === "p" || e.key === "k")) {
        e.preventDefault();
        setPaletteOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

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
          console.error("[DIB] connect_saved failed:", e);
        }
      } finally {
        setConnecting(false);
      }
    },
    [connections, uiState.save_password],
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

  const handleScriptOpen = useCallback((sql: string, name: string) => {
    setOpenScript({ sql, name, v: Date.now() });
  }, []);

  const handleEditConnection = useCallback((conn: SavedConnection) => {
    setEditingConn(conn);
  }, []);

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
    <>
    <Layout
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
    </>
  );
}

export default App;
