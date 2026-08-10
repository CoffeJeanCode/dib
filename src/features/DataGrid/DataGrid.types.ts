import type { PendingChange, ColumnInfo, GridFilter, TableRelation, OrderBy } from "@/types/db";

export interface GridColumn {
  id: string;
  name: string;
  origIdx: number;
  /** Display label when name is not unique (join aliases) */
  label?: string;
}

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
  /** When false, omit loaded-row count (parent already shows total / page size). Default true. */
  showRowCount?: boolean;
}

export interface UseDataGridStateOptions {
  columns: string[];
  rows: unknown[][];
  tableName?: string;
  primaryKeyColumn?: string;
  columnInfos?: ColumnInfo[];
  filters?: GridFilter[];
  orderBy?: OrderBy | null;
  onSortChange?: (orderBy: OrderBy | null) => void;
  activeCell: { row: number; col: number } | null;
  relations?: TableRelation[];
  disableAutoFocus?: boolean;
  onPendingChanges?: (changes: PendingChange[]) => void;
  onFiltersChange?: (filters: GridFilter[]) => void;
  onSave?: (changes: PendingChange[]) => Promise<void>;
  onForceClose?: () => void;
  onFocusEditor?: () => void;
  onActiveCellChange?: (cell: { row: number; col: number } | null) => void;
  onFkNavigate?: (targetTable: string, targetColumn: string, value: unknown, inPlace?: boolean) => void;
  onSaveError?: (msg: string) => void;
}
