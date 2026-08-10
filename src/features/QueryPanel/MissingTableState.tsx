import { Table2 } from "lucide-react";
import { tableLabel } from "@/features/QueryPanel/trail";
import type { TableInfo } from "@/types/db";
import "./MissingTableState.css";

interface MissingTableStateProps {
  table: TableInfo;
  databaseName: string;
}

/** Empty state when a kept-open table tab is not present in the current database. */
export function MissingTableState({ table, databaseName }: MissingTableStateProps) {
  const label = tableLabel(table);
  return (
    <div className="mts" role="status">
      <div className="mts-content">
        <div className="mts-icon" aria-hidden>
          <Table2 size={28} strokeWidth={1.5} />
        </div>
        <h2 className="mts-title">Table not in this database</h2>
        <p className="mts-body">
          <code className="mts-code">{label}</code>
          {" "}is not in{" "}
          <strong className="mts-db">{databaseName}</strong>.
          Switch database to reopen it, or close the tab.
        </p>
      </div>
    </div>
  );
}
