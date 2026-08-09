import { useCallback, useEffect, useRef } from "react";
import { Layout } from "@/app/Layout";
import { MainContent } from "@/app/MainContent";
import { CommandPalette } from "@/features/CommandPalette/CommandPalette";
import { PasswordPrompt } from "@/features/Connections/PasswordPrompt";
import { mod } from "@/shared/utils/platform";
import { useToastStore } from "@/store/toastStore";
import { useAppKeybindings } from "@/shared/hooks/useAppKeybindings";
import { useAutoUpdate } from "@/shared/hooks/useAutoUpdate";
import { DDL_TEMPLATE } from "@/constants/ddlTemplates";
import { useUiStore } from "@/store/uiStore";
import { useWorkspaceStore } from "@/store/workspaceStore";
import { useSettingsStore } from "@/store/settingsStore";
import { useConnectionStore } from "@/store/connectionStore";
import { workspaceService } from "@/services/workspaceService";
import { getLastConnection, getLastSessionScope, openWorkspaceAndConnect } from "@/shared/utils/quickConnect";
import { GlobalModals } from "@/app/providers/GlobalModals";
import type { OpenScript } from "@/types/workspace";
import { DDL_TEMPLATES } from "@/features/Sidebar/hooks/useDatabaseCategoriesLogic";
import "./App.css";

function App() {
  useAutoUpdate();
  const error = useToastStore((s) => s.error);
  const active = useConnectionStore((s) => s.active);
  const connecting = useConnectionStore((s) => s.connecting);
  const passwordPrompt = useConnectionStore((s) => s.passwordPrompt);
  const selectConnection = useConnectionStore((s) => s.selectConnection);
  const submitPassword = useConnectionStore((s) => s.submitPassword);
  const cancelPassword = useConnectionStore((s) => s.cancelPassword);

  // Startup auto-connect (opt-in setting): restore the last session scope —
  // workspace + its last connection, or the last global connection.
  const autoConnectOnStartup = useSettingsStore((s) => s.autoConnectOnStartup);
  const startupRanRef = useRef(false);
  useEffect(() => {
    if (startupRanRef.current || !autoConnectOnStartup) return;
    startupRanRef.current = true;
    const sessionScope = getLastSessionScope();
    if (!sessionScope) return;
    if (sessionScope === "__global__") {
      const connId = getLastConnection(null);
      if (connId) void selectConnection(connId);
    } else {
      workspaceService.getWorkspaces()
        .then((list) => {
          const ws = list.find((w) => w.id === sessionScope);
          if (ws) void openWorkspaceAndConnect(ws, selectConnection);
        })
        .catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoConnectOnStartup]);

  // UI state from stores
  const paletteOpen     = useUiStore((s) => s.paletteOpen);
  const cheatSheetOpen  = useUiStore((s) => s.cheatSheetOpen);
  const showNewConnection = useUiStore((s) => s.showNewConnection);
  const editingConn     = useUiStore((s) => s.editingConn);
  const { togglePalette, closePalette, setCheatSheetOpen, setShowNewConnection, setEditingConn, setDbAction, setSettingsOpen } = useUiStore.getState();

  const navigateTo  = useWorkspaceStore((s) => s.navigateTo);
  const openScript  = useWorkspaceStore((s) => s.openScript);
  const { setNavigateTo, setOpenScript } = useWorkspaceStore.getState();

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

  const handleCreateWorkspace = useCallback(async () => {
    try {
      const { open } = await import("@tauri-apps/plugin-dialog");
      const { workspaceService } = await import("@/services/workspaceService");
      const selectedPath = await open({ directory: true, multiple: false });
      if (!selectedPath || typeof selectedPath !== 'string') return;
      
      const folderName = selectedPath.split(/[/\\]/).pop() || "New Workspace";
      const name = prompt("Workspace Name:", folderName);
      if (!name) return;

      const ws = await workspaceService.createWorkspace(name, selectedPath);
      useWorkspaceStore.getState().setActiveWorkspacePath(ws.root_path, ws.id);
    } catch (e) {
      console.error(e);
      alert("Failed to create workspace: " + String(e));
    }
  }, []);

  const paletteActions = [
    ...(active ? [
      { id: "disconnect",          label: "Disconnect",       onAction: () => useConnectionStore.getState().disconnect() },
      { id: "ddl-template",        label: "New DDL Template", onAction: () => { closePalette(); setOpenScript({ sql: DDL_TEMPLATE, name: "New DDL Template.sql", id: `ext-${Date.now()}`, v: Date.now() } as OpenScript); } },
      { id: "create-db",           label: "Create Database…", onAction: () => setDbAction({ action: "create" }) },
      { id: "rename-db",           label: "Rename Database…", onAction: () => setDbAction({ action: "rename" }) },
      { id: "drop-db",             label: "Delete Database…", onAction: () => setDbAction({ action: "drop" }) },
      { id: "create-table",        label: "Create Table",     onAction: () => { closePalette(); setOpenScript({ sql: DDL_TEMPLATES.table, name: "New Table.sql", id: `ext-${Date.now()}`, v: Date.now() } as OpenScript); } },
      { id: "create-view",         label: "Create View",      onAction: () => { closePalette(); setOpenScript({ sql: DDL_TEMPLATES.view, name: "New View.sql", id: `ext-${Date.now()}`, v: Date.now() } as OpenScript); } },
      { id: "create-function",     label: "Create Function",  onAction: () => { closePalette(); setOpenScript({ sql: DDL_TEMPLATES.function, name: "New Function.sql", id: `ext-${Date.now()}`, v: Date.now() } as OpenScript); } },
      { id: "create-procedure",    label: "Create Procedure", onAction: () => { closePalette(); setOpenScript({ sql: DDL_TEMPLATES.procedure, name: "New Procedure.sql", id: `ext-${Date.now()}`, v: Date.now() } as OpenScript); } },
      { id: "create-trigger",      label: "Create Trigger",   onAction: () => { closePalette(); setOpenScript({ sql: DDL_TEMPLATES.trigger, name: "New Trigger.sql", id: `ext-${Date.now()}`, v: Date.now() } as OpenScript); } },
    ] : []),
    { id: "new-connection", label: "New Connection",              onAction: () => { closePalette(); setShowNewConnection(true); } },
    { id: "create-workspace", label: "Open Folder / Workspace...", onAction: () => { closePalette(); handleCreateWorkspace(); } },
    { id: "cheat-sheet",    label: `Keyboard Shortcuts (${mod("Ctrl+/")})`, onAction: () => { closePalette(); setCheatSheetOpen(true); } },
  ];

  return (
    <Layout
      onSettingsOpen={() => setSettingsOpen(true)}
    >
      <CommandPalette
        open={paletteOpen}
        onClose={() => closePalette()}
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
        onConnected={(connInfo) => { useConnectionStore.getState().applyNewConnection(connInfo); setShowNewConnection(false); }}
        onBack={() => setShowNewConnection(false)}
        onConnectionSelect={selectConnection}
        onNewConnection={() => setShowNewConnection(true)}
      />
      {passwordPrompt && (
        <PasswordPrompt
          connectionName={passwordPrompt.name}
          onSubmit={submitPassword}
          onCancel={cancelPassword}
        />
      )}
      <GlobalModals
        activeConnectionId={active?.activeId ?? null}
      />
    </Layout>
  );
}

export default App;
