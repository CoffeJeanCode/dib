import { memo } from "react";
import { createPortal } from "react-dom";
import { useDataGridContext } from "./DataGridContext";
import { operatorsForType } from "../../hooks/useDataGridState";
import type { FilterOperator } from "../../types/db";

export const FilterPopover = memo(function FilterPopover() {
  const {
    filterPopover,
    setFilterPopover,
    localOp,
    setLocalOp,
    localValue,
    setLocalValue,
    colInfoMap,
    applyFilter,
    clearFilter,
  } = useDataGridContext();

  if (!filterPopover) return null;

  return createPortal(
    <>
      <div className="dg-filter-backdrop" onClick={() => setFilterPopover(null)} />
      <div
        className="dg-filter-popover"
        style={{ left: filterPopover.x, top: filterPopover.y }}
        onClick={(e) => e.stopPropagation()}
      >
        <select
          className="dg-filter-select"
          value={localOp}
          onChange={(e) => setLocalOp(e.target.value as FilterOperator)}
        >
          {operatorsForType(colInfoMap[filterPopover.col]?.data_type).map((op) => (
            <option key={op} value={op}>{op}</option>
          ))}
        </select>
        {localOp !== "IS NULL" && localOp !== "IS NOT NULL" && (
          <input
            className="dg-filter-input"
            value={localValue}
            onChange={(e) => setLocalValue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && applyFilter()}
            placeholder="Valor…"
            autoFocus
          />
        )}
        <div className="dg-filter-actions">
          <button className="dg-filter-apply" onClick={applyFilter}>Aplicar</button>
          <button className="dg-filter-clear" onClick={() => clearFilter(filterPopover.col)}>Limpiar</button>
        </div>
      </div>
    </>,
    document.body,
  );
});
