import { useCallback } from "react";
import { Server, Plus } from "lucide-react";
import { safeInvoke as invoke } from "@/shared/utils/ipc";
import { useSavedConnections } from "@/shared/hooks/useSavedConnections";
import { useConnectionStore } from "@/store/connectionStore";
import { useWorkspaceStore } from "@/store/workspaceStore";
import { useUiStore } from "@/store/uiStore";
import { useSettingsStore } from "@/store/settingsStore";
import { useToastStore } from "@/store/toastStore";
import { Tooltip } from "@/shared/ui/Tooltip";
import { ConnectionItem, DatabaseTree } from "./Parts";
import { confirmToggleConnectionReadonly } from "@/shared/utils/toggleConnectionReadonly";
import { openDatabaseObject, openTableObject, tableObjectRef } from "@/shared/exploration";
import type { SavedConnection, TableInfo, DbTreeNode } from "@/types/db";

type DbActionType = "create" | "rename" | "drop";

/** Extract { name, schema } from a catalog node. Mirrors DatabaseTree.tableInfoFromNode. */
function parseNodeInfo(node: DbTreeNode): TableInfo {
  const prefix = `${node.type}_`;
  const raw = node.id.startsWith(prefix) ? node.id.slice(prefix.length) : node.id;
  const dot = raw.indexOf(".");
  if (dot !== -1) return { name: raw.slice(dot + 1), schema: raw.slice(0, dot) };
  return { name: raw, schema: null };
}

interface EntityBrowserProps {
  onScriptOpen?: (sql: string, name: string, id: string) => void;
  onDeleteTarget?: (conn: SavedConnection) => void;
}

export function EntityBrowser({ onScriptOpen, onDeleteTarget }: EntityBrowserProps) {
  const workspaceLayout = useSettingsStore((s) => s.workspaceLayout);
  const isAdvance = workspaceLayout === "advance";
  const { connections, save } = useSavedConnections();
  const active = useConnectionStore((s) => s.active);
  const selectConnection = useConnectionStore((s) => s.selectConnection);
  const switchDatabase = useConnectionStore((s) => s.switchDatabase);
  const activeConnectionId = active?.savedId ?? null;
  const activeSessionId = active?.activeId ?? null;
  const activeDb = active?.name;
  const activeWorkspacePath = useWorkspaceStore((s) => s.activeWorkspacePath);
  const setDbAction = useUiStore((s) => s.setDbAction);
  const setEditingConn = useUiStore((s) => s.setEditingConn);
  const setShowNewConnection = useUiStore((s) => s.setShowNewConnection);
  const connectionId = activeConnectionId ?? "";
  const database = activeDb ?? undefined;

  const onTableSelect = useCallback(
    (table: TableInfo) => openTableObject(connectionId, table, { database }),
    [connectionId, database],
  );
  const onEditConnection = useCallback((conn: SavedConnection) => setEditingConn(conn), [setEditingConn]);
  const onToggleReadonly = useCallback(
    (conn: SavedConnection) => confirmToggleConnectionReadonly(conn, save),
    [save],
  );
  const onDbAction = useCallback((action: DbActionType, dbName?: string) => setDbAction({ action, dbName }), [setDbAction]);
  const addInstance = useCallback(() => setShowNewConnection(true), [setShowNewConnection]);

  const handleNodeClick = useCallback(async (node: DbTreeNode) => {
    if (!activeSessionId) return;
    const ti = parseNodeInfo(node);

    switch (node.type) {
      case "table":
      case "foreign_table":
      case "sequence":
        openTableObject(connectionId, ti, { database });
        break;
      case "matview":
        openDatabaseObject(
          { ...tableObjectRef(connectionId, ti, database), objectType: "materialized_view" },
        );
        break;
      case "view": {
        try {
          const res = await invoke<{ ddl: string }>("get_view_ddl", {
            connectionId: activeSessionId,
            viewName: ti.name,
            schema: ti.schema,
          });
          onScriptOpen?.(res.ddl, ti.name, `ddl-view-${ti.name}-${Date.now()}`);
        } catch (e) {
          useToastStore.getState().error(String(e));
        }
        break;
      }
      case "function": {
        try {
          const res = await invoke<{ ddl: string }>("get_function_ddl", {
            connectionId: activeSessionId,
            functionName: ti.name,
            schema: ti.schema,
          });
          onScriptOpen?.(res.ddl, ti.name, `ddl-func-${ti.name}-${Date.now()}`);
        } catch (e) {
          useToastStore.getState().error(String(e));
        }
        break;
      }
      case "procedure": {
        try {
          const res = await invoke<{ ddl: string }>("get_function_ddl", {
            connectionId: activeSessionId,
            functionName: ti.name,
            schema: ti.schema,
          });
          onScriptOpen?.(res.ddl, ti.name, `ddl-proc-${ti.name}-${Date.now()}`);
        } catch (e) {
          useToastStore.getState().error(String(e));
        }
        break;
      }
      case "trigger": {
        try {
          const res = await invoke<{ ddl: string }>("get_trigger_ddl", {
            connectionId: activeSessionId,
            triggerName: ti.name,
            schema: ti.schema,
          });
          onScriptOpen?.(res.ddl, ti.name, `ddl-trig-${ti.name}-${Date.now()}`);
        } catch (e) {
          useToastStore.getState().error(String(e));
        }
        break;
      }
      case "index": {
        if (ti.schema || ti.name) {
          openTableObject(connectionId, ti, { database, mode: "structure" });
        }
        break;
      }
    }
  }, [activeSessionId, connectionId, database, onScriptOpen]);

  const instancesHeader = (
    <div className="sidebar-section-header">
      <Server size={13} />
      <span>Instances</span>
      <div style={{ marginLeft: "auto", display: "flex", gap: "4px" }}>
        <Tooltip content="Add instance to this scope" side="right">
          <button
            type="button"
            className="sidebar-section-header-action"
            onClick={addInstance}
          >
            <Plus />
          </button>
        </Tooltip>
      </div>
    </div>
  );

  const addInstanceRow = (
    <Tooltip content="Add instance to this scope" side="right">
      <button
        type="button"
        className="sidebar-item sidebar-item--add"
        onClick={addInstance}
      >
        <Plus size={14} />
        <Server size={12} />
        <span className="sidebar-item-text">Add instance</span>
      </button>
    </Tooltip>
  );

  if (isAdvance) {
    return (
      <nav className="sidebar-nav dg-scroll" aria-label="Entities">
        <div className="sidebar-section-block">
          {instancesHeader}
          {connections.length === 0 ? addInstanceRow : (
            <DatabaseTree onNodeClick={handleNodeClick} />
          )}
        </div>
      </nav>
    );
  }

  return (
    <nav className="sidebar-nav dg-scroll" aria-label="Explorer">
      <div className="sidebar-section-block">
        {instancesHeader}
        {connections.length === 0 ? addInstanceRow : (
          connections.map((conn) => (
            <ConnectionItem
              key={conn.id}
              conn={conn}
              compact
              showEntities
              isSelected={false}
              isActive={conn.id === activeConnectionId}
              navIdx={-1}
              sessionId={conn.id === activeConnectionId ? activeSessionId : null}
              activeDb={conn.id === activeConnectionId ? activeDb : undefined}
              onSelect={(_navIdx, connId) => selectConnection(connId)}
              onDbSwitch={switchDatabase}
              onEdit={onEditConnection}
              onDelete={onDeleteTarget ?? (() => {})}
              onToggleReadonly={onToggleReadonly}
              onNewQuery={!activeWorkspacePath && conn.id === activeConnectionId ? () => onScriptOpen?.("", "New Query", `new-${Date.now()}`) : undefined}
              onCreateDatabase={
                !conn.readonly && conn.id === activeConnectionId && activeSessionId
                  ? () => onDbAction("create")
                  : undefined
              }
              onRenameDb={
                !conn.readonly && conn.id === activeConnectionId
                  ? (db) => onDbAction("rename", db)
                  : undefined
              }
              onDropDb={
                !conn.readonly && conn.id === activeConnectionId
                  ? (db) => onDbAction("drop", db)
                  : undefined
              }
              onTableSelect={onTableSelect}
              onScriptOpen={onScriptOpen}
            />
          ))
        )}
      </div>
    </nav>
  );
}
