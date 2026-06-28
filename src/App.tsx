import { useState, useCallback, createContext, useEffect } from "react";
import { Layout } from "@/components/Layout";
import { MainContent } from "@/components/MainContent";
import { CommandPalette } from "@/components/CommandPalette";
import { PasswordPrompt } from "@/components/PasswordPrompt";
import { SettingsPanel } from "@/components/SettingsPanel";
import { ToastContainer } from "@/components/Toast";
import { KeyboardCheatSheet } from "@/components/KeyboardCheatSheet";
import { DangerConfirmDialog } from "@/components/DangerConfirmDialog";
import { RenameDialog } from "@/components/RenameDialog";
import { DbActionDialog } from "@/components/DbActionDialog";
import { SchemaChangeWizard } from "@/features/SchemaChangeWizard/SchemaChangeWizard";
import { useSavedConnections } from "@/hooks/useSavedConnections";
import { useUiState } from "@/hooks/useUiState";
import { useToast } from "@/hooks/useToast";
import { useConnectionManager } from "@/hooks/useConnectionManager";
import { useAppKeybindings } from "@/hooks/useAppKeybindings";
import { useDangerDialog } from "@/hooks/useDangerDialog";
import { DDL_TEMPLATE } from "@/constants/ddlTemplates";
import { useUiStore } from "@/store/uiStore";
import { useWorkspaceStore } from "@/store/workspaceStore";
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

  // UI state from stores
  const paletteOpen     = useUiStore((s) => s.paletteOpen);
  const settingsOpen    = useUiStore((s) => s.settingsOpen);
  const cheatSheetOpen  = useUiStore((s) => s.cheatSheetOpen);
  const showNewConnection = useUiStore((s) => s.showNewConnection);
  const editingConn     = useUiStore((s) => s.editingConn);
  const { togglePalette, setSettingsOpen, setCheatSheetOpen, setShowNewConnection, setEditingConn } = useUiStore.getState();

  const navigateTo  = useWorkspaceStore((s) => s.navigateTo);
  const openScript  = useWorkspaceStore((s) => s.openScript);
  const { setNavigateTo, setOpenScript } = useWorkspaceStore.getState();

  const { dangerDialog, handleDropTable, handleTruncateTable, clearDangerDialog } =
    useDangerDialog(active?.activeId ?? null, info, error);

  const handleTogglePalette    = useCallback(() => togglePalette(), [togglePalette]);
  const handleToggleCheatSheet = useCallback(() => setCheatSheetOpen(!cheatSheetOpen), [cheatSheetOpen, setCheatSheetOpen]);
  const handleBackendError     = useCallback((cmd: string, msg: string) => {
    error(`Backend unavailable — ${cmd}: ${msg}. Restart the app if it persists.`);
  }, [error]);

  useAppKeybindings({
    isConnected: !!active,
    onTogglePalette: handleTogglePalette,
    onToggleCheatSheet: handleToggleCheatSheet,
    onBackendError: handleBackendError,
  });

  useEffect(() => {
    if (!active) { setNavigateTo(null); setOpenScript(null); }
  }, [active, setNavigateTo, setOpenScript]);

  const handleTableSelect = useCallback(
    (table: TableInfo) => setNavigateTo({ table, v: Date.now() } as NavTable),
    [setNavigateTo],
  );
  const handleScriptOpen = useCallback(
    (sql: string, name: string, id?: string) =>
      setOpenScript({ sql, name, id: id ?? `ext-${Date.now()}`, v: Date.now() } as OpenScript),
    [setOpenScript],
  );
  const handleEditConnection = useCallback(
    (conn: SavedConnection) => setEditingConn(conn),
    [setEditingConn],
  );

  const [renameTarget, setRenameTarget] = useState<TableInfo | null>(null);
  const [alterTarget, setAlterTarget] = useState<TableInfo | null>(null);
  const [dbAction, setDbAction] = useState<"create" | "rename" | "drop" | null>(null);

  const handleRenameTable = useCallback((table: TableInfo) => {
    setRenameTarget(table);
    togglePalette();
  }, [togglePalette]);

  const handleAlterTable = useCallback((table: TableInfo) => {
    setAlterTarget(table);
    togglePalette();
  }, [togglePalette]);

  const handleDbAction = useCallback((action: "create" | "rename" | "drop") => {
    togglePalette();
    setDbAction(action);
  }, [togglePalette]);

  const paletteActions = [
    ...(active ? [
      { id: "disconnect",          label: "Disconnect",       onAction: handleDisconnect },
      { id: "ddl-template",        label: "New DDL Template", onAction: () => { togglePalette(); handleScriptOpen(DDL_TEMPLATE, "New DDL Template.sql"); } },
      { id: "create-db",           label: "Create Database…", onAction: () => handleDbAction("create") },
      { id: "rename-db",           label: "Rename Database…", onAction: () => handleDbAction("rename") },
      { id: "drop-db",             label: "Delete Database…", onAction: () => handleDbAction("drop") },
    ] : []),
    { id: "new-connection", label: "New Connection",              onAction: () => { togglePalette(); setShowNewConnection(true); } },
    { id: "cheat-sheet",    label: "Keyboard Shortcuts (Ctrl+/)", onAction: () => { togglePalette(); setCheatSheetOpen(true); } },
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
        onDbAction={handleDbAction}
      >
        <CommandPalette
          open={paletteOpen}
          onClose={() => togglePalette()}
          connectionId={active?.activeId ?? null}
          onTableSelect={handleTableSelect}
          onScriptOpen={handleScriptOpen}
          onDatabaseSwitch={handleDatabaseSwitch}
          onDropTable={handleDropTable}
          onTruncateTable={handleTruncateTable}
          onRenameTable={handleRenameTable}
          onAlterTable={handleAlterTable}
          onDbAction={handleDbAction}
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
      {renameTarget && active?.activeId && (
        <RenameDialog
          connectionId={active.activeId}
          entityType="table"
          entityName={renameTarget.name}
          schema={renameTarget.schema}
          onClose={() => setRenameTarget(null)}
        />
      )}
      {dbAction && active?.activeId && (
        <DbActionDialog
          action={dbAction}
          connectionId={active.activeId}
          onClose={() => setDbAction(null)}
        />
      )}
      {alterTarget && active?.activeId && (
        <SchemaChangeWizard
          connectionId={active.activeId}
          tableName={alterTarget.name}
          schema={alterTarget.schema}
          onClose={() => setAlterTarget(null)}
        />
      )}
      <ToastContainer toasts={toasts} onDismiss={remove} />
    </ToastContext.Provider>
  );
}

export default App;
