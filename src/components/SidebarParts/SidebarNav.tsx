import { useState, useEffect, useCallback, useMemo } from "react";
import { workspaceService } from "../../services/workspaceService";
import { ConnectionItem } from "./ConnectionItem";
import { ScriptItem } from "./ScriptItem";
import { QueryHistoryPanel } from "./QueryHistoryPanel";
import { DatabaseCategories } from "./DatabaseCategories";
import type { InternalScript, SavedConnection } from "../../types/db";

interface SidebarNavProps {
  activeView: "connections" | "scripts" | "history" | "database";
  activeSessionId?: string | null;
  connections: SavedConnection[];
  scripts: InternalScript[];
  scriptsLoading: boolean;
  activeConnectionId?: string | null;
  onConnectionSelect?: (savedId: string) => void;
  onScriptOpen?: (sql: string, title: string, id: string) => void;
  onRefreshScripts: () => void;
  onDeleteConnection: (conn: SavedConnection) => void;
  onUndoDelete: () => void;
  undoStack: SavedConnection[];
  onContextMenu?: (e: React.MouseEvent, connId: string) => void;
}

type NavItem =
  | { kind: "conn"; data: SavedConnection }
  | { kind: "script"; data: InternalScript };

export function SidebarNav({
  activeView,
  activeSessionId,
  connections,
  scripts,
  scriptsLoading,
  activeConnectionId,
  onConnectionSelect,
  onScriptOpen,
  onRefreshScripts,
  onDeleteConnection,
  onUndoDelete,
  undoStack,
  onContextMenu,
}: SidebarNavProps) {
  const [selectedIdx, setSelectedIdx] = useState(-1);

  const navItems = useMemo((): NavItem[] => {
    const items: NavItem[] = [];
    if (activeView === "connections") {
      for (const c of connections) items.push({ kind: "conn", data: c });
    } else {
      for (const s of scripts) items.push({ kind: "script", data: s });
    }
    return items;
  }, [connections, scripts, activeView]);

  useEffect(() => {
    if (selectedIdx >= navItems.length) {
      setSelectedIdx(Math.max(-1, navItems.length - 1));
    }
  }, [navItems.length, selectedIdx]);

  const handleConnectionSelect = useCallback((navIdx: number, connId: string) => {
    setSelectedIdx(navIdx);
    onConnectionSelect?.(connId);
  }, [onConnectionSelect]);

  const handleScriptSelect = useCallback((navIdx: number, script: InternalScript) => {
    setSelectedIdx(navIdx);
    onScriptOpen?.(script.content, script.title, script.id);
  }, [onScriptOpen]);

  const handleConnectionRename = useCallback((_connId: string, _newName: string) => {
    // Rename is handled by the parent component
  }, []);

  const handleContextMenu = useCallback((e: React.MouseEvent, connId: string) => {
    onContextMenu?.(e, connId);
  }, [onContextMenu]);

  const handleNavKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const n = navItems.length;

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setSelectedIdx((i) => (n > 0 ? Math.min(n - 1, i < 0 ? 0 : i + 1) : -1));
          break;
        case "ArrowUp":
          e.preventDefault();
          setSelectedIdx((i) => (n > 0 ? Math.max(0, i - 1) : -1));
          break;
        case "Enter": {
          e.preventDefault();
          const item = navItems[selectedIdx];
          if (!item) break;
          if (item.kind === "conn") onConnectionSelect?.(item.data.id);
          else onScriptOpen?.(item.data.content, item.data.title, item.data.id);
          break;
        }
        case "Delete":
        case "Backspace": {
          e.preventDefault();
          const item = navItems[selectedIdx];
          if (item?.kind === "conn") onDeleteConnection(item.data);
          else if (item?.kind === "script") {
            workspaceService.deleteInternalScript(item.data.id)
              .then(() => onRefreshScripts())
              .catch(console.error);
          }
          break;
        }
        case "F2": {
          e.preventDefault();
          const item = navItems[selectedIdx];
          if (item?.kind === "conn") {
            // F2 rename is handled by ConnectionItem
          }
          break;
        }
        case "z":
        case "Z":
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            onUndoDelete();
          }
          break;
        case "Escape":
          e.preventDefault();
          setSelectedIdx(-1);
          break;
      }
    },
    [navItems, selectedIdx, onConnectionSelect, onScriptOpen, onDeleteConnection, onUndoDelete, onRefreshScripts],
  );

  return (
    <>
      <nav
        id="dib-sidebar-nav"
        className="sidebar-nav"
        tabIndex={0}
        onKeyDown={handleNavKeyDown}
        onFocus={() => { if (selectedIdx < 0 && navItems.length > 0) setSelectedIdx(0); }}
        aria-label="Sidebar navigation"
      >
        <div className="sidebar-section">
          {activeView === "database" ? (
            <DatabaseCategories sessionId={activeSessionId} />
          ) : activeView === "connections" ? (
            <>
              {connections.length === 0 ? (
                <div className="sidebar-item sidebar-item--empty">
                  <span className="sidebar-item-text sidebar-item-text--muted">No connections yet</span>
                </div>
              ) : (
                connections.map((conn) => {
                  const navIdx = navItems.findIndex((x) => x.kind === "conn" && x.data.id === conn.id);
                  const isKeySelected = navIdx !== -1 && navIdx === selectedIdx;
                  const isActive = conn.id === activeConnectionId;

                  return (
                    <ConnectionItem
                      key={conn.id}
                      conn={conn}
                      isSelected={isKeySelected}
                      isActive={isActive}
                      navIdx={navIdx}
                      onSelect={handleConnectionSelect}
                      onContextMenu={handleContextMenu}
                      onRename={handleConnectionRename}
                      onDelete={onDeleteConnection}
                    />
                  );
                })
              )}
            </>
          ) : activeView === "history" ? (
            <QueryHistoryPanel
              activeConnectionId={activeConnectionId}
              onScriptOpen={onScriptOpen}
            />
          ) : (
            <>
              {scriptsLoading ? (
                <div className="sidebar-item sidebar-item--empty">
                  <span className="sidebar-item-text sidebar-item-text--muted">Loading…</span>
                </div>
              ) : scripts.length === 0 ? (
                <div className="sidebar-item sidebar-item--empty">
                  <span className="sidebar-item-text sidebar-item-text--muted">No scripts found</span>
                </div>
              ) : (
                scripts.map((script) => {
                  const navIdx = navItems.findIndex((x) => x.kind === "script" && x.data.id === script.id);
                  const isKeySelected = navIdx !== -1 && navIdx === selectedIdx;

                  return (
                    <ScriptItem
                      key={script.id}
                      script={script}
                      isSelected={isKeySelected}
                      navIdx={navIdx}
                      onSelect={handleScriptSelect}
                      onRefreshScripts={onRefreshScripts}
                    />
                  );
                })
              )}
            </>
          )}
        </div>

        {/* Undo hint */}
        {undoStack.length > 0 && (
          <div className="sidebar-undo-hint">
            Ctrl+Z para deshacer · eliminaste {undoStack[undoStack.length - 1]?.name}
          </div>
        )}
      </nav>
    </>
  );
}