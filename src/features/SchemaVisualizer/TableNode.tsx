import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import "./TableNode.css";

export interface TableNodeData {
  tableName: string;
  engine: string;
  columns: { name: string; data_type: string; is_primary_key: boolean }[];
  isFocus?: boolean;   // true for the focal table in RelationView
  [key: string]: unknown;
}

/** Returns the neon border/header colour per engine */
function engineAccent(engine: string): string {
  const e = engine?.toLowerCase();
  if (e === "postgres" || e === "postgresql") return "var(--color-teal)";
  if (e === "sqlite") return "var(--color-green)";
  return "var(--color-purple)";
}

/** Returns a small icon emoji representing the column type */
function colTag(col: { data_type: string; is_primary_key: boolean }): string {
  if (col.is_primary_key) return "PK";
  const t = col.data_type.toUpperCase();
  if (/INT|FLOAT|NUMERIC|DECIMAL|REAL|DOUBLE|SERIAL|NUMBER/.test(t)) return "123";
  if (/DATE|TIME|TIMESTAMP/.test(t)) return "TS";
  if (/BOOL/.test(t)) return "TF";
  return "ABC";
}

function TableNodeComponent({ data }: NodeProps) {
  const { tableName, engine, columns, isFocus } = data as TableNodeData;
  const accent = engineAccent(engine);

  return (
    <div className={`tn${isFocus ? " tn--focus" : ""}`} style={{ "--tn-accent": accent } as React.CSSProperties}>
      <Handle type="target" position={Position.Top} className="tn-handle" />

      {/* Header */}
      <div className="tn-header">
        <span className="tn-icon">▤</span>
        <span className="tn-name" title={tableName}>{tableName}</span>
      </div>

      {/* Column list */}
      <div className="tn-body">
        {columns.length === 0 ? (
          <div className="tn-col tn-col--empty">
            <span className="tn-col-name" style={{ opacity: 0.4 }}>—</span>
          </div>
        ) : (
          columns.map((col) => (
            <div key={col.name} className={`tn-col${col.is_primary_key ? " tn-col--pk" : ""}`}>
              <span className={`tn-col-tag tn-col-tag--${colTag(col)}`}>{colTag(col)}</span>
              <span className="tn-col-name" title={col.name}>{col.name}</span>
              <span className="tn-col-type">{col.data_type}</span>
            </div>
          ))
        )}
      </div>

      <Handle type="source" position={Position.Bottom} className="tn-handle" />
    </div>
  );
}

export const TableNode = memo(TableNodeComponent);
