import React from "react";
import { Key, Hash, Type, Calendar } from "lucide-react";
import type { ColumnInfo } from "@/types/db";

function colIcon(col: ColumnInfo) {
  if (col.is_primary_key) return <Key size={10} className="dbcat-col-icon dbcat-col-icon--pk" />;
  const t = col.data_type.toUpperCase();
  if (/INT|FLOAT|NUMERIC|DECIMAL|REAL|DOUBLE|SERIAL|NUMBER/.test(t))
    return <Hash size={10} className="dbcat-col-icon dbcat-col-icon--num" />;
  if (/DATE|TIME|TIMESTAMP/.test(t))
    return <Calendar size={10} className="dbcat-col-icon dbcat-col-icon--date" />;
  return <Type size={10} className="dbcat-col-icon dbcat-col-icon--text" />;
}

interface ColumnListProps {
  columns: ColumnInfo[] | undefined;
  loading: boolean;
}

export const ColumnList = React.memo(function ColumnList({ columns, loading }: ColumnListProps) {
  return (
    <div className="sidebar-db-col-list">
      {loading ? (
        <div className="sidebar-db-col-item sidebar-db-col-item--muted">&hellip;</div>
      ) : !columns || columns.length === 0 ? (
        <div className="sidebar-db-col-item sidebar-db-col-item--muted">(empty)</div>
      ) : (
        columns.map((col) => (
          <div key={col.name} className="sidebar-db-col-item">
            {colIcon(col)}
            <span className="sidebar-db-col-name">{col.name}</span>
            <span className="sidebar-db-col-type">{col.data_type}</span>
          </div>
        ))
      )}
    </div>
  );
});
