import type { PendingChange, ColumnInfo, GridFilter, TableRelation } from "@/types/db";

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

export interface UseDataGridStateOptions {
  columns: string[];
  rows: unknown[][];
  tableName?: string;
  primaryKeyColumn?: string;
  columnInfos?: ColumnInfo[];
  filters?: GridFilter[];
  activeCell: { row: number; col: number } | null;
  relations?: TableRelation[];
  disableAutoFocus?: boolean;
  onPendingChanges?: (changes: PendingChange[]) => void;
  onFiltersChange?: (filters: GridFilter[]) => void;
  onSave?: (changes: PendingChange[]) => Promise<void>;
  onForceClose?: () => void;
  onFocusEditor?: () => void;
  onActiveCellChange?: (cell: { row: number; col: number } | null) => void;
  onFkNavigate?: (targetTable: string, targetColumn: string, value: unknown) => void;
  onSaveError?: (msg: string) => void;
}
