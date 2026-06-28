import { memo } from "react";
import type { PendingChange, ColumnInfo, GridFilter, TableRelation } from "@/types/db";
import { useDataGridState } from "./DataGrid.hooks";
import { DataGridContext } from "./Parts/DataGridContext";
import { GridHeader } from "./Parts/GridHeader";
import { GridBody } from "./Parts/GridBody";
import { GridFooter } from "./Parts/GridFooter";
import { FilterPopover } from "./Parts/FilterPopover";
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
  footerRight?: React.ReactNode;
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
  footerRight,
}: DataGridProps) {
  // For empty tables the query result has no column names; fall back to schema info.
  const effectiveCols = columns.length > 0 ? columns : (columnInfos?.map(c => c.name) ?? []);

  const state = useDataGridState({
    columns: effectiveCols,
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
  if (!effectiveCols.length) return <div className="dg-empty">No data</div>;

  return (
    <DataGridContext.Provider value={{ ...state, columns: effectiveCols, filters, footerRight }}>
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
