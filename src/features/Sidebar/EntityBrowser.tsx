import { useCallback } from "react";
import { Database } from "lucide-react";
import { safeInvoke as invoke } from "@/shared/utils/ipc";
import { useSavedConnections } from "@/shared/hooks/useSavedConnections";
import { useConnectionStore } from "@/store/connectionStore";
import { useWorkspaceStore } from "@/store/workspaceStore";
import { useUiStore } from "@/store/uiStore";
import { useSettingsStore } from "@/store/settingsStore";
import { useToastStore } from "@/store/toastStore";
import { ConnectionItem, DatabaseTree } from "./Parts";
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
  connectionsOnly?: boolean;
}

export function EntityBrowser({ onScriptOpen, onDeleteTarget, connectionsOnly }: EntityBrowserProps) {
  const workspaceLayout = useSettingsStore((s) => s.workspaceLayout);
  const isAdvance = workspaceLayout === "advance";
  const { connections } = useSavedConnections();
  const active = useConnectionStore((s) => s.active);
  const selectConnection = useConnectionStore((s) => s.selectConnection);
  const switchDatabase = useConnectionStore((s) => s.switchDatabase);
  const activeConnectionId = active?.savedId ?? null;
  const activeSessionId = active?.activeId ?? null;
  const activeDb = active?.name;
  const activeWorkspacePath = useWorkspaceStore((s) => s.activeWorkspacePath);
  const setNavigateTo = useWorkspaceStore((s) => s.setNavigateTo);
  const openTableStructure = useWorkspaceStore((s) => s.openTableStructure);
  const setDbAction = useUiStore((s) => s.setDbAction);
  const setEditingConn = useUiStore((s) => s.setEditingConn);

  const onTableSelect = useCallback((table: TableInfo) => setNavigateTo({ table, v: Date.now() } as any), [setNavigateTo]);
  const onEditConnection = useCallback((conn: SavedConnection) => setEditingConn(conn), [setEditingConn]);
  const onDbAction = useCallback((action: DbActionType, dbName?: string) => setDbAction({ action, dbName }), [setDbAction]);

  const handleNodeClick = useCallback(async (node: DbTreeNode) => {
    if (!activeSessionId) return;
    const ti = parseNodeInfo(node);

    switch (node.type) {
      case "table":
      case "foreign_table":
      case "matview":
        setNavigateTo({ table: ti, v: Date.now() } as any);
        break;
      case "sequence":
        setNavigateTo({ table: ti, v: Date.now() } as any);
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
          openTableStructure(ti);
        }
        break;
      }
    }
  }, [activeSessionId, setNavigateTo, onScriptOpen, openTableStructure]);

  if (connectionsOnly) {
    return (
      <nav className="sidebar-nav dg-scroll" aria-label="Instances">
        <div className="sidebar-section-block">
          <div className="sidebar-section-header">
            <Database size={13} />
            <span>Standalone</span>
          </div>
          {connections.length === 0 ? (
            <div className="sidebar-item sidebar-item--empty">
              <span className="sidebar-item-text sidebar-item-text--muted">No connections</span>
            </div>
          ) : (
            connections.map((conn) => (
              <ConnectionItem
                key={conn.id}
                conn={conn}
                isSelected={false}
                isActive={conn.id === activeConnectionId}
                navIdx={-1}
                sessionId={conn.id === activeConnectionId ? activeSessionId : null}
                activeDb={conn.id === activeConnectionId ? activeDb : undefined}
                onSelect={(_navIdx, connId) => selectConnection(connId)}
                onDbSwitch={switchDatabase}
                onEdit={onEditConnection}
                onDelete={onDeleteTarget ?? (() => {})}
                onNewQuery={conn.id === activeConnectionId ? () => onScriptOpen?.("", "New Query", `new-${Date.now()}`) : undefined}
                onCreateDatabase={conn.id === activeConnectionId && activeSessionId ? () => onDbAction("create") : undefined}
                onRenameDb={conn.id === activeConnectionId ? (db) => onDbAction("rename", db) : undefined}
                onDropDb={conn.id === activeConnectionId ? (db) => onDbAction("drop", db) : undefined}
              />
            ))
          )}
        </div>
      </nav>
    );
  }

  if (isAdvance) {
    return (
      <nav className="sidebar-nav dg-scroll" aria-label="Entities">
        <DatabaseTree onNodeClick={handleNodeClick} />
      </nav>
    );
  }

  return (
    <nav className="sidebar-nav dg-scroll" aria-label="Explorer">
      <div className="sidebar-section-block">
        <div className="sidebar-section-header">
          <Database size={13} />
          <span>Instances</span>
        </div>
        {connections.length === 0 ? (
          <div className="sidebar-item sidebar-item--empty">
            <span className="sidebar-item-text sidebar-item-text--muted">No connections</span>
          </div>
        ) : (
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
              onNewQuery={!activeWorkspacePath && conn.id === activeConnectionId ? () => onScriptOpen?.("", "New Query", `new-${Date.now()}`) : undefined}
              onCreateDatabase={conn.id === activeConnectionId && activeSessionId ? () => onDbAction("create") : undefined}
              onRenameDb={conn.id === activeConnectionId ? (db) => onDbAction("rename", db) : undefined}
              onDropDb={conn.id === activeConnectionId ? (db) => onDbAction("drop", db) : undefined}
              onTableSelect={onTableSelect}
              onScriptOpen={onScriptOpen}
            />
          ))
        )}
      </div>
    </nav>
  );
}
