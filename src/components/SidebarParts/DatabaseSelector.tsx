import { useState, useEffect, useRef, useCallback } from "react";
import { ChevronDown } from "lucide-react";
import { getEngineIcon, getDbName } from "./utils";
import type { SavedConnection } from "../../types/db";

interface DatabaseSelectorProps {
  connections: SavedConnection[];
  activeConnectionId?: string | null;
  onConnectionSelect?: (connId: string) => void;
}

export function DatabaseSelector({ connections, activeConnectionId, onConnectionSelect }: DatabaseSelectorProps) {
  const [dbDropdownOpen, setDbDropdownOpen] = useState(false);
  const dbDropdownRef = useRef<HTMLDivElement>(null);
  const activeConn = connections.find((c) => c.id === activeConnectionId);

  useEffect(() => {
    if (!dbDropdownOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (dbDropdownRef.current && !dbDropdownRef.current.contains(e.target as Node)) {
        setDbDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [dbDropdownOpen]);

  const handleDbSelect = useCallback((connId: string) => {
    setDbDropdownOpen(false);
    if (connId !== activeConnectionId) {
      onConnectionSelect?.(connId);
    }
  }, [activeConnectionId, onConnectionSelect]);

  if (!activeConn) return null;

  return (
    <div className="sidebar-db-selector" ref={dbDropdownRef}>
      <button
        className="sidebar-db-selector-btn"
        onClick={() => setDbDropdownOpen((prev) => !prev)}
      >
        <span className="sidebar-db-selector-icon">
          {getEngineIcon(activeConn.engine, 14)}
        </span>
        <span className="sidebar-db-selector-name">{activeConn.name}</span>
        <ChevronDown
          size={12}
          className={`sidebar-db-selector-chevron${dbDropdownOpen ? " sidebar-db-selector-chevron--open" : ""}`}
        />
      </button>

      {dbDropdownOpen && (
        <div className="sidebar-db-dropdown" role="listbox">
          {connections.map((conn) => (
            <button
              key={conn.id}
              className={`sidebar-db-option${conn.id === activeConnectionId ? " sidebar-db-option--active bg-pattern-halftone" : ""}`}
              onClick={() => handleDbSelect(conn.id)}
              role="option"
              aria-selected={conn.id === activeConnectionId}
            >
              <span className="sidebar-db-option-icon">
                {getEngineIcon(conn.engine, 12)}
              </span>
              <div className="sidebar-db-option-info">
                <span className="sidebar-db-option-name">{conn.name}</span>
                <span className="sidebar-db-option-detail">{getDbName(conn)}</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}