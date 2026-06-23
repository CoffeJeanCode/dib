import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import "./TableNode.css";

export interface TableNodeData {
  tableName: string;
  engine: string;
  columns: { name: string; data_type: string; is_primary_key: boolean }[];
  [key: string]: unknown;
}

const ENGINE_ACCENT: Record<string, string> = {
  postgres: "var(--color-db-postgres)",
  postgresql: "var(--color-db-postgres)",
  sqlite: "var(--color-db-sqlite)",
};

function TableNodeComponent({ data }: NodeProps) {
  const { tableName, engine, columns } = data as TableNodeData;
  const accent = ENGINE_ACCENT[engine?.toLowerCase()] ?? "var(--color-blue)";

  return (
    <div className="tn">
      <Handle type="target" position={Position.Top} className="tn-handle" />
      <div className="tn-header" style={{ background: accent }}>
        <span className="tn-name">{tableName}</span>
      </div>
      <div className="tn-body">
        {columns.map((col) => (
          <div key={col.name} className="tn-col">
            <span className={`tn-col-name${col.is_primary_key ? " tn-col-pk" : ""}`}>
              {col.is_primary_key && <span className="tn-pk-icon">🔑</span>}
              {col.name}
            </span>
            <span className="tn-col-type">{col.data_type}</span>
          </div>
        ))}
      </div>
      <Handle type="source" position={Position.Bottom} className="tn-handle" />
    </div>
  );
}

export const TableNode = memo(TableNodeComponent);
