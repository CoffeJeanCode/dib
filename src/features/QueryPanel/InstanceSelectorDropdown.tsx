import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronDown, Check } from "lucide-react";
import { useSavedConnections } from "@/hooks/useSavedConnections";
import { useConnectionStore } from "@/store/connectionStore";
import { getEngineIcon, getDbName } from "@/features/Sidebar/Parts/utils";
import type { SavedConnection } from "@/types/db";
import "./InstanceSelectorDropdown.css";

/**
 * Universal instance selector for the active editor tab.
 *
 * Shows every instance available in the current scope — the active
 * Workspace's connections, or all Standalone connections when no workspace
 * is open (useSavedConnections already scopes by workspace). The user can
 * freely retarget where the query runs; the backend workspace guard is the
 * safety net for cross-workspace execution, so the UI stays permissive.
 *
 * Controlled component: `value` is the selected saved-connection id,
 * `onChange` receives the full SavedConnection. The parent (editor tab)
 * decides what switching means — connect lazily, rebind the tab, etc.
 */

interface InstanceSelectorDropdownProps {
  /** Currently targeted saved-connection id (null = none yet) */
  value: string | null;
  onChange: (conn: SavedConnection) => void;
  disabled?: boolean;
}

export function InstanceSelectorDropdown({ value, onChange, disabled }: InstanceSelectorDropdownProps) {
  const { connections } = useSavedConnections();
  const activeSavedId = useConnectionStore((s) => s.active?.savedId ?? null);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  // Close on click-outside / Escape.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const handleSelect = useCallback((conn: SavedConnection) => {
    setOpen(false);
    if (conn.id !== value) onChange(conn);
  }, [value, onChange]);

  const selected = connections.find((c) => c.id === value) ?? null;

  return (
    <div className="instance-selector" ref={rootRef}>
      <button
        className="instance-selector__trigger"
        onClick={() => setOpen((v) => !v)}
        disabled={disabled}
        title={selected ? `${selected.name} · ${getDbName(selected)}` : "Select instance"}
      >
        {selected ? getEngineIcon(selected.engine) : null}
        <span className="instance-selector__label">
          {selected ? selected.name : "Instance…"}
        </span>
        <ChevronDown size={10} className={`instance-selector__chevron${open ? " instance-selector__chevron--open" : ""}`} />
      </button>

      {open && (
        <div className="instance-selector__menu" role="listbox">
          {connections.length === 0 && (
            <div className="instance-selector__empty">No instances available</div>
          )}
          {connections.map((conn) => (
            <button
              key={conn.id}
              role="option"
              aria-selected={conn.id === value}
              className={`instance-selector__option${conn.id === value ? " instance-selector__option--selected" : ""}`}
              onClick={() => handleSelect(conn)}
            >
              {getEngineIcon(conn.engine)}
              <span className="instance-selector__option-name">{conn.name}</span>
              <span className="instance-selector__option-db">{getDbName(conn)}</span>
              {conn.id === activeSavedId && (
                <span className="instance-selector__live-dot" title="Connected" />
              )}
              {conn.id === value && <Check size={10} style={{ flexShrink: 0 }} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
