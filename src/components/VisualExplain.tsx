import { useState, useCallback } from "react";
import type { ExplainNode, ExplainPlan } from "../types/db";
import "./VisualExplain.css";

// ── Helpers ──────────────────────────────────────────────────────────────────

function costColor(pct: number): string {
  if (pct >= 80) return "var(--ve-cost-high)";
  if (pct >= 40) return "var(--ve-cost-med)";
  return "var(--ve-cost-low)";
}

function fmtMs(ms: number | null): string {
  if (ms === null) return "—";
  if (ms < 1) return `${(ms * 1000).toFixed(0)} µs`;
  return `${ms.toFixed(2)} ms`;
}

function fmtCost(c: number): string {
  return c.toFixed(2);
}

// ── Node Card ─────────────────────────────────────────────────────────────────

interface NodeCardProps {
  node: ExplainNode;
  depth: number;
  totalPlanCost: number;
}

function NodeCard({ node, depth, totalPlanCost }: NodeCardProps) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = node.children.length > 0;
  const pct = totalPlanCost > 0
    ? Math.min((node.total_cost / totalPlanCost) * 100, 100)
    : node.cost_pct;

  const label = node.relation
    ? `${node.node_type} on ${node.alias ?? node.relation}`
    : node.node_type;

  return (
    <div
      className={`ve-node ve-node--d${Math.min(depth, 4)}${node.is_seq_scan ? " ve-node--seqscan" : ""}`}
      style={{ "--ve-depth": depth } as React.CSSProperties}
    >
      {/* Header */}
      <div className="ve-node-header" onClick={() => hasChildren && setExpanded((e) => !e)}>
        <div className="ve-node-left">
          {hasChildren && (
            <span className={`ve-node-chevron${expanded ? " ve-node-chevron--open" : ""}`}>▶</span>
          )}
          <span className="ve-node-type">{label}</span>
          {node.is_seq_scan && (
            <span className="ve-seq-badge" title="Seq Scan — potencial cuello de botella">⚠ Seq Scan</span>
          )}
        </div>
        <div className="ve-node-right">
          {node.actual_time_ms !== null && (
            <span className="ve-node-time">{fmtMs(node.actual_time_ms)}</span>
          )}
          <span className="ve-node-cost" title={`Startup: ${fmtCost(node.startup_cost)} / Total: ${fmtCost(node.total_cost)}`}>
            cost: {fmtCost(node.total_cost)}
          </span>
        </div>
      </div>

      {/* Cost bar */}
      <div className="ve-cost-bar-track">
        <div
          className="ve-cost-bar-fill"
          style={{ width: `${pct}%`, background: costColor(pct) }}
          title={`${pct.toFixed(1)}% of plan cost`}
        />
      </div>
      <div className="ve-cost-pct" style={{ color: costColor(pct) }}>
        {pct.toFixed(1)}%
      </div>

      {/* Details */}
      {node.actual_rows !== null && (
        <div className="ve-node-detail">
          Rows: {node.actual_rows.toLocaleString()}
          {node.actual_loops !== null && node.actual_loops > 1 && (
            <> · Loops: {node.actual_loops}</>
          )}
        </div>
      )}

      {/* Children */}
      {hasChildren && expanded && (
        <div className="ve-children">
          {node.children.map((child, i) => (
            <NodeCard
              key={`${child.node_type}-${i}`}
              node={child}
              depth={depth + 1}
              totalPlanCost={totalPlanCost}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

interface VisualExplainProps {
  plan: ExplainPlan;
  onClose?: () => void;
}

export function VisualExplain({ plan, onClose }: VisualExplainProps) {
  const [showRaw, setShowRaw] = useState(false);
  const toggleRaw = useCallback(() => setShowRaw((v) => !v), []);

  const seqScans = countSeqScans(plan.root);

  return (
    <div className="ve-root">
      {/* Header bar */}
      <div className="ve-header">
        <div className="ve-header-left">
          <span className="ve-title">⚡ Visual EXPLAIN</span>
          {seqScans > 0 && (
            <span className="ve-warn-badge">{seqScans} Seq Scan{seqScans > 1 ? "s" : ""}</span>
          )}
        </div>
        <div className="ve-header-right">
          <div className="ve-meta">
            {plan.planning_time_ms !== null && (
              <span className="ve-meta-item">Plan: {fmtMs(plan.planning_time_ms)}</span>
            )}
            {plan.execution_time_ms !== null && (
              <span className="ve-meta-item">Exec: {fmtMs(plan.execution_time_ms)}</span>
            )}
            <span className="ve-meta-item">Total cost: {fmtCost(plan.total_cost)}</span>
          </div>
          <button className="ve-raw-btn" onClick={toggleRaw} title="Toggle raw JSON">
            {showRaw ? "Plan" : "Raw JSON"}
          </button>
          {onClose && (
            <button className="ve-close-btn" onClick={onClose} title="Close">✕</button>
          )}
        </div>
      </div>

      {/* Body */}
      {showRaw ? (
        <pre className="ve-raw">{plan.raw_json}</pre>
      ) : (
        <div className="ve-canvas">
          <NodeCard node={plan.root} depth={0} totalPlanCost={plan.total_cost || 1} />
        </div>
      )}
    </div>
  );
}

function countSeqScans(node: ExplainNode): number {
  return (node.is_seq_scan ? 1 : 0) + node.children.reduce((s, c) => s + countSeqScans(c), 0);
}
