import { createContext, useContext } from "react";
import type { UseDataGridStateOptions } from "../../hooks/useDataGridState";
import type { useDataGridState } from "../../hooks/useDataGridState";

export type DataGridContextValue = ReturnType<typeof useDataGridState> & {
  columns: string[];
  filters?: UseDataGridStateOptions["filters"];
};

export const DataGridContext = createContext<DataGridContextValue | null>(null);

export function useDataGridContext(): DataGridContextValue {
  const ctx = useContext(DataGridContext);
  if (!ctx) throw new Error("useDataGridContext must be used inside DataGrid");
  return ctx;
}
