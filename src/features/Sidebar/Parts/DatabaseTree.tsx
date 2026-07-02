import { useCallback, useEffect, useState } from "react";
import {
  ChevronRight, Table2, Eye, Layers, Hash, FileCode2, Zap,
  FolderTree, Users, Puzzle, BookA, Columns3, ListOrdered, Database,
} from "lucide-react";
import { safeInvoke as invoke } from "@/utils/ipc";
import { useTreeStateStore, useNodeExpanded } from "@/store/treeStateStore";
import type { DbTreeNode } from "@/types/db";

/**
 * Layout-agnostic lazy catalog tree (Inversion of Control).
 *
 * The tree does NOT know whether it lives in the Unified or Split layout:
 * what happens when the user activates a node is entirely the parent's
 * decision via `onNodeClick` — Unified passes a handler that opens the node
 * in place; Split passes one that pushes the node id into global state for
 * another panel to consume. The tree only owns expansion + lazy fetching.
 *
 * Children come from the Rust `get_node_children` router on first expand.
 * Expansion state lives in useTreeStateStore (`dbtree:` namespace), so it
 * survives layout switches and panel remounts.
 */

const NODE_ICONS: Record<string, typeof Table2> = {
  schema: FolderTree,
  table: Table2,
  view: Eye,
  matview: Layers,
  foreign_table: Table2,
  sequence: ListOrdered,
  column: Columns3,
  index: Hash,
  trigger: Zap,
  function: FileCode2,
  procedure: FileCode2,
  fts_dictionary: BookA,
  role_login: Users,
  role_group: Users,
  extension: Puzzle,
};

function nodeIcon(type: string) {
  const Icon = NODE_ICONS[type] ?? Database;
  return <Icon size={11} style={{ flexShrink: 0, opacity: 0.65, color: "var(--color-text-tertiary)" }} />;
}

/** Maps a node to the node_type its children are requested with. */
function childNodeType(node: DbTreeNode): string | null {
  switch (node.type) {
    case "schema": return "schema_tables";
    case "table":
    case "foreign_table": return "table_columns";
    case "view":
    case "matview": return "table_columns";
    case "role_group": return "role_members";
    default: return null;
  }
}

interface DatabaseTreeProps {
  onNodeClick?: (node: DbTreeNode) => void;
}

interface TreeNodeRowProps {
  node: DbTreeNode;
  depth: number;
  sessionId: string;
  onNodeClick?: (node: DbTreeNode) => void;
}

function TreeNodeRow({ node, depth, sessionId, onNodeClick }: TreeNodeRowProps) {
  const stateId = `dbtree:${sessionId}:${node.id}`;
  const expanded = useNodeExpanded(stateId);
  const [children, setChildren] = useState<DbTreeNode[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Rehydration, not reset: children load whenever the node is expanded and
  // data is missing — covers first expand AND remounts (layout switch,
  // restart) where persisted expansion outlives the in-memory cache.
  useEffect(() => {
    const type = childNodeType(node);
    if (!expanded || children !== null || loading || !type) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    invoke<DbTreeNode[]>("get_node_children", {
      instanceId: sessionId,
      nodeType: type,
      parentNodeId: parentIdFor(node),
    })
      .then((kids) => { if (!cancelled) setChildren(kids); })
      .catch((err) => { if (!cancelled) setError(String(err)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expanded, children, sessionId, node.id]);

  const handleToggle = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    useTreeStateStore.getState().toggleNode(stateId);
  }, [stateId]);

  const canExpand = node.has_children && childNodeType(node) !== null;

  return (
    <div>
      <div
        className="sidebar-db-item"
        style={{ cursor: "pointer", padding: "3px 8px", paddingLeft: 8 + depth * 12 }}
        onClick={() => onNodeClick?.(node)}
        title={node.label}
      >
        {canExpand ? (
          <button
            className="sidebar-icon-btn"
            onClick={handleToggle}
            aria-label={expanded ? "Colapsar" : "Expandir"}
            style={{ padding: 0, width: 14, height: 14, display: "flex", alignItems: "center" }}
          >
            <ChevronRight
              size={10}
              style={{
                transition: "transform var(--transition-fast, 0.15s)",
                transform: expanded ? "rotate(90deg)" : undefined,
              }}
            />
          </button>
        ) : (
          <span style={{ width: 14, flexShrink: 0 }} />
        )}
        {nodeIcon(node.type)}
        <span className="sidebar-db-item-name" style={{ fontSize: "var(--font-size-xs)" }}>
          {node.label}
        </span>
      </div>

      {expanded && (
        <div>
          {loading && (
            <span className="sidebar-item-text sidebar-item-text--muted" style={{ paddingLeft: 20 + depth * 12 }}>
              Loading…
            </span>
          )}
          {error && (
            <span className="sidebar-item-text sidebar-item-text--muted" style={{ paddingLeft: 20 + depth * 12, color: "var(--color-red)" }}>
              {error}
            </span>
          )}
          {children?.map((child) => (
            <TreeNodeRow
              key={child.id}
              node={child}
              depth={depth + 1}
              sessionId={sessionId}
              onNodeClick={onNodeClick}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/** Derives the parent_id the backend expects for a node's children. */
function parentIdFor(node: DbTreeNode): string | null {
  // Composite ids are "<type>_<qualified name>" — strip the type prefix.
  const prefix = `${node.type}_`;
  return node.id.startsWith(prefix) ? node.id.slice(prefix.length) : node.id;
}

import { useSavedConnections } from "@/hooks/useSavedConnections";
import { ENGINE_COLORS } from "./utils";

function ConnectionTreeRoot({
  conn,
  onNodeClick
}: {
  conn: { id: string; name: string; engine: string };
  onNodeClick?: (node: DbTreeNode) => void;
}) {
  const stateId = `dbtree:conn:${conn.id}`;
  const expanded = useNodeExpanded(stateId);
  const [roots, setRoots] = useState<DbTreeNode[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Same rehydration contract as TreeNodeRow: persisted expansion triggers
  // a (re)fetch on mount, so open connections fill back in after remounts.
  useEffect(() => {
    if (!expanded || roots !== null || loading) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    invoke<DbTreeNode[]>("get_node_children", {
      instanceId: conn.id,
      nodeType: "schema_list",
      parentNodeId: null,
    })
      .then((r) => { if (!cancelled) setRoots(r); })
      .catch((err) => { if (!cancelled) setError(String(err)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expanded, roots, conn.id]);

  const handleToggle = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    useTreeStateStore.getState().toggleNode(stateId);
  }, [stateId]);

  return (
    <div>
      <div
        className="sidebar-db-item"
        style={{ cursor: "pointer", padding: "3px 8px", paddingLeft: 8 }}
        onClick={handleToggle}
        title={conn.name}
      >
        <button
          className="sidebar-icon-btn"
          aria-label={expanded ? "Colapsar" : "Expandir"}
          style={{ padding: 0, width: 14, height: 14, display: "flex", alignItems: "center", marginRight: 4 }}
        >
          <ChevronRight
            size={10}
            style={{
              transition: "transform var(--transition-fast, 0.15s)",
              transform: expanded ? "rotate(90deg)" : undefined,
            }}
          />
        </button>
        <Database
          size={11}
          style={{ flexShrink: 0, opacity: 0.75 }}
          className={`sidebar-icon--${ENGINE_COLORS[conn.engine?.toLowerCase()] ?? "gray"}`}
        />
        <span className="sidebar-db-item-name" style={{ fontSize: "var(--font-size-xs)", fontWeight: 500 }}>
          {conn.name}
        </span>
      </div>
      
      {expanded && (
        <div>
          {loading && (
            <span className="sidebar-item-text sidebar-item-text--muted" style={{ paddingLeft: 32 }}>
              Loading…
            </span>
          )}
          {error && (
            <span className="sidebar-item-text sidebar-item-text--muted" style={{ paddingLeft: 32, color: "var(--color-red)" }}>
              {error}
            </span>
          )}
          {roots?.map((n) => (
            <TreeNodeRow key={n.id} node={n} depth={1} sessionId={conn.id} onNodeClick={onNodeClick} />
          ))}
        </div>
      )}
    </div>
  );
}

export function DatabaseTree({ onNodeClick }: DatabaseTreeProps) {
  const { connections } = useSavedConnections();

  return (
    <div className="sidebar-db-category-items" style={{ overflowY: "auto" }}>
      {connections.length === 0 ? (
        <div className="sidebar-item sidebar-item--empty">
          <span className="sidebar-item-text sidebar-item-text--muted">No connections</span>
        </div>
      ) : (
        connections.map((conn) => (
          <ConnectionTreeRoot key={conn.id} conn={conn} onNodeClick={onNodeClick} />
        ))
      )}
    </div>
  );
}
