import { memo } from "react";
import type { PendingChange, ColumnInfo, GridFilter, TableRelation } from "../types/db";
import { useDataGridState } from "../hooks/useDataGridState";
import { DataGridContext } from "./DataGridParts/DataGridContext";
import { GridHeader } from "./DataGridParts/GridHeader";
import { GridBody } from "./DataGridParts/GridBody";
import { GridFooter } from "./DataGridParts/GridFooter";
import { FilterPopover } from "./DataGridParts/FilterPopover";
import "./DataGrid.css";

export interface DataGridProps {
  columns: string[];
  rows: unknown[][];
  loading?: boolean;
  tableName?: string;
  primaryKeyColumn?: string;
  columnInfos?: ColumnInfo[];
  filters?: GridFilter[];
  onPendingChanges?: (changes: PendingChange[]) => void;
  onFiltersChange?: (filters: GridFilter[]) => void;
  onSave?: (changes: PendingChange[]) => Promise<void>;
  onForceClose?: () => void;
  onFocusEditor?: () => void;
  activeCell?: { row: number; col: number } | null;
  onActiveCellChange?: (cell: { row: number; col: number } | null) => void;
  relations?: TableRelation[];
  onFkNavigate?: (targetTable: string, targetColumn: string, value: unknown) => void;
  onSaveError?: (msg: string) => void;
  disableAutoFocus?: boolean;
}

export const DataGrid = memo(function DataGrid({
  columns,
  rows,
  loading,
  tableName,
  primaryKeyColumn,
  columnInfos,
  filters,
  onPendingChanges,
  onFiltersChange,
  onSave,
  onForceClose,
  onFocusEditor,
  activeCell: activeCellProp,
  onActiveCellChange,
  relations,
  onFkNavigate,
  onSaveError,
  disableAutoFocus,
}: DataGridProps) {
  const state = useDataGridState({
    columns,
    rows,
    tableName,
    primaryKeyColumn,
    columnInfos,
    filters,
    activeCell: activeCellProp ?? null,
    relations,
    disableAutoFocus,
    onPendingChanges,
    onFiltersChange,
    onSave,
    onForceClose,
    onFocusEditor,
    onActiveCellChange,
    onFkNavigate,
    onSaveError,
  });

  if (loading) return <div className="dg-empty dg-loading">Loading…</div>;
  if (!columns.length) return <div className="dg-empty">No data</div>;

  return (
    <DataGridContext.Provider value={{ ...state, columns, filters }}>
      <div
        className="dg-wrap"
        role="table"
        aria-label="Data grid"
        tabIndex={0}
        ref={state.gridRef}
        onKeyDown={state.handleGridKeyDown}
      >
        <div className="dg-scroll" ref={state.containerRef} onScroll={state.onScroll}>
          <GridHeader />
          <GridBody />
        </div>
        <FilterPopover />
        <GridFooter />
      </div>
    </DataGridContext.Provider>
  );
});
