import { memo } from "react";
import { Filter } from "lucide-react";
import { useDataGridContext } from "./DataGridContext";

export const GridHeader = memo(function GridHeader() {
  const {
    columns,
    colInfoMap,
    fkMap,
    headerRef,
    filters,
    openFilterPopover,
    handleResizeStart,
    autoFitColumn,
  } = useDataGridContext();

  return (
    <div ref={headerRef} className="dg-header" role="row">
      {columns.map((col, ci) => {
        const info = colInfoMap[col];
        const cssW = `var(--dg-cw-${ci}, 150px)`;
        const activeFilter = filters?.find((f) => f.column === col);
        return (
          <div
            key={col}
            className="dg-cell dg-th"
            role="columnheader"
            style={{
              width: cssW,
              minWidth: cssW,
              maxWidth: cssW,
            }}
            title={info ? `${col} (${info.data_type})` : col}
          >
            <div className="dg-th-content">
              <span className="dg-th-name">{col}</span>
              {info && (
                <span className="dg-th-type">
                  {info.data_type}{info.is_primary_key ? " · PK" : ""}{fkMap[col] ? ` · FK→${fkMap[col].targetTable}` : ""}
                </span>
              )}
            </div>
            <button
              className={`dg-filter-btn${activeFilter ? " dg-filter-btn--active" : ""}`}
              onClick={(e) => openFilterPopover(col, e)}
              title={activeFilter ? `Filtro: ${activeFilter.operator} ${activeFilter.value ?? ""}` : "Filtrar"}
            >
              <Filter size={11} />
            </button>
            <div
              className="dg-resizer"
              onMouseDown={(e) => handleResizeStart(col, e)}
              onDoubleClick={(e) => { e.preventDefault(); e.stopPropagation(); autoFitColumn(col, ci); }}
            />
          </div>
        );
      })}
    </div>
  );
});
