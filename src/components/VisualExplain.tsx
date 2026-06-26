import { useState, useCallback, useEffect } from "react";
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Controls,
  useNodesState,
  useEdgesState,
  MarkerType,
  type Node,
  type Edge,
  Handle,
  Position
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
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

// ── Custom Node ───────────────────────────────────────────────────────────────

interface ExplainNodeData {
  node: ExplainNode;
  totalPlanCost: number;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ExplainFlowNode({ data }: { data: any }) {
  const { node, totalPlanCost } = data as ExplainNodeData;
  const pct = totalPlanCost > 0
    ? Math.min((node.total_cost / totalPlanCost) * 100, 100)
    : node.cost_pct;

  const label = node.relation
    ? `${node.node_type} on ${node.alias ?? node.relation}`
    : node.node_type;

  return (
    <div className={`ve-node ${node.is_seq_scan ? "ve-node--seqscan" : ""}`} style={{ width: 280, margin: 0, padding: "10px 12px 14px", position: "relative" }}>
      <Handle type="target" position={Position.Top} style={{ background: "transparent", border: "none" }} />
      
      {/* Header */}
      <div className="ve-node-header">
        <div className="ve-node-left">
          <span className="ve-node-type" title={label}>{label}</span>
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
      
      <Handle type="source" position={Position.Bottom} style={{ background: "transparent", border: "none" }} />
    </div>
  );
}

const nodeTypes = { explainNode: ExplainFlowNode };

// ── Layout Algorithm ──────────────────────────────────────────────────────────

async function layoutExplainTree(
  root: ExplainNode,
  totalCost: number
): Promise<{ nodes: Node[]; edges: Edge[] }> {
  return new Promise((resolve) => {
    // We defer the execution to not block UI immediately (simulating async virtualization layout)
    setTimeout(() => {
      const nodes: Node[] = [];
      const edges: Edge[] = [];
      
      const NODE_W = 280;
      const NODE_H = 110;
      const GAP_X = 50;
      const GAP_Y = 60;

      const subtreeWidth = new Map<ExplainNode, number>();
      
      function computeWidth(node: ExplainNode): number {
        if (node.children.length === 0) {
          subtreeWidth.set(node, NODE_W);
          return NODE_W;
        }
        let w = 0;
        for (const c of node.children) {
          w += computeWidth(c) + GAP_X;
        }
        w -= GAP_X;
        const res = Math.max(w, NODE_W);
        subtreeWidth.set(node, res);
        return res;
      }
      
      computeWidth(root);
      
      let idCounter = 1;
      function traverse(node: ExplainNode, x: number, y: number, parentId: string | null) {
        const id = `node-${idCounter++}`;
        nodes.push({
          id,
          type: "explainNode",
          position: { x, y },
          data: { node, totalPlanCost: totalCost },
          draggable: false, // Make it a static view
        });
        
        if (parentId) {
          edges.push({
            id: `e-${parentId}-${id}`,
            source: parentId,
            target: id,
            type: "smoothstep",
            animated: node.is_seq_scan,
            style: { stroke: node.is_seq_scan ? "var(--ve-cost-high)" : "var(--ve-border)", strokeWidth: 2 },
            markerEnd: { type: MarkerType.ArrowClosed, color: node.is_seq_scan ? "var(--ve-cost-high)" : "var(--ve-border)" },
          });
        }
        
        const sw = subtreeWidth.get(node) ?? NODE_W;
        let currentX = x - (sw / 2);
        
        for (const c of node.children) {
          const cw = subtreeWidth.get(c) ?? NODE_W;
          traverse(c, currentX + (cw / 2), y + NODE_H + GAP_Y, id);
          currentX += cw + GAP_X;
        }
      }
      
      // Center root at 0, 0
      traverse(root, 0, 0, null);
      
      resolve({ nodes, edges });
    }, 10);
  });
}

// ── Main Component ────────────────────────────────────────────────────────────

interface VisualExplainProps {
  plan: ExplainPlan;
  onClose?: () => void;
}

export function VisualExplain({ plan, onClose }: VisualExplainProps) {
  const [showRaw, setShowRaw] = useState(false);
  const toggleRaw = useCallback(() => setShowRaw((v) => !v), []);

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    layoutExplainTree(plan.root, plan.total_cost || 1).then((res) => {
      setNodes(res.nodes);
      setEdges(res.edges);
      setLoading(false);
    });
  }, [plan, setNodes, setEdges]);

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
        <div className="ve-canvas" style={{ padding: 0 }}>
          {loading ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--ve-muted)' }}>
              Renderizando grafo...
            </div>
          ) : (
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              nodeTypes={nodeTypes}
              fitView
              fitViewOptions={{ padding: 0.2 }}
              minZoom={0.1}
              proOptions={{ hideAttribution: true }}
            >
              <Background variant={BackgroundVariant.Dots} gap={12} size={1} color="var(--ve-border)" />
              <Controls showInteractive={false} />
            </ReactFlow>
          )}
        </div>
      )}
    </div>
  );
}

function countSeqScans(node: ExplainNode): number {
  return (node.is_seq_scan ? 1 : 0) + node.children.reduce((s, c) => s + countSeqScans(c), 0);
}
