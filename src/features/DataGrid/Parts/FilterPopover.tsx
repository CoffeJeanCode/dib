import { memo, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { ArrowUp, ArrowDown } from "lucide-react";
import { useDataGridContext } from "./DataGridContext";
import { operatorsForType } from "../DataGrid.utils";
import type { FilterOperator } from "@/types/db";

const FOCUSABLE = [
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
].join(", ");

export const FilterPopover = memo(function FilterPopover() {
  const {
    filterPopover,
    setFilterPopover,
    localOp,
    setLocalOp,
    localValue,
    setLocalValue,
    colInfoMap,
    orderBy,
    handleSortColumn,
    applyFilter,
    clearFilter,
  } = useDataGridContext();

  const popoverRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<Element | null>(null);

  // Store previous focus and trap focus within popover
  useEffect(() => {
    if (!filterPopover) return;

    previousFocusRef.current = document.activeElement;

    const popover = popoverRef.current;
    if (!popover) return;

    // Focus the first focusable element
    requestAnimationFrame(() => {
      const focusable = popover.querySelectorAll<HTMLElement>(FOCUSABLE);
      if (focusable.length > 0) {
        focusable[0].focus({ preventScroll: true });
      }
    });

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        setFilterPopover(null);
        return;
      }

      if (e.key !== "Tab") return;

      const focusable = popover.querySelectorAll<HTMLElement>(FOCUSABLE);
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const activeElement = document.activeElement as HTMLElement;

      if (e.shiftKey) {
        if (activeElement === first || !popover.contains(activeElement)) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (activeElement === last || !popover.contains(activeElement)) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    const handleFocusIn = (e: FocusEvent) => {
      // If focus moves outside the popover, bring it back
      if (!popover.contains(e.target as Node)) {
        const focusable = popover.querySelectorAll<HTMLElement>(FOCUSABLE);
        if (focusable.length > 0) {
          focusable[0].focus();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown, { capture: true });
    document.addEventListener("focusin", handleFocusIn);

    return () => {
      window.removeEventListener("keydown", handleKeyDown, { capture: true });
      document.removeEventListener("focusin", handleFocusIn);
      
      // Restore focus when closing
      if (previousFocusRef.current instanceof HTMLElement && document.contains(previousFocusRef.current)) {
        previousFocusRef.current.focus({ preventScroll: true });
      }
    };
  }, [filterPopover, setFilterPopover]);

  if (!filterPopover) return null;

  const col = filterPopover.col;
  const sortDir = orderBy?.column === col ? orderBy!.direction : null;

  return createPortal(
    <>
      <div className="dg-filter-backdrop" onClick={() => setFilterPopover(null)} />
      <div
        ref={popoverRef}
        className="dg-filter-popover"
        style={{ left: filterPopover.x, top: filterPopover.y }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="dg-filter-sort-row">
          <button
            className={`dg-filter-sort-btn${sortDir === "ASC" ? " dg-filter-sort-btn--active" : ""}`}
            onClick={() => handleSortColumn?.(col, sortDir === "ASC" ? null : "ASC")}
          >
            <ArrowUp size={12} />
            <span>A–Z</span>
          </button>
          <button
            className={`dg-filter-sort-btn${sortDir === "DESC" ? " dg-filter-sort-btn--active" : ""}`}
            onClick={() => handleSortColumn?.(col, sortDir === "DESC" ? null : "DESC")}
          >
            <ArrowDown size={12} />
            <span>Z–A</span>
          </button>
        </div>

        <hr className="dg-filter-divider" />

        <div className="dg-filter-input-row">
          <select
            className="dg-filter-select"
            value={localOp}
            onChange={(e) => setLocalOp(e.target.value as FilterOperator)}
          >
            {operatorsForType(colInfoMap[col]?.data_type).map((op) => (
              <option key={op} value={op}>{op}</option>
            ))}
          </select>
          {localOp !== "IS NULL" && localOp !== "IS NOT NULL" && (
            <input
              className="dg-filter-input"
              value={localValue}
              onChange={(e) => setLocalValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") applyFilter();
                if (e.key === "Escape") setFilterPopover(null);
              }}
              placeholder="Filter value…"
            />
          )}
        </div>

        <div className="dg-filter-actions">
          <button className="dg-filter-apply" onClick={applyFilter}>Apply</button>
          <button className="dg-filter-clear" onClick={() => clearFilter(col)}>Remove</button>
        </div>
      </div>
    </>,
    document.body,
  );
});
