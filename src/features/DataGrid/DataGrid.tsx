import { memo, useMemo, useCallback } from "react";
import type { PendingChange, ColumnInfo, GridFilter, TableRelation, TableInfo } from "@/types/db";
import { useDataGridState } from "./DataGrid.hooks";
import { DataGridContext } from "./Parts/DataGridContext";
import { Skeleton } from "@/shared/ui/Skeleton";
import { GridHeader } from "./Parts/GridHeader";
import { GridBody } from "./Parts/GridBody";
import { GridFooter } from "./Parts/GridFooter";
import { FilterPopover } from "./Parts/FilterPopover";
import { useDangerDialog } from "@/shared/hooks/useDangerDialog";
import { useToastStore } from "@/store/toastStore";
import { useWorkspaceStore } from "@/store/workspaceStore";
import { useConnectionStore } from "@/store/connectionStore";
import { Layers, Network, Wrench, PlusSquare, Edit3, Trash2 } from "lucide-react";
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
  tableSchema,
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
  const connectionId = useConnectionStore((s) => s.active?.activeId ?? null);
  const info = useToastStore((s) => s.info);
  const error = useToastStore((s) => s.error);
  const { handleDropTable } = useDangerDialog(connectionId, info, error);
  const tblSchema = tableSchema !== undefined ? tableSchema : null;
  const tableActionsEnabled = !!tableName && !!connectionId;

  const handleTableAction = useCallback((action: string) => {
    if (!tableName) return;
    const t: TableInfo = { name: tableName, schema: tblSchema };
    if (action === "structure") useWorkspaceStore.getState().openTableStructure(t);
    else if (action === "erd") useWorkspaceStore.getState().openTableRelations(t);
    else if (action === "alter") import("@/store/uiStore").then(m => m.useUiStore.getState().setAlterTarget(t));
    else if (action === "insert") {
      useWorkspaceStore.getState().setNavigateTo({ table: t, v: Date.now() } as any);
      useWorkspaceStore.getState().triggerInsertRow();
    }
    else if (action === "rename") import("@/store/uiStore").then(m => m.useUiStore.getState().setRenameTarget(t));
    else if (action === "drop") handleDropTable(t);
  }, [tableName, tblSchema, handleDropTable]);

  const columnsState = useMemo(() => {
    return {
      ...state,
      columns: effectiveCols,
      filters,
      footerRight,
    };
  }, [state, effectiveCols, filters, footerRight]);

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
        onKeyDown={state.handleGridKeyDown}
      >
        {tableActionsEnabled && (
          <div className="dg-toolbar">
            <span className="dg-toolbar-title" title={tblSchema ? `${tblSchema}.${tableName}` : tableName}>
              {tableName}
            </span>
            <div className="dg-toolbar-actions">
              <button className="dg-toolbar-btn" title="View Structure" onClick={() => handleTableAction("structure")}>
                <Layers size={14} /> Structure
              </button>
              <button className="dg-toolbar-btn" title="ERD Diagram" onClick={() => handleTableAction("erd")}>
                <Network size={14} /> ERD
              </button>
              <button className="dg-toolbar-btn" title="Alter Table" onClick={() => handleTableAction("alter")}>
                <Wrench size={14} /> Alter
              </button>
              <button className="dg-toolbar-btn" title="Insert Row" onClick={() => handleTableAction("insert")}>
                <PlusSquare size={14} /> Insert
              </button>
              <button className="dg-toolbar-btn" title="Rename Table" onClick={() => handleTableAction("rename")}>
                <Edit3 size={14} /> Rename
              </button>
              <button className="dg-toolbar-btn dg-toolbar-btn--danger" title="Drop Table" onClick={() => handleTableAction("drop")}>
                <Trash2 size={14} /> Drop
              </button>
            </div>
          </div>
        )}
        <div className="dg-scroll" ref={state.setContainerEl} onScroll={state.onScroll}>
          <GridHeader />
          <GridBody />
        </div>
        <FilterPopover />
        {state.fkMenu && (
          <div
            className="dg-fk-menu"
            ref={state.fkMenuRef}
            style={{ left: state.fkMenu.x, top: state.fkMenu.y }}
            role="menu"
          >
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
          </div>
        )}
        <GridFooter />
      </div>
    </DataGridContext.Provider>
  );
});
