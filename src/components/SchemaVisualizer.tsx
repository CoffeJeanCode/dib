import { useMemo, useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Panel,
  useNodesState,
  useEdgesState,
  MarkerType,
  type Node,
  type Edge,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { TableNode, type TableNodeData } from "./TableNode";
import type { TableInfo, ColumnInfo, TableRelation } from "../types/db";
import "./SchemaVisualizer.css";

const nodeTypes = { tableNode: TableNode };

export interface SchemaVisualizerProps {
  engine: string;
  tables: { name: string; schema?: string | null }[];
  columnMap: Record<string, { name: string; data_type: string; is_primary_key: boolean }[]>;
  connectionId?: string;
  focusTable?: TableInfo;
}

// ── Full-schema mode (existing behaviour) ────────────────────────────────────

function FullSchemaView({
  engine,
  tables,
  columnMap,
}: Pick<SchemaVisualizerProps, "engine" | "tables" | "columnMap">) {
  const cols = 3;
  const nodeW = 220;
  const nodeH = 180;
  const gapX = 40;
  const gapY = 40;

  const initialNodes = useMemo<Node<TableNodeData>[]>(
    () =>
      tables.map((t, i) => ({
        id: t.name,
        type: "tableNode",
        position: {
          x: (i % cols) * (nodeW + gapX),
          y: Math.floor(i / cols) * (nodeH + gapY),
        },
        data: {
          tableName: t.schema ? `${t.schema}.${t.name}` : t.name,
          engine,
          columns: columnMap[t.name] ?? [],
        },
      })),
    [tables, columnMap, engine],
  );

  const [nodes] = useNodesState(initialNodes);

  return (
    <div className="sv">
      <ReactFlow
        nodes={nodes}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.2}
        maxZoom={2}
        proOptions={{ hideAttribution: true }}
        nodesDraggable
        nodesConnectable={false}
        elementsSelectable={false}
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="rgba(128,128,128,0.15)" />
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
          data: { tableName: centerLabel, engine, columns: cols },
        };

        const uniqueTargets = [...new Set(relations.map((r) => r.target_table))];
        setHasRelations(uniqueTargets.length > 0);

        const relatedNodes: Node<TableNodeData>[] = uniqueTargets.map((tgt, i) => ({
          id: tgt,
          type: "tableNode",
          position: { x: i * 280, y: 400 },
          data: { tableName: tgt, engine, columns: [] },
        }));

        const builtEdges: Edge[] = relations.map((r, i) => ({
          id: `e-${i}`,
          source: r.source_table,
          target: r.target_table,
          label: `${r.source_column} → ${r.target_column}`,
          markerEnd: { type: MarkerType.ArrowClosed },
        }));

        setNodes([centerNode, ...relatedNodes]);
        setEdges(builtEdges);
      })
      .catch(() => {
        if (!cancelled) setHasRelations(false);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [connectionId, focusTable.name, focusTable.schema, engine]);

  if (loading) {
    return (
      <div className="sv">
        <div className="sv-loading">Cargando relaciones…</div>
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
        maxZoom={2}
        proOptions={{ hideAttribution: true }}
        nodesDraggable
        nodesConnectable={false}
        elementsSelectable={false}
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="rgba(128,128,128,0.15)" />
        {!hasRelations && (
          <Panel position="bottom-center">
            <span className="sv-no-relations">No hay relaciones detectadas para esta tabla</span>
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
  return <FullSchemaView engine={engine} tables={tables} columnMap={columnMap} />;
}
