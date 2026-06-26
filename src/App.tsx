import { useState, useCallback, createContext, useEffect } from "react";
import { connectionService } from "./services/connectionService";
import { dbService } from "./services/dbService";
import { Layout } from "./components/Layout";
import { ConnectionManager } from "./components/ConnectionManager";
import { QueryPanel } from "./components/QueryPanel";
import { CommandPalette } from "./components/CommandPalette";
import { PasswordPrompt } from "./components/PasswordPrompt";
import { HomeView } from "./components/HomeView";
import { SettingsPanel } from "./components/SettingsPanel";
import { ToastContainer } from "./components/Toast";
import { KeyboardCheatSheet } from "./components/KeyboardCheatSheet";
import { DangerConfirmDialog } from "./components/DangerConfirmDialog";
import { useSavedConnections } from "./hooks/useSavedConnections";
import { useUiState } from "./hooks/useUiState";
import { useKeybindings } from "./hooks/useKeybindings";
import { useToast } from "./hooks/useToast";
import type { ConnectionInfo, TableInfo, SavedConnection } from "./types/db";
import "./App.css";

interface ActiveConn {
  activeId: string;
  savedId: string;
  name: string;
  engine: string;
  dbVersion: number;
}

interface NavTable { table: TableInfo; v: number }
interface OpenScript { sql: string; name: string; id: string; v: number }

export interface ToastCtx {
  info: (msg: string) => void;
  error: (msg: string) => void;
  warn: (msg: string) => void;
}

// eslint-disable-next-line react-refresh/only-export-components
export const ToastContext = createContext<ToastCtx>({ info: () => {}, error: () => {}, warn: () => {} });

function App() {
  const { connections } = useSavedConnections();
  const { state: uiState } = useUiState();
  const [active, setActive] = useState<ActiveConn | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const { toasts, info, error, warn, remove } = useToast();

  const [navigateTo, setNavigateTo] = useState<NavTable | null>(null);
  const [openScript, setOpenScript] = useState<OpenScript | null>(null);
  const [editingConn, setEditingConn] = useState<SavedConnection | null>(null);
  const [showNewConnection, setShowNewConnection] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [cheatSheetOpen, setCheatSheetOpen] = useState(false);
  const [dangerDialog, setDangerDialog] = useState<{ message: string; onConfirm: () => void } | null>(null);
  const [passwordPrompt, setPasswordPrompt] = useState<{ savedId: string; name: string } | null>(null);

  useEffect(() => {
    const handler = () => { if (active) setPaletteOpen(true); };
    window.addEventListener("dib:open-palette", handler);
    return () => window.removeEventListener("dib:open-palette", handler);
  }, [active]);

  useKeybindings([
    { combo: "ctrl+p",       handler: () => { if (active) setPaletteOpen((p) => !p) } },
    { combo: "ctrl+shift+p", handler: () => { if (active) setPaletteOpen((p) => !p) } },
    { combo: "ctrl+k",       handler: () => { if (active) setPaletteOpen((p) => !p) } },
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
    {
      combo: "ctrl+/",
      handler: () => setCheatSheetOpen((v) => !v),
      allowInMonaco: true,
    },
  ]);

  const handleConnectionSelect = useCallback(
    async (savedId: string, password?: string) => {
      setConnecting(true);
      try {
        const connInfo = await connectionService.connectSaved(savedId, password ?? null, uiState.save_password);
        const saved = connections.find((c) => c.id === savedId);
        setActive({
          activeId: connInfo.id,
          savedId: savedId,
          name: saved?.name || connInfo.config.database || connInfo.config.path || connInfo.id,
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
          const msg = err?.message || String(e);
          error(msg);
        }
      } finally {
        setConnecting(false);
      }
    },
    [connections, uiState.save_password, error],
  );

  const handleNewConnection = useCallback((connInfo: ConnectionInfo) => {
    setActive({
      activeId: connInfo.id,
      savedId: connInfo.id,
      name: connInfo.config.database || connInfo.config.path || connInfo.id,
      engine: connInfo.config.db_type,
      dbVersion: 0,
    });
    setShowNewConnection(false);
  }, []);

  const handleDisconnect = useCallback(async () => {
    if (active) {
      await connectionService.disconnect(active.activeId).catch(() => {});
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
      await connectionService.switchDatabase(active.activeId, dbName);
      setActive((prev) => prev ? { ...prev, name: dbName, dbVersion: prev.dbVersion + 1 } : prev);
      window.dispatchEvent(new CustomEvent("dib:reload"));
      info(`Conectado a "${dbName}"`);
    } catch (e: unknown) {
      const msg = e && typeof e === "object" && "message" in e ? String((e as { message: unknown }).message) : String(e);
      error(msg);
    }
  }, [active, info, error]);

  const handleDropTable = useCallback((table: TableInfo) => {
    if (!active) return;
    const label = table.schema ? `${table.schema}.${table.name}` : table.name;
    const connId = active.activeId;
    setDangerDialog({
      message: `¿Eliminar tabla "${label}"? Esta acción no se puede deshacer.`,
      onConfirm: async () => {
        setDangerDialog(null);
        try {
          await dbService.dropTable(connId, table.name, table.schema ?? null);
          info(`Tabla "${label}" eliminada`);
          window.dispatchEvent(new CustomEvent("dib:reload"));
        } catch (e: unknown) {
          const msg = e && typeof e === "object" && "message" in e ? String((e as { message: unknown }).message) : String(e);
          error(msg);
        }
      },
    });
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
    <ToastContext.Provider value={{ info, error, warn }}>
    <Layout
      activeConnectionId={active?.savedId ?? null}
      activeSessionId={active?.activeId ?? null}
      onConnectionSelect={handleConnectionSelect}
      onScriptOpen={handleScriptOpen}
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
        onDropTable={handleDropTable}
        actions={[
          ...(active ? [
            { id: "disconnect", label: "Desconectar", onAction: handleDisconnect },
            {
              id: "nueva-plantilla-ddl",
              label: "Nueva Plantilla DDL",
              onAction: () => {
                setPaletteOpen(false);
                // Open a generic DDL boilerplate in a new SQL editor tab
                const ddlTemplate = [
                  "-- ╔══════════════════════════════════════════════════╗",
                  "-- ║         PLANTILLA DDL — Nueva Tabla             ║",
                  "-- ╚══════════════════════════════════════════════════╝",
                  "",
                  "-- Ajusta el nombre, columnas y restricciones según tu esquema.",
                  "",
                  "CREATE TABLE IF NOT EXISTS mi_tabla (",
                  "    id          BIGSERIAL      PRIMARY KEY,",
                  "    nombre      VARCHAR(255)   NOT NULL,",
                  "    descripcion TEXT,",
                  "    activo      BOOLEAN        NOT NULL DEFAULT TRUE,",
                  "    creado_en   TIMESTAMPTZ    NOT NULL DEFAULT NOW(),",
                  "    actualizado TIMESTAMPTZ    NOT NULL DEFAULT NOW()",
                  ");",
                  "",
                  "-- Índice en columnas de búsqueda frecuente",
                  "CREATE INDEX IF NOT EXISTS idx_mi_tabla_nombre",
                  "    ON mi_tabla (nombre);",
                  "",
                  "-- Trigger para actualizar 'actualizado' automáticamente",
                  "-- (requiere función update_timestamp() en tu schema)",
                  "-- CREATE TRIGGER trg_mi_tabla_updated",
                  "--     BEFORE UPDATE ON mi_tabla",
                  "--     FOR EACH ROW EXECUTE FUNCTION update_timestamp();",
                ].join("\n");
                handleScriptOpen(ddlTemplate, "Nueva Plantilla DDL.sql");
              },
            },
          ] : []),
          { id: "new-connection", label: "Nueva Conexión", onAction: () => { setPaletteOpen(false); setShowNewConnection(true); } },
          { id: "cheat-sheet", label: "Atajos de teclado (Ctrl+/)", onAction: () => { setPaletteOpen(false); setCheatSheetOpen(true); } },
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
          key={`${active.activeId}-${active.dbVersion}`}
          connectionId={active.activeId}
          connectionName={active.name}
          engine={active.engine}
          onDisconnect={handleDisconnect}
          navigateTo={navigateTo}
          openScript={openScript}
          onDatabaseSwitch={handleDatabaseSwitch}
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
      {cheatSheetOpen && <KeyboardCheatSheet onClose={() => setCheatSheetOpen(false)} />}
      {dangerDialog && (
        <DangerConfirmDialog
          message={dangerDialog.message}
          onConfirm={dangerDialog.onConfirm}
          onCancel={() => setDangerDialog(null)}
        />
      )}
      <ToastContainer toasts={toasts} onDismiss={remove} />
    </ToastContext.Provider>
  );
}

export default App;
