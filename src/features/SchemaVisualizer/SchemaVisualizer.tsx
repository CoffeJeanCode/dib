import { useMemo, useState, useEffect, useCallback } from "react";
import { safeInvoke as invoke } from "@/utils/ipc";
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Controls,
  Panel,
  useNodesState,
  useEdgesState,
  MarkerType,
  type Node,
  type Edge,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { TableNode, type TableNodeData } from "./TableNode";
import type { TableInfo, ColumnInfo, TableRelation } from "@/types/db";
import "./SchemaVisualizer.css";

const nodeTypes = { tableNode: TableNode };

export interface SchemaVisualizerProps {
  engine: string;
  tables: { name: string; schema?: string | null }[];
  columnMap: Record<string, { name: string; data_type: string; is_primary_key: boolean }[]>;
  connectionId?: string;
  focusTable?: TableInfo;
}

// ── Layout helpers ────────────────────────────────────────────────────────────

/**
 * Simple force-free grid layout:
 * organises tables into N columns, with extra vertical spacing for taller nodes.
 */
function gridLayout(count: number): { x: number; y: number }[] {
  const cols = Math.max(1, Math.min(5, Math.ceil(Math.sqrt(count))));
  const nodeW = 230;
  const nodeH = 220;
  const gapX = 60;
  const gapY = 60;
  return Array.from({ length: count }, (_, i) => ({
    x: (i % cols) * (nodeW + gapX),
    y: Math.floor(i / cols) * (nodeH + gapY),
  }));
}

// ── Full-schema / Global ER view ───────────────────────────────────────────────

function FullSchemaView({
  engine,
  tables,
  columnMap,
  connectionId,
}: Pick<SchemaVisualizerProps, "engine" | "tables" | "columnMap" | "connectionId">) {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node<TableNodeData>>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [loading, setLoading] = useState(false);
  const [allRelations, setAllRelations] = useState<TableRelation[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Build nodes from known tables + columns
  const positions = useMemo(() => gridLayout(tables.length), [tables.length]);

  const buildNodes = useCallback((): Node<TableNodeData>[] =>
    tables.map((t, i) => ({
      id: t.name,
      type: "tableNode",
      position: positions[i] ?? { x: 0, y: 0 },
      data: {
        tableName: t.schema ? `${t.schema}.${t.name}` : t.name,
        engine,
        columns: columnMap[t.name] ?? [],
      },
    })),
  [tables, positions, engine, columnMap]);

  // Fetch FK relations for ALL tables in parallel
  useEffect(() => {
    if (!connectionId || tables.length === 0) {
      setNodes(buildNodes());
      setEdges([]);
      setAllRelations([]);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    Promise.all(
      tables.map((t) =>
        invoke<TableRelation[]>("fetch_table_relations", {
          connectionId,
          tableName: t.name,
          schema: t.schema ?? null,
        }).catch(() => [] as TableRelation[]),
      ),
    )
      .then((results) => {
        if (cancelled) return;
        const merged: TableRelation[] = results.flat();
        setAllRelations(merged);
      })
      .catch((e) => {
        if (!cancelled) setError(String(e));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connectionId, tables.map(t => t.name).join(",")]);

  // Re-build nodes + edges whenever data changes
  useEffect(() => {
    setNodes(buildNodes());

    // Build edges from allRelations — deduplicate by id
    const seen = new Set<string>();
    const builtEdges: Edge[] = [];
    allRelations.forEach((r, i) => {
      const id = `e-${r.source_table}-${r.source_column}-${r.target_table}-${r.target_column}`;
      if (seen.has(id)) return;
      seen.add(id);
      // Only draw if both endpoints are in the table list
      const srcExists = tables.some((t) => t.name === r.source_table);
      const tgtExists = tables.some((t) => t.name === r.target_table);
      if (!srcExists || !tgtExists) return;
      builtEdges.push({
        id: `${id}-${i}`,
        source: r.source_table,
        target: r.target_table,
        label: `${r.source_column} → ${r.target_column}`,
        animated: false,
        style: { stroke: "var(--color-teal)", strokeWidth: 1.5, opacity: 0.85 },
        labelStyle: { fill: "#888", fontSize: 9, fontFamily: "JetBrains Mono, monospace" },
        labelBgStyle: { fill: "#1A1A1E", fillOpacity: 0.9 },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: "var(--color-teal)",
          width: 14,
          height: 14,
        },
      });
    });
    setEdges(builtEdges);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allRelations, tables, columnMap, engine]);

  if (loading && nodes.length === 0) {
    return (
      <div className="sv">
        <div className="sv-loading">Loading global diagram…</div>
      </div>
    );
  }

  return (
    <div className="sv">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.18 }}
        minZoom={0.08}
        maxZoom={2.5}
        proOptions={{ hideAttribution: true }}
        nodesDraggable
        nodesConnectable={false}
        elementsSelectable
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={24}
          size={1}
          color="rgba(0,238,255,0.07)"
        />
        <Controls
          showInteractive={false}
          className="sv-controls"
        />
        {error && (
          <Panel position="bottom-center">
            <span className="sv-warning">⚠ {error}</span>
          </Panel>
        )}
        {!loading && allRelations.length === 0 && tables.length > 0 && (
          <Panel position="bottom-center">
            <span className="sv-no-relations">No FK relations detected — showing all tables</span>
          </Panel>
        )}
      </ReactFlow>
    </div>
  );
}

// ── Relation mode (single table + FK neighbours) ──────────────────────────────

function RelationView({
  connectionId,
  focusTable,
  engine,
}: {
  connectionId: string;
  focusTable: TableInfo;
  engine: string;
}) {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node<TableNodeData>>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [loading, setLoading] = useState(true);
  const [hasRelations, setHasRelations] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    Promise.all([
      invoke<ColumnInfo[]>("fetch_table_schema", {
        connectionId,
        tableName: focusTable.name,
        schema: focusTable.schema ?? null,
      }),
      invoke<TableRelation[]>("fetch_table_relations", {
        connectionId,
        tableName: focusTable.name,
        schema: focusTable.schema ?? null,
      }),
    ])
      .then(([cols, relations]) => {
        if (cancelled) return;

        const centerLabel = focusTable.schema
          ? `${focusTable.schema}.${focusTable.name}`
          : focusTable.name;

        const centerNode: Node<TableNodeData> = {
          id: focusTable.name,
          type: "tableNode",
          position: { x: 300, y: 80 },
          data: { tableName: centerLabel, engine, columns: cols, isFocus: true },
        };

        const uniqueTargets = [...new Set(relations.map((r) => r.target_table))];
        const hasRel = uniqueTargets.length > 0;
        setHasRelations(hasRel);

        if (!hasRel) {
          if (!cancelled) {
            setNodes([centerNode]);
            setEdges([]);
            setLoading(false);
          }
          return;
        }

        Promise.all(
          uniqueTargets.map((tgt) =>
            invoke<ColumnInfo[]>("fetch_table_schema", {
              connectionId,
              tableName: tgt,
              schema: null,
            }).catch(() => [] as ColumnInfo[])
          )
        ).then((tgtColsArray) => {
          if (cancelled) return;

          const relatedNodes: Node<TableNodeData>[] = uniqueTargets.map((tgt, i) => ({
            id: tgt,
            type: "tableNode",
            position: { x: i * 290, y: 400 },
            data: { tableName: tgt, engine, columns: tgtColsArray[i] ?? [] },
          }));

          const builtEdges: Edge[] = relations.map((r, i) => ({
            id: `e-${i}`,
            source: r.source_table,
            target: r.target_table,
            label: `${r.source_column} → ${r.target_column}`,
            animated: false,
            style: { stroke: "var(--color-teal)", strokeWidth: 1.5, opacity: 0.85 },
            labelStyle: { fill: "#888", fontSize: 9, fontFamily: "JetBrains Mono, monospace" },
            labelBgStyle: { fill: "#1A1A1E", fillOpacity: 0.9 },
            markerEnd: {
              type: MarkerType.ArrowClosed,
              color: "var(--color-teal)",
              width: 14,
              height: 14,
            },
          }));

          setNodes([centerNode, ...relatedNodes]);
          setEdges(builtEdges);
        }).finally(() => {
          if (!cancelled) setLoading(false);
        });
      })
      .catch(() => {
        if (!cancelled) {
          setHasRelations(false);
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
    // setEdges/setNodes are stable React Flow setters
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connectionId, focusTable.name, focusTable.schema, engine]);

  if (loading) {
    return (
      <div className="sv">
        <div className="sv-loading">Loading relations…</div>
      </div>
    );
  }

  return (
    <div className="sv">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.3 }}
        minZoom={0.2}
        maxZoom={2.5}
        proOptions={{ hideAttribution: true }}
        nodesDraggable
        nodesConnectable={false}
        elementsSelectable
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={24}
          size={1}
          color="rgba(0,238,255,0.07)"
        />
        <Controls showInteractive={false} className="sv-controls" />
        {!hasRelations && (
          <Panel position="bottom-center">
            <span className="sv-no-relations">No relations detected for this table</span>
          </Panel>
        )}
      </ReactFlow>
    </div>
  );
}

// ── Public component ──────────────────────────────────────────────────────────

export function SchemaVisualizer({ engine, tables, columnMap, connectionId, focusTable }: SchemaVisualizerProps) {
  if (focusTable && connectionId) {
    return <RelationView connectionId={connectionId} focusTable={focusTable} engine={engine} />;
  }
  return (
    <FullSchemaView
      engine={engine}
      tables={tables}
      columnMap={columnMap}
      connectionId={connectionId}
    />
  );
}
