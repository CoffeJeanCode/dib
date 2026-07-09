import { memo } from "react";
import { createPortal } from "react-dom";
import { ArrowUp, ArrowDown } from "lucide-react";
import { useDataGridContext } from "./DataGridContext";
import { operatorsForType } from "../DataGrid.utils";
import type { FilterOperator } from "@/types/db";

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

  if (!filterPopover) return null;

  const col = filterPopover.col;
  const sortDir = orderBy?.column === col ? orderBy!.direction : null;

  return createPortal(
    <>
      <div className="dg-filter-backdrop" onClick={() => setFilterPopover(null)} />
      <div
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
              autoFocus
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
