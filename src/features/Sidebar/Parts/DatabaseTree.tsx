import { useCallback, useEffect, useRef, useState } from "react";
import {
  ChevronRight, Table2, Eye, Layers, Hash, FileCode2, Zap,
  FolderTree, Users, Puzzle, BookA, Columns3, ListOrdered, Database,
  Folder, KeyRound, Link2, Fingerprint, ShieldCheck, Shapes, Package,
  Languages, GitBranch, Shield, ArrowLeftRight, Plug, Code2, Radio, Rss,
} from "lucide-react";
import { safeInvoke as invoke } from "@/shared/utils/ipc";
import { SkeletonRow } from "@/shared/ui/Skeleton";
import { useTreeStateStore, useNodeExpanded } from "@/store/treeStateStore";
import { useSavedConnections } from "@/shared/hooks/useSavedConnections";
import { useConnectionStore } from "@/store/connectionStore";
import { useWorkspaceStore } from "@/store/workspaceStore";
import { useUiStore } from "@/store/uiStore";
import { useToastStore } from "@/store/toastStore";
import { dbService } from "@/services/dbService";
import { useTreeKeyboardNav } from "@/shared/hooks/useTreeKeyboardNav";
import { ENGINE_COLORS } from "./utils";
import { TableContextMenu } from "./TableContextMenu";
import type { DbTreeNode } from "@/types/db";
import type { CatKind } from "./TableContextMenu";

/**
 * Layout-agnostic lazy catalog tree (Inversion of Control).
 *
 * The tree does NOT know whether it lives in the Unified or Split layout:
 * what happens when the user activates a node is entirely the parent's
 * decision via `onNodeClick` — Unified passes a handler that opens the node
 * in place; Split passes one that pushes the node id into global state for
 * another panel to consume. The tree only owns expansion + lazy fetching.
 *
 * Hierarchy pattern (pgAdmin-style): real catalog nodes come from the Rust
 * `get_node_children` router; the category level between them ("Tables",
 * "Constraints", …) is declarative — FOLDER SPECS below synthesize virtual
 * folder rows client-side that cost zero backend calls until expanded.
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
  trigger_function: Zap,
  function: FileCode2,
  procedure: FileCode2,
  type: Shapes,
  domain: Package,
  collation: Languages,
  constraint_pk: KeyRound,
  constraint_fk: Link2,
  constraint_unique: Fingerprint,
  constraint_check: ShieldCheck,
  rule: GitBranch,
  policy: Shield,
  fts_configuration: BookA,
  fts_dictionary: BookA,
  fts_parser: BookA,
  fts_template: BookA,
  cast: ArrowLeftRight,
  event_trigger: Zap,
  fdw: Plug,
  language: Code2,
  publication: Radio,
  subscription: Rss,
  role_login: Users,
  role_group: Users,
  extension: Puzzle,
};

function nodeIcon(type: string) {
  const Icon = NODE_ICONS[type] ?? Database;
  return <Icon size={11} className="sidebar-db-item-icon--muted" />;
}

// ── Folder specs ─────────────────────────────────────────────────
// A folder either fetches a backend node_type (scoped by the parent's id)
// or nests more folders. Purely declarative: add a line here + a match arm
// in postgres.rs to grow the tree.

interface FolderDef {
  label: string;
  fetch?: string;
  children?: FolderDef[];
}

const SCHEMA_FOLDERS: FolderDef[] = [
  { label: "Tables", fetch: "schema_tables" },
  { label: "Views", fetch: "schema_views" },
  { label: "Materialized Views", fetch: "schema_matviews" },
  { label: "Foreign Tables", fetch: "schema_foreign_tables" },
  { label: "Sequences", fetch: "schema_sequences" },
  { label: "Functions", fetch: "schema_functions" },
  { label: "Procedures", fetch: "schema_procedures" },
  { label: "Trigger Functions", fetch: "schema_trigger_functions" },
  { label: "Types", fetch: "schema_types" },
  { label: "Domains", fetch: "schema_domains" },
  { label: "Collations", fetch: "schema_collations" },
  {
    label: "Full Text Search",
    children: [
      { label: "Configurations", fetch: "fts_configurations" },
      { label: "Dictionaries", fetch: "fts_dictionaries" },
      { label: "Parsers", fetch: "fts_parsers" },
      { label: "Templates", fetch: "fts_templates" },
    ],
  },
];

const SQLITE_FOLDERS: FolderDef[] = [
  { label: "Tables", fetch: "schema_tables" },
  { label: "Views", fetch: "schema_views" },
  { label: "Indexes", fetch: "schema_indexes" },
  { label: "Triggers", fetch: "schema_triggers" },
];

const TABLE_FOLDERS: FolderDef[] = [
  { label: "Columns", fetch: "table_columns" },
  {
    label: "Constraints",
    children: [
      { label: "Primary Key", fetch: "table_constraints_pk" },
      { label: "Foreign Keys", fetch: "table_constraints_fk" },
      { label: "Unique", fetch: "table_constraints_unique" },
      { label: "Check", fetch: "table_constraints_check" },
    ],
  },
  { label: "Indexes", fetch: "table_indexes" },
  { label: "Triggers", fetch: "table_triggers" },
  { label: "Rules", fetch: "table_rules" },
  { label: "Policies", fetch: "table_policies" },
  { label: "Partitions", fetch: "table_partitions" },
];

/** Database-level containers under a connection root. */
const GLOBAL_FOLDERS: FolderDef[] = [
  { label: "Schemas", fetch: "schema_list" },
  { label: "Casts", fetch: "casts" },
  { label: "Event Triggers", fetch: "event_triggers" },
  { label: "Extensions", fetch: "extensions" },
  { label: "Foreign Data Wrappers", fetch: "fdws" },
  { label: "Languages", fetch: "languages" },
  { label: "Publications", fetch: "publications" },
  { label: "Subscriptions", fetch: "subscriptions" },
  { label: "Roles", fetch: "roles" },
];

/** Category folders shown when a real catalog node is expanded. */
const NODE_FOLDERS: Record<string, FolderDef[]> = {
  schema: SCHEMA_FOLDERS,
  table: TABLE_FOLDERS,
  foreign_table: TABLE_FOLDERS,
  view: [{ label: "Columns", fetch: "table_columns" }],
  matview: [
    { label: "Columns", fetch: "table_columns" },
    { label: "Indexes", fetch: "table_indexes" },
  ],
};

/** Direct (non-folder) child fetch for node types without categories. */
function childNodeType(node: DbTreeNode): string | null {
  switch (node.type) {
    case "role_group": return "role_members";
    default: return null;
  }
}

/** Derives the parent_id the backend expects for a node's children. */
function parentIdFor(node: DbTreeNode): string | null {
  // Composite ids are "<type>_<qualified name>" — strip the type prefix.
  const prefix = `${node.type}_`;
  return node.id.startsWith(prefix) ? node.id.slice(prefix.length) : node.id;
}

// ── Lazy fetch (shared by real nodes, folders and roots) ─────────
// Rehydration, not reset: children load whenever the node is expanded and
// data is missing — covers first expand AND remounts (layout switch,
// restart) where persisted expansion outlives the in-memory cache.
function useLazyChildren(
  enabled: boolean,
  sessionId: string,
  fetchType: string | null,
  parentId: string | null,
) {
  const [children, setChildren] = useState<DbTreeNode[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const reloadVersion = useConnectionStore((s) => s.reloadVersion);
  const prevReloadRef = useRef(reloadVersion);

  useEffect(() => {
    if (!enabled || !fetchType) return;
    // Invalidate cached children on reloadVersion change (e.g. DROP TABLE)
    if (prevReloadRef.current !== reloadVersion) {
      prevReloadRef.current = reloadVersion;
      setChildren(null);
      setLoading(false);
      setError(null);
      return;
    }
    if (children !== null || loading) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    invoke<DbTreeNode[]>("get_node_children", {
      instanceId: sessionId,
      nodeType: fetchType,
      parentNodeId: parentId,
    })
      .then((kids) => { if (!cancelled) setChildren(kids); })
      .catch((err) => { if (!cancelled) setError(String(err)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, children, loading, sessionId, fetchType, parentId, reloadVersion]);

  return { children, loading, error };
}

function TreeStatus({ depth, loading, error, empty }: { depth: number; loading: boolean; error: string | null; empty: boolean }) {
  const pad = { paddingLeft: 20 + depth * 12 };
  if (loading) return <><SkeletonRow indent={12 + depth * 12} /><SkeletonRow indent={12 + depth * 12} /></>;
  if (error) return <span className="sidebar-item-text sidebar-item-text--muted" style={{ ...pad, color: "var(--color-red)" }}>{error}</span>;
  if (empty) return <span className="sidebar-item-text sidebar-item-text--muted" style={pad}>(empty)</span>;
  return null;
}

interface DatabaseTreeProps {
  onNodeClick?: (node: DbTreeNode) => void;
}

// ── Virtual folder row ───────────────────────────────────────────
interface FolderRowProps {
  def: FolderDef;
  /** parent_id scope forwarded to the backend for this folder's fetch. */
  parentId: string | null;
  depth: number;
  sessionId: string;
  onNodeClick?: (node: DbTreeNode) => void;
}

function FolderRow({ def, parentId, depth, sessionId, onNodeClick }: FolderRowProps) {
  const stateId = `dbtree:${sessionId}:${parentId ?? "root"}:folder:${def.label}`;
  const expanded = useNodeExpanded(stateId);
  const { children, loading, error } = useLazyChildren(
    expanded && !def.children, sessionId, def.fetch ?? null, parentId,
  );

  const handleToggle = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    useTreeStateStore.getState().toggleNode(stateId);
  }, [stateId]);

  return (
    <div>
      <div
        className="sidebar-db-item"
        style={{ cursor: "pointer", padding: "3px 8px", paddingLeft: 8 + depth * 12 }}
        onClick={handleToggle}
        title={def.label}
        data-tree-item
        role="treeitem"
        tabIndex={-1}
        aria-expanded={def.fetch ? expanded : undefined}
      >
        <button
          className="sidebar-icon-btn"
          aria-label={expanded ? "Colapsar" : "Expandir"}
          tabIndex={-1}
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
        <Folder size={11} className="sidebar-db-item-icon--muted" />
        <span className="sidebar-db-item-name sidebar-db-item-name--xs">
          {def.label}
        </span>
      </div>

      {expanded && (
        <div>
          {def.children ? (
            def.children.map((sub) => (
              <FolderRow
                key={sub.label}
                def={sub}
                parentId={parentId}
                depth={depth + 1}
                sessionId={sessionId}
                onNodeClick={onNodeClick}
              />
            ))
          ) : (
            <>
              <TreeStatus depth={depth} loading={loading} error={error} empty={children?.length === 0} />
              {children?.map((child) => (
                <TreeNodeRow
                  key={child.id}
                  node={child}
                  depth={depth + 1}
                  sessionId={sessionId}
                  onNodeClick={onNodeClick}
                />
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ── Real catalog node row ────────────────────────────────────────
interface TreeNodeRowProps {
  node: DbTreeNode;
  depth: number;
  sessionId: string;
  onNodeClick?: (node: DbTreeNode) => void;
}

function TreeNodeRow({ node, depth, sessionId, onNodeClick }: TreeNodeRowProps) {
  const stateId = `dbtree:${sessionId}:${node.id}`;
  const expanded = useNodeExpanded(stateId);
  const folders = NODE_FOLDERS[node.type];
  const directType = folders ? null : childNodeType(node);
  const { children, loading, error } = useLazyChildren(
    expanded && !folders, sessionId, directType, parentIdFor(node),
  );

  const handleToggle = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    useTreeStateStore.getState().toggleNode(stateId);
  }, [stateId]);

  const canExpand = node.has_children && (!!folders || directType !== null);

  // ── Context menu (DDL operations) ─────────────────────────────
  const ctxKind = ["table", "view", "function", "procedure"].includes(node.type)
    ? (node.type as CatKind) : null;
  const pid = parentIdFor(node) ?? "";
  const ctxSchema = pid.includes(".") ? pid.split(".")[0] : null;
  const ctxName = pid.includes(".") ? pid.slice(pid.indexOf(".") + 1) : (node.label);

  const handleDrop = useCallback(() => {
    if (!sessionId || !ctxKind) return;
    const label = ctxSchema ? `"${ctxSchema}"."${ctxName}"` : `"${ctxName}"`;
    useUiStore.getState().setDangerDialog({
      message: `Drop ${ctxKind} "${label}"? This action cannot be undone.`,
      onConfirm: async () => {
        useUiStore.getState().setDangerDialog(null);
        try {
          if (ctxKind === "table") {
            await dbService.dropTable(sessionId, ctxName, ctxSchema);
          } else {
            const verb = ctxKind === "view" ? "VIEW" : ctxKind === "function" ? "FUNCTION" : "PROCEDURE";
            await dbService.runQuery(sessionId, `DROP ${verb} IF EXISTS ${label}`);
          }
          useToastStore.getState().info(`${ctxKind} "${label}" dropped`);
          useConnectionStore.getState().triggerReload();
        } catch (e: unknown) {
          const msg = e && typeof e === "object" && "message" in e
            ? String((e as { message: unknown }).message)
            : String(e);
          useToastStore.getState().error(msg);
        }
      },
    });
    useUiStore.getState().pushToRecents({
      type: "ddl",
      id: `ddl:drop:${sessionId}_${ctxName}`,
      label: `Drop ${ctxName}`,
      action: "drop",
      table: { name: ctxName, schema: ctxSchema },
    });
  }, [sessionId, ctxKind, ctxSchema, ctxName]);

  const handleTruncate = useCallback(() => {
    if (!sessionId || !ctxKind) return;
    const label = ctxSchema ? `"${ctxSchema}"."${ctxName}"` : `"${ctxName}"`;
    useUiStore.getState().setDangerDialog({
      message: `Truncate table "${label}"? ALL records will be deleted. This action cannot be undone.`,
      onConfirm: async () => {
        useUiStore.getState().setDangerDialog(null);
        try {
          await dbService.runQuery(sessionId, `TRUNCATE TABLE ${label}`);
          useToastStore.getState().info(`Table "${label}" truncated`);
          useConnectionStore.getState().triggerReload();
        } catch (e: unknown) {
          const msg = e && typeof e === "object" && "message" in e
            ? String((e as { message: unknown }).message)
            : String(e);
          useToastStore.getState().error(msg);
        }
      },
    });
    useUiStore.getState().pushToRecents({
      type: "ddl",
      id: `ddl:truncate:${sessionId}_${ctxName}`,
      label: `Truncate ${ctxName}`,
      action: "truncate",
      table: { name: ctxName, schema: ctxSchema },
    });
  }, [sessionId, ctxKind, ctxSchema, ctxName]);

  const row = (
    <div
      className="sidebar-db-item"
      style={{ cursor: "pointer", padding: "3px 8px", paddingLeft: 8 + depth * 12 }}
      onClick={() => onNodeClick?.(node)}
      title={node.label}
      data-tree-item
      role="treeitem"
      tabIndex={-1}
      aria-expanded={canExpand ? expanded : undefined}
    >
      {canExpand ? (
        <button
          className="sidebar-icon-btn"
          onClick={handleToggle}
          aria-label={expanded ? "Colapsar" : "Expandir"}
          tabIndex={-1}
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
        <span className="sidebar-db-item-spacer" />
      )}
      {nodeIcon(node.type)}
      <span className="sidebar-db-item-name sidebar-db-item-name--xs">
        {node.label}
      </span>
    </div>
  );

  return (
    <div>
      {ctxKind ? (
        <TableContextMenu
          item={{ name: ctxName, schema: ctxSchema, kind: ctxKind }}
          onViewStructure={ctxKind === "table" || ctxKind === "view"
            ? () => useWorkspaceStore.getState().openTableStructure({ name: ctxName, schema: ctxSchema })
            : undefined}
          onViewRelations={ctxKind === "table"
            ? () => useWorkspaceStore.getState().openTableRelations({ name: ctxName, schema: ctxSchema })
            : undefined}
          onDrop={handleDrop}
          onTruncate={ctxKind === "table" ? handleTruncate : undefined}
        >
          {row}
        </TableContextMenu>
      ) : (
        row
      )}

      {expanded && (
        <div>
          {folders ? (
            folders.map((def) => (
              <FolderRow
                key={def.label}
                def={def}
                parentId={parentIdFor(node)}
                depth={depth + 1}
                sessionId={sessionId}
                onNodeClick={onNodeClick}
              />
            ))
          ) : (
            <>
              <TreeStatus depth={depth} loading={loading} error={error} empty={children?.length === 0} />
              {children?.map((child) => (
                <TreeNodeRow
                  key={child.id}
                  node={child}
                  depth={depth + 1}
                  sessionId={sessionId}
                  onNodeClick={onNodeClick}
                />
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ── Connection root ──────────────────────────────────────────────
function ConnectionTreeRoot({
  conn,
  onNodeClick,
}: {
  conn: { id: string; name: string; engine: string };
  onNodeClick?: (node: DbTreeNode) => void;
}) {
  const stateId = `dbtree:conn:${conn.id}`;
  const expanded = useNodeExpanded(stateId);
  const isPostgres = /postgres/i.test(conn.engine ?? "");
  const isSqlite = /sqlite/i.test(conn.engine ?? "");
  // Only non-folder engines (not PG, not SQLite) fetch schema list directly
  const isFlat = !isPostgres && !isSqlite;
  const { children, loading, error } = useLazyChildren(
    expanded && isFlat, conn.id, "schema_list", null,
  );

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
        data-tree-item
        role="treeitem"
        tabIndex={-1}
        aria-expanded={expanded}
      >
        <button
          className="sidebar-icon-btn"
          aria-label={expanded ? "Colapsar" : "Expandir"}
          tabIndex={-1}
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
          className={`sidebar-db-item-icon sidebar-icon--${ENGINE_COLORS[conn.engine?.toLowerCase()] ?? "gray"}`}
        />
        <span className="sidebar-db-item-name sidebar-db-item-name--xs sidebar-db-item-name--bold">
          {conn.name}
        </span>
      </div>

      {expanded && (
        <div>
          {isPostgres ? (
            GLOBAL_FOLDERS.map((def) => (
              <FolderRow
                key={def.label}
                def={def}
                parentId={null}
                depth={1}
                sessionId={conn.id}
                onNodeClick={onNodeClick}
              />
            ))
          ) : isSqlite ? (
            SQLITE_FOLDERS.map((def) => (
              <FolderRow
                key={def.label}
                def={def}
                parentId={null}
                depth={1}
                sessionId={conn.id}
                onNodeClick={onNodeClick}
              />
            ))
          ) : (
            <>
              <TreeStatus depth={1} loading={loading} error={error} empty={children?.length === 0} />
              {children?.map((n) => (
                <TreeNodeRow key={n.id} node={n} depth={1} sessionId={conn.id} onNodeClick={onNodeClick} />
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}

export function DatabaseTree({ onNodeClick }: DatabaseTreeProps) {
  const { connections } = useSavedConnections();
  const { containerRef, handleKeyDown } = useTreeKeyboardNav({
    itemSelector: "[data-tree-item]",
    onActivate: (el) => { el.click(); },
  });

  return (
      <div
        ref={containerRef}
        className="sidebar-db-category-items"
        style={{ overflowY: "auto" }}
        role="tree"
        aria-label="Database objects"
        onKeyDown={handleKeyDown}
      >
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
