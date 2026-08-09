import { createContext, useContext, type ReactNode } from "react";
import type { UseDataGridStateOptions } from "../DataGrid.hooks";
import type { useDataGridState } from "../DataGrid.hooks";

export type DataGridContextValue = ReturnType<typeof useDataGridState> & {
  columns: string[];
  filters?: UseDataGridStateOptions["filters"];
  orderBy?: UseDataGridStateOptions["orderBy"];
  onSortChange?: UseDataGridStateOptions["onSortChange"];
  handleSortColumn?: (colName: string, direction: "ASC" | "DESC" | null) => void;
  /** Right-click a column header → distribution profile. */
  handleHeaderContextMenu?: (column: string, e: React.MouseEvent) => void;
  footerRight?: ReactNode;
};

export const DataGridContext = createContext<DataGridContextValue | null>(null);

export function useDataGridContext(): DataGridContextValue {
  const ctx = useContext(DataGridContext);
  if (!ctx) throw new Error("useDataGridContext must be used inside DataGrid");
  return ctx;
}
