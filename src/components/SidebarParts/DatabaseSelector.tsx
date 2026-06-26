import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { ChevronDown, LogOut, Database as DbIcon } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { getEngineIcon, getDbName } from "./utils";
import type { SavedConnection } from "../../types/db";

interface DatabaseSelectorProps {
  connections: SavedConnection[];
  activeConnectionId?: string | null;
  activeSessionId?: string | null;
  connectionName?: string;
  onConnectionSelect?: (connId: string) => void;
  onDatabaseSwitch?: (dbName: string) => void;
  onDisconnect?: () => void;
}

type DropdownItem =
  | { type: "db"; value: string }
  | { type: "conn"; value: SavedConnection }
  | { type: "disconnect" };

export function DatabaseSelector({
  connections,
  activeConnectionId,
  activeSessionId,
  connectionName,
  onConnectionSelect,
  onDatabaseSwitch,
  onDisconnect,
}: DatabaseSelectorProps) {
  // ── All hooks unconditionally first ────────────────────────
  const [open, setOpen] = useState(false);
  const [databases, setDatabases] = useState<string[]>([]);
  const [dbsLoading, setDbsLoading] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const itemsRefs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    if (!activeSessionId) { setDatabases([]); return; }
    let cancelled = false;
    setDbsLoading(true);
    invoke<string[]>("list_databases", { connectionId: activeSessionId })
      .then((dbs) => { if (!cancelled) setDatabases(dbs); })
      .catch(() => { if (!cancelled) setDatabases([]); })
      .finally(() => { if (!cancelled) setDbsLoading(false); });
    return () => { cancelled = true; };
  }, [activeSessionId]);

  useEffect(() => {
    if (!activeSessionId) return;
    const reload = () => {
      invoke<string[]>("list_databases", { connectionId: activeSessionId })
        .then(setDatabases)
        .catch(() => {});
    };
    window.addEventListener("dib:reload", reload);
    return () => window.removeEventListener("dib:reload", reload);
  }, [activeSessionId]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  useEffect(() => { if (!open) setFocusedIndex(-1); }, [open]);

  useEffect(() => {
    if (open && focusedIndex >= 0) {
      itemsRefs.current[focusedIndex]?.scrollIntoView({ block: "nearest" });
    }
  }, [focusedIndex, open]);

  const activeConn = connections.find((c) => c.id === activeConnectionId);

  const otherConnections = useMemo(
    () => connections.filter((c) => c.id !== activeConnectionId),
    [connections, activeConnectionId],
  );

  const dropdownItems = useMemo((): DropdownItem[] => {
    const list: DropdownItem[] = [];
    if (databases.length > 1) databases.forEach((db) => list.push({ type: "db", value: db }));
    otherConnections.forEach((c) => list.push({ type: "conn", value: c }));
    if (onDisconnect) list.push({ type: "disconnect" });
    return list;
  }, [databases, otherConnections, onDisconnect]);

  const hasMultipleDbOrConns = databases.length > 1 || otherConnections.length > 0;

  const handleDbSwitch = useCallback((dbName: string) => {
    setOpen(false);
    if (dbName !== connectionName) onDatabaseSwitch?.(dbName);
  }, [connectionName, onDatabaseSwitch]);

  const handleConnSwitch = useCallback((connId: string) => {
    setOpen(false);
    if (connId !== activeConnectionId) onConnectionSelect?.(connId);
  }, [activeConnectionId, onConnectionSelect]);

  const handleDisconnect = useCallback(() => {
    setOpen(false);
    onDisconnect?.();
  }, [onDisconnect]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!hasMultipleDbOrConns) return;
    if (!open) {
      if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
        e.preventDefault();
        setOpen(true);
        if (e.key === "ArrowDown") setFocusedIndex(0);
      }
      return;
    }
    switch (e.key) {
      case "ArrowDown": e.preventDefault(); setFocusedIndex((i) => (i + 1) % dropdownItems.length); break;
      case "ArrowUp":   e.preventDefault(); setFocusedIndex((i) => (i - 1 + dropdownItems.length) % dropdownItems.length); break;
      case "Enter":
        e.preventDefault();
        if (focusedIndex >= 0 && focusedIndex < dropdownItems.length) {
          const item = dropdownItems[focusedIndex];
          if (item.type === "db") handleDbSwitch(item.value);
          else if (item.type === "conn") handleConnSwitch(item.value.id);
          else handleDisconnect();
        }
        break;
      case "Escape": e.preventDefault(); setOpen(false); break;
    }
  }, [open, hasMultipleDbOrConns, dropdownItems, focusedIndex, handleDbSwitch, handleConnSwitch, handleDisconnect]);

  // ── Early return after all hooks ───────────────────────────
  if (!activeConn) {
    return (
      <div className="sidebar-db-selector">
        <div className="sidebar-db-selector-btn sidebar-db-selector-btn--empty">
          <DbIcon size={14} className="sidebar-db-selector-icon" />
          <span className="sidebar-db-selector-info">
            <span className="sidebar-db-selector-name sidebar-db-selector-name--muted">Sin conexión</span>
          </span>
        </div>
      </div>
    );
  }

  const primaryLabel = connectionName || getDbName(activeConn) || activeConn.name;
  const subtitle = connectionName ? activeConn.name : null;
  let hasRenderedDbHeader = false;
  let hasRenderedConnHeader = false;

  return (
    <div className="sidebar-db-selector" ref={dropdownRef} onKeyDown={handleKeyDown}>
      <button
        className={`sidebar-db-selector-btn${open ? " sidebar-db-selector-btn--open" : ""}`}
        onClick={() => hasMultipleDbOrConns && setOpen((p) => !p)}
        title={subtitle ? `${primaryLabel} · ${subtitle}` : primaryLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        style={{ cursor: hasMultipleDbOrConns ? "pointer" : "default" }}
      >
        <span className="sidebar-db-selector-icon">{getEngineIcon(activeConn.engine, 14)}</span>
        <span className="sidebar-db-selector-info">
          <span className="sidebar-db-selector-name">{primaryLabel}</span>
          {subtitle && <span className="sidebar-db-selector-detail">en {subtitle}</span>}
        </span>
        {hasMultipleDbOrConns && (
          <ChevronDown
            size={12}
            className={`sidebar-db-selector-chevron${open ? " sidebar-db-selector-chevron--open" : ""}`}
          />
        )}
      </button>

      {open && (
        <div className="sidebar-db-dropdown" role="listbox" aria-label="Seleccionar base de datos o conexión">
          {dbsLoading && databases.length <= 1 && (
            <div className="sidebar-db-dropdown-loading">Cargando…</div>
          )}
          {dropdownItems.map((item, idx) => {
            const isFocused = focusedIndex === idx;
            if (item.type === "db") {
              const isFirst = !hasRenderedDbHeader;
              hasRenderedDbHeader = true;
              return (
                <div key={`db-${item.value}`}>
                  {isFirst && (
                    <div className="sidebar-db-dropdown-section-header">
                      <DbIcon size={10} /> Bases de datos
                    </div>
                  )}
                  <button
                    ref={(el) => { itemsRefs.current[idx] = el; }}
                    className={`sidebar-db-option${item.value === connectionName ? " sidebar-db-option--active bg-pattern-halftone" : ""}${isFocused ? " sidebar-db-option--focused" : ""}`}
                    onClick={() => handleDbSwitch(item.value)}
                    role="option"
                    aria-selected={item.value === connectionName}
                    tabIndex={-1}
                  >
                    <span className="sidebar-db-option-icon">{getEngineIcon(activeConn.engine, 12)}</span>
                    <div className="sidebar-db-option-info">
                      <span className="sidebar-db-option-name">{item.value}</span>
                    </div>
                    {item.value === connectionName && (
                      <span className="sidebar-db-option-active-dot" aria-hidden="true">●</span>
                    )}
                  </button>
                </div>
              );
            }
            if (item.type === "conn") {
              const isFirst = !hasRenderedConnHeader;
              hasRenderedConnHeader = true;
              return (
                <div key={`conn-${item.value.id}`}>
                  {isFirst && (
                    <div className="sidebar-db-dropdown-section-header sidebar-db-dropdown-section-header--connections">
                      Otras conexiones
                    </div>
                  )}
                  <button
                    ref={(el) => { itemsRefs.current[idx] = el; }}
                    className={`sidebar-db-option${isFocused ? " sidebar-db-option--focused" : ""}`}
                    onClick={() => handleConnSwitch(item.value.id)}
                    role="option"
                    aria-selected={false}
                    tabIndex={-1}
                  >
                    <span className="sidebar-db-option-icon">{getEngineIcon(item.value.engine, 12)}</span>
                    <div className="sidebar-db-option-info">
                      <span className="sidebar-db-option-name">{item.value.name}</span>
                      <span className="sidebar-db-option-detail">{getDbName(item.value)}</span>
                    </div>
                  </button>
                </div>
              );
            }
            // disconnect
            return (
              <div key="disconnect">
                <div className="sidebar-db-dropdown-divider" role="separator" />
                <button
                  ref={(el) => { itemsRefs.current[idx] = el; }}
                  className={`sidebar-db-option sidebar-db-option--disconnect${isFocused ? " sidebar-db-option--focused" : ""}`}
                  onClick={handleDisconnect}
                  role="option"
                  tabIndex={-1}
                >
                  <LogOut size={12} className="sidebar-db-option-icon sidebar-db-option-icon--danger" />
                  <div className="sidebar-db-option-info">
                    <span className="sidebar-db-option-name sidebar-db-option-name--danger">Desconectar</span>
                  </div>
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
