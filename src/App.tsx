import { useState, useCallback, createContext, useEffect } from "react";
import { Layout } from "@/components/Layout";
import { MainContent } from "@/components/MainContent";
import { CommandPalette } from "@/components/CommandPalette";
import { PasswordPrompt } from "@/components/PasswordPrompt";
import { SettingsPanel } from "@/components/SettingsPanel";
import { ToastContainer } from "@/components/Toast";
import { KeyboardCheatSheet } from "@/components/KeyboardCheatSheet";
import { DangerConfirmDialog } from "@/components/DangerConfirmDialog";
import { useSavedConnections } from "@/hooks/useSavedConnections";
import { useUiState } from "@/hooks/useUiState";
import { useToast } from "@/hooks/useToast";
import { useConnectionManager } from "@/hooks/useConnectionManager";
import { useAppKeybindings } from "@/hooks/useAppKeybindings";
import { useDangerDialog } from "@/hooks/useDangerDialog";
import { DDL_TEMPLATE } from "@/constants/ddlTemplates";
import type { TableInfo, SavedConnection } from "@/types/db";
import type { NavTable, OpenScript } from "@/types/workspace";
import "./App.css";

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
  const { toasts, info, error, warn, remove } = useToast();

  const {
    active, connecting, passwordPrompt,
    handleConnectionSelect, handleNewConnection, handleDisconnect,
    handleDatabaseSwitch, handlePasswordSubmit, handlePasswordCancel,
  } = useConnectionManager({ connections, savePassword: uiState.save_password, onError: error, onInfo: info });

  const [paletteOpen, setPaletteOpen]           = useState(false);
  const [navigateTo, setNavigateTo]              = useState<NavTable | null>(null);
  const [openScript, setOpenScript]              = useState<OpenScript | null>(null);
  const [editingConn, setEditingConn]            = useState<SavedConnection | null>(null);
  const [showNewConnection, setShowNewConnection] = useState(false);
  const [settingsOpen, setSettingsOpen]          = useState(false);
  const [cheatSheetOpen, setCheatSheetOpen]      = useState(false);

  const { dangerDialog, handleDropTable, clearDangerDialog } =
    useDangerDialog(active?.activeId ?? null, info, error);

  const handleTogglePalette    = useCallback(() => setPaletteOpen((p) => !p), []);
  const handleToggleCheatSheet = useCallback(() => setCheatSheetOpen((v) => !v), []);
  const handleBackendError     = useCallback((cmd: string, msg: string) => {
    error(`Backend no disponible — ${cmd}: ${msg}. Reinicia la aplicación si persiste.`);
  }, [error]);

  useAppKeybindings({
    isConnected: !!active,
    onTogglePalette: handleTogglePalette,
    onToggleCheatSheet: handleToggleCheatSheet,
    onBackendError: handleBackendError,
  });

  useEffect(() => {
    if (!active) { setNavigateTo(null); setOpenScript(null); }
  }, [active]);

  const handleTableSelect    = useCallback((table: TableInfo) => setNavigateTo({ table, v: Date.now() }), []);
  const handleScriptOpen     = useCallback((sql: string, name: string, id?: string) =>
    setOpenScript({ sql, name, id: id ?? `ext-${Date.now()}`, v: Date.now() }), []);
  const handleEditConnection = useCallback((conn: SavedConnection) => setEditingConn(conn), []);

  const paletteActions = [
    ...(active ? [
      { id: "disconnect",          label: "Desconectar",       onAction: handleDisconnect },
      { id: "nueva-plantilla-ddl", label: "Nueva Plantilla DDL", onAction: () => { setPaletteOpen(false); handleScriptOpen(DDL_TEMPLATE, "Nueva Plantilla DDL.sql"); } },
    ] : []),
    { id: "new-connection", label: "Nueva Conexión",              onAction: () => { setPaletteOpen(false); setShowNewConnection(true); } },
    { id: "cheat-sheet",    label: "Atajos de teclado (Ctrl+/)", onAction: () => { setPaletteOpen(false); setCheatSheetOpen(true); } },
  ];

  const toast = { info, error, warn };

  return (
    <ToastContext.Provider value={toast}>
      <Layout
        activeConnectionId={active?.savedId ?? null}
        activeSessionId={active?.activeId ?? null}
        onConnectionSelect={handleConnectionSelect}
        connectionName={active?.name}
        onScriptOpen={handleScriptOpen}
        onTableSelect={handleTableSelect}
        onDatabaseSwitch={handleDatabaseSwitch}
        onDisconnect={handleDisconnect}
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
          actions={paletteActions}
        />
        {connecting && <div className="app-connecting">Connecting…</div>}
        <MainContent
          editingConn={editingConn}
          showNewConnection={showNewConnection}
          connecting={connecting}
          active={active}
          navigateTo={navigateTo}
          openScript={openScript}
          onEditSaved={() => setEditingConn(null)}
          onConnected={(connInfo) => { handleNewConnection(connInfo); setShowNewConnection(false); }}
          onBack={() => setShowNewConnection(false)}
          onConnectionSelect={handleConnectionSelect}
          onNewConnection={() => setShowNewConnection(true)}
        />
      </Layout>
      {passwordPrompt && (
        <PasswordPrompt
          connectionName={passwordPrompt.name}
          onSubmit={handlePasswordSubmit}
          onCancel={handlePasswordCancel}
        />
      )}
      <SettingsPanel open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      {cheatSheetOpen && <KeyboardCheatSheet onClose={() => setCheatSheetOpen(false)} />}
      {dangerDialog && (
        <DangerConfirmDialog
          message={dangerDialog.message}
          onConfirm={dangerDialog.onConfirm}
          onCancel={clearDangerDialog}
        />
      )}
      <ToastContainer toasts={toasts} onDismiss={remove} />
    </ToastContext.Provider>
  );
}

export default App;
