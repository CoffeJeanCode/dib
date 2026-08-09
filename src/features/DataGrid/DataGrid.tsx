import { memo, useMemo, useLayoutEffect } from "react";
import type { PendingChange, ColumnInfo, GridFilter, TableRelation, OrderBy } from "@/types/db";
import { useDataGridState } from "./DataGrid.hooks";
import { DataGridContext } from "./Parts/DataGridContext";
import { Skeleton } from "@/shared/ui/Skeleton";
import { GridHeader } from "./Parts/GridHeader";
import { GridBody } from "./Parts/GridBody";
import { GridFooter } from "./Parts/GridFooter";
import { FilterPopover } from "./Parts/FilterPopover";
import { useFkPeek, FkPeekCard } from "./Parts/FkPeek";
import { useColumnProfile, ColumnProfileCard } from "./Parts/ColumnProfile";
import "./DataGrid.css";

export interface DataGridProps {
  columns: string[];
  rows: unknown[][];
  loading?: boolean;
  tableName?: string;
  tableSchema?: string | null;
  primaryKeyColumn?: string;
  columnInfos?: ColumnInfo[];
  filters?: GridFilter[];
  orderBy?: OrderBy | null;
  onSortChange?: (orderBy: OrderBy | null) => void;
  onPendingChanges?: (changes: PendingChange[]) => void;
  onFiltersChange?: (filters: GridFilter[]) => void;
  onSave?: (changes: PendingChange[]) => Promise<void>;
  onForceClose?: () => void;
  onFocusEditor?: () => void;
  activeCell?: { row: number; col: number } | null;
  onActiveCellChange?: (cell: { row: number; col: number } | null) => void;
  relations?: TableRelation[];
  onFkNavigate?: (targetTable: string, targetColumn: string, value: unknown, inPlace?: boolean) => void;
  onSaveError?: (msg: string) => void;
  disableAutoFocus?: boolean;
  footerRight?: React.ReactNode;
}

export const DataGrid = memo(function DataGrid({
  columns,
  rows,
  loading,
  tableName,
  tableSchema,
  primaryKeyColumn,
  columnInfos,
  filters,
  orderBy,
  onSortChange,
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
  const effectiveCols = useMemo(() => {
    return columns.length > 0 ? columns : (columnInfos?.map(c => c.name) ?? []);
  }, [columns, columnInfos]);

  const state = useDataGridState({
    columns: effectiveCols,
    rows,
    tableName,
    primaryKeyColumn,
    columnInfos,
    filters,
    orderBy,
    onSortChange,
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
  const fkPeek = useFkPeek({
    fkMap: state.fkMap,
    orderedColumns: state.orderedColumns,
    rows: state.editState.rows as unknown[][],
    isEditing: state.isEditing,
  });

  const columnProfile = useColumnProfile({
    tableName,
    tableSchema,
    colInfoMap: state.colInfoMap,
  });

  const columnsState = useMemo(() => {
    return {
      ...state,
      columns: effectiveCols,
      orderBy,
      filters,
      footerRight,
      handleHeaderContextMenu: columnProfile.handleHeaderContextMenu,
    };
  }, [state, effectiveCols, orderBy, filters, footerRight, columnProfile.handleHeaderContextMenu]);

  // Clamp the cell context menu inside the viewport — clientX/clientY alone
  // overflow off-screen when the click lands near the bottom/right edge.
  useLayoutEffect(() => {
    const el = state.fkMenuRef.current;
    if (!state.fkMenu || !el) return;
    const margin = 4;
    const rect = el.getBoundingClientRect();
    const left = Math.min(state.fkMenu.x, window.innerWidth - rect.width - margin);
    const top = Math.min(state.fkMenu.y, window.innerHeight - rect.height - margin);
    el.style.left = `${Math.max(margin, left)}px`;
    el.style.top = `${Math.max(margin, top)}px`;
  }, [state.fkMenu, state.fkMenuRef]);

  if (loading) {
    return (
      <div className="skeleton-panel" style={{ padding: 12, gap: 8 }} aria-busy>
        {Array.from({ length: 8 }, (_, i) => (
          <Skeleton key={i} height={30} style={{ opacity: 1 - i * 0.1 }} />
        ))}
      </div>
    );
  }
  if (!effectiveCols.length) return <div className="dg-empty">No data</div>;

  return (
    <DataGridContext.Provider value={columnsState}>
      <div
        className="dg-wrap"
        role="table"
        aria-label="Data grid"
        tabIndex={0}
        ref={state.gridRef}
        onKeyDown={(e) => {
          if (fkPeek.handleKeyDown(e)) return;
          state.handleGridKeyDown(e);
        }}
      >
        <div
          className="dg-scroll"
          ref={state.setContainerEl}
          onScroll={(e) => {
            fkPeek.closePeek();
            state.onScroll(e);
          }}
          {...fkPeek.peekHandlers}
        >
          <GridHeader />
          <GridBody />
        </div>
        <FilterPopover />
        {fkPeek.peek && (
          <FkPeekCard
            peek={fkPeek.peek}
            onClose={fkPeek.closePeek}
            onKeepOpen={fkPeek.cancelClose}
            onOpenTable={
              onFkNavigate
                ? () => {
                    const p = fkPeek.peek!;
                    fkPeek.closePeek();
                    onFkNavigate(p.table, p.column, p.value);
                  }
                : undefined
            }
          />
        )}
        {state.fkMenu && (
          <div
            className="dg-fk-menu"
            ref={state.fkMenuRef}
            style={{ left: state.fkMenu.x, top: state.fkMenu.y }}
            role="menu"
          >
            {state.selectedCells.size > 0 && (
              <>
                <button
                  className="dg-fk-menu-item"
                  role="menuitem"
                  onClick={() => {
                    state.copySelection();
                    state.setFkMenu(null);
                  }}
                >
                  <span>Copy</span>
                  <kbd>Ctrl+C</kbd>
                </button>
                <button
                  className="dg-fk-menu-item"
                  role="menuitem"
                  onClick={() => {
                    state.copySelectionWithHeaders();
                    state.setFkMenu(null);
                  }}
                >
                  <span>Copy with Headers</span>
                </button>
              </>
            )}
            {state.fkMap[state.fkMenu.col] && (
              <button
                className="dg-fk-menu-item"
                role="menuitem"
                onClick={() => {
                  state.generateJoinQuery(state.fkMenu!.col);
                  state.setFkMenu(null);
                }}
              >
                <span>Generate JOIN Query</span>
                <kbd>Alt+Click</kbd>
              </button>
            )}
          </div>
        )}
        {columnProfile.profile && (
          <ColumnProfileCard profile={columnProfile.profile} onClose={columnProfile.closeProfile} />
        )}
        <GridFooter />
      </div>
    </DataGridContext.Provider>
  );
});
