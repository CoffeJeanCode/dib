import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { useDatabases } from "@/shared/hooks/useDatabases";
import { ENGINE_COLORS } from "./utils";
import { TableContextMenu } from "./TableContextMenu";
import { ColumnList } from "./ColumnList";
import type { DbTreeNode, TableInfo, ColumnInfo } from "@/types/db";
import type { CatKind } from "./TableContextMenu";

/** Extract { name, schema } from a catalog node's id. */
function tableInfoFromNode(node: DbTreeNode): TableInfo {
  const prefix = `${node.type}_`;
  const raw = node.id.startsWith(prefix) ? node.id.slice(prefix.length) : node.id;
  const dot = raw.indexOf(".");
  if (dot !== -1) {
    return { name: raw.slice(dot + 1), schema: raw.slice(0, dot) };
  }
  return { name: raw, schema: null };
}

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

const NODE_COLORS: Record<string, string> = {
  table: "#60a5fa",
  foreign_table: "#60a5fa",
  view: "#a78bfa",
  matview: "#a78bfa",
  function: "#fbbf24",
  trigger_function: "#fbbf24",
  procedure: "#34d399",
  trigger: "#f87171",
  sequence: "#f59e0b",
  index: "#f59e0b",
  constraint_pk: "#f59e0b",
  type: "#a78bfa",
  domain: "#a78bfa",
  constraint_fk: "#60a5fa",
  constraint_unique: "#a78bfa",
  constraint_check: "#f87171",
  policy: "#f87171",
  event_trigger: "#f87171",
};

function nodeIcon(type: string) {
  const Icon = NODE_ICONS[type] ?? Database;
  const color = NODE_COLORS[type];
  return color
    ? <Icon size={11} style={{ color }} className="sidebar-db-item-icon" />
    : <Icon size={11} className="sidebar-db-item-icon--muted" />;
}

/** Map a folder's fetch type to a node type so FolderRow gets the right icon/color. */
function fetchNodeType(fetch: string): string {
  switch (fetch) {
    case "schema_tables":          return "table";
    case "schema_views":           return "view";
    case "schema_foreign_tables":  return "foreign_table";
    case "schema_sequences":       return "sequence";
    case "schema_functions":       return "function";
    case "schema_procedures":      return "procedure";
    case "schema_trigger_functions": return "trigger_function";
    case "schema_types":           return "type";
    case "schema_domains":         return "domain";
    case "fts_configurations":     return "fts_configuration";
    case "fts_dictionaries":       return "fts_dictionary";
    case "fts_parsers":            return "fts_parser";
    case "fts_templates":          return "fts_template";
    case "roles":                  return "role_login";
    case "casts":                  return "cast";
    case "extensions":             return "extension";
    case "fdws":                   return "fdw";
    case "languages":              return "language";
    case "publications":           return "publication";
    case "subscriptions":          return "subscription";
    case "event_triggers":         return "event_trigger";
    case "table_columns":          return "column";
    case "table_indexes":          return "index";
    case "table_triggers":         return "trigger";
    case "table_rules":            return "rule";
    case "table_policies":         return "policy";
    case "table_partitions":       return "table";
    case "table_constraints_pk":   return "constraint_pk";
    case "table_constraints_fk":   return "constraint_fk";
    case "table_constraints_unique": return "constraint_unique";
    case "table_constraints_check": return "constraint_check";
    default: return fetch;
  }
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
  {
    label: "Full-Text Search",
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

/** Root-level siblings shown under the connection node (advance mode). */
const CONFIG_FOLDERS: FolderDef[] = [
  { label: "Casts", fetch: "casts" },
  { label: "Extensions", fetch: "extensions" },
  { label: "FDWs", fetch: "fdws" },
  { label: "Languages", fetch: "languages" },
  { label: "Publications", fetch: "publications" },
  { label: "Subscriptions", fetch: "subscriptions" },
  { label: "Event Triggers", fetch: "event_triggers" },
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
  const hasFetchedRef = useRef(false);
  const reloadVersion = useConnectionStore((s) => s.reloadVersion);
  const prevReloadRef = useRef(reloadVersion);
  const fetchingRef = useRef(false);

  const fetch = useCallback(() => {
    if (!sessionId || !fetchType) return;
    let cancelled = false;
    fetchingRef.current = true;
    hasFetchedRef.current = true;
    setLoading(true);
    setError(null);
    invoke<DbTreeNode[]>("get_node_children", {
      instanceId: sessionId,
      nodeType: fetchType,
      parentNodeId: parentId,
    })
      .then((kids) => { if (!cancelled) setChildren(kids); })
      .catch((err) => { if (!cancelled) setError(String(err)); })
      .finally(() => { if (!cancelled) { setLoading(false); fetchingRef.current = false; } });
    return () => { cancelled = true; fetchingRef.current = false; };
  }, [sessionId, fetchType, parentId]);

  const retry = useCallback(() => {
    setChildren(null);
    setError(null);
    hasFetchedRef.current = false;
  }, []);

  useEffect(() => {
    if (!enabled || !fetchType) return;
    if (prevReloadRef.current !== reloadVersion) {
      prevReloadRef.current = reloadVersion;
      setChildren(null);
      setLoading(false);
      setError(null);
      hasFetchedRef.current = false;
    } else if (hasFetchedRef.current || fetchingRef.current) {
      return;
    }
    fetch();
    // NOTE: loading/children deliberately omitted to avoid re-render -> cancel loops.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, sessionId, fetchType, parentId, reloadVersion, fetch]);

  return { children, loading, error, retry };
}

function TreeStatus({ depth, loading, error, empty, onRetry }: { depth: number; loading: boolean; error: string | null; empty: boolean; onRetry?: () => void }) {
  const pad = { paddingLeft: 20 + depth * 12 };
  if (loading) return <><SkeletonRow indent={12 + depth * 12} /><SkeletonRow indent={12 + depth * 12} /></>;
  if (error) return <span className="sidebar-item-text sidebar-item-text--muted" style={{ ...pad, color: "var(--color-red)" }}>{error}</span>;
  if (empty) return (
    <span
      className="sidebar-item-text sidebar-item-text--muted"
      style={{ ...pad, cursor: onRetry ? "pointer" : undefined }}
      onClick={onRetry}
      title={onRetry ? "Click to retry" : undefined}
    >
      {onRetry ? "(empty — click to retry)" : "(empty)"}
    </span>
  );
  return null;
}

/** Parse parentId like "public.users" into { schema: "public", tableName: "users" } */
function parseTableRef(parentId: string | null): { tableName: string; schema: string | null } | null {
  if (!parentId) return null;
  const dot = parentId.indexOf(".");
  if (dot === -1) return { tableName: parentId, schema: null };
  return { tableName: parentId.slice(dot + 1), schema: parentId.slice(0, dot) || null };
}

/** Renders a list of columns in a folder, fetched via fetch_table_schema. */
function ColumnsContent({ sessionId, parentId }: { sessionId: string; parentId: string | null }) {
  const [columns, setColumns] = useState<ColumnInfo[] | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const tableRef = useMemo(() => parseTableRef(parentId), [parentId]);

  useEffect(() => {
    if (!sessionId || !tableRef) return;
    setLoading(true);
    dbService.fetchTableSchema(sessionId, tableRef.tableName, tableRef.schema)
      .then(setColumns)
      .catch(() => setColumns([]))
      .finally(() => setLoading(false));
  }, [sessionId, tableRef]);

  return <ColumnList columns={columns} loading={loading} />;
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
  const { children, loading, error, retry } = useLazyChildren(
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
        data-depth={depth}
        role="treeitem"
        tabIndex={-1}
        aria-expanded={def.fetch || def.children ? expanded : undefined}
      >
        <button
          className="sidebar-icon-btn"
          aria-label={expanded ? "Collapse" : "Expand"}
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
        {def.fetch ? nodeIcon(fetchNodeType(def.fetch)) : <Folder size={11} className="sidebar-db-item-icon--muted" />}
        <span className="sidebar-db-item-name sidebar-db-item-name--sm">
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
          ) : def.fetch === "table_columns" ? (
            <ColumnsContent sessionId={sessionId} parentId={parentId} />
          ) : (
            <>
              <TreeStatus depth={depth} loading={loading} error={error} empty={children?.length === 0} onRetry={retry} />
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
  const { children, loading, error, retry } = useLazyChildren(
    expanded && !folders, sessionId, directType, parentIdFor(node),
  );

  const handleToggle = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    useTreeStateStore.getState().toggleNode(stateId);
  }, [stateId]);

  const canExpand = !!folders || (node.has_children && directType !== null);

  // ── Context menu (DDL operations) ─────────────────────────────
  const ctxKind = ["table", "view", "function", "procedure"].includes(node.type)
    ? (node.type as CatKind) : null;
  const tableInfo = tableInfoFromNode(node);

  const handleDrop = useCallback(() => {
    if (!sessionId || !ctxKind) return;
    const { name, schema } = tableInfo;
    const label = schema ? `"${schema}"."${name}"` : `"${name}"`;
    useUiStore.getState().setDangerDialog({
      message: `Drop ${ctxKind} "${label}"? This action cannot be undone.`,
      onConfirm: async () => {
        useUiStore.getState().setDangerDialog(null);
        try {
          if (ctxKind === "table") {
            await dbService.dropTable(sessionId, name, schema);
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
      id: `ddl:drop:${sessionId}_${name}`,
      label: `Drop ${name}`,
      action: "drop",
      table: { name, schema },
    });
  }, [sessionId, ctxKind, tableInfo]);

  const handleTruncate = useCallback(() => {
    if (!sessionId || !ctxKind) return;
    const { name, schema } = tableInfo;
    const label = schema ? `"${schema}"."${name}"` : `"${name}"`;
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
      id: `ddl:truncate:${sessionId}_${name}`,
      label: `Truncate ${name}`,
      action: "truncate",
      table: { name, schema },
    });
  }, [sessionId, ctxKind, tableInfo]);

  const row = (
    <div
      className="sidebar-db-item"
      style={{ cursor: "pointer", padding: "3px 8px", paddingLeft: 8 + depth * 12 }}
      onClick={() => onNodeClick?.(node)}
      title={node.label}
      data-tree-item
      data-depth={depth}
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
        <span className="sidebar-db-item-name sidebar-db-item-name--sm">
        {node.label}
      </span>
    </div>
  );

  return (
    <div>
      {ctxKind ? (
        <TableContextMenu
          item={{ name: tableInfo.name, schema: tableInfo.schema, kind: ctxKind }}
          onViewStructure={ctxKind === "table" || ctxKind === "view"
            ? () => useWorkspaceStore.getState().openTableStructure({ name: tableInfo.name, schema: tableInfo.schema })
            : undefined}
          onViewRelations={ctxKind === "table"
            ? () => useWorkspaceStore.getState().openTableRelations({ name: tableInfo.name, schema: tableInfo.schema })
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
              <TreeStatus depth={depth} loading={loading} error={error} empty={children?.length === 0} onRetry={retry} />
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

// ── Database node (under connection) ──────────────────────────────
function DatabaseNode({
  name,
  sessionId,
  isActive,
  onNodeClick,
}: {
  name: string;
  sessionId: string;
  isActive: boolean;
  onNodeClick?: (node: DbTreeNode) => void;
}) {
  const stateId = `dbtree:db:${sessionId}:${name}`;
  const expanded = useNodeExpanded(stateId);

  const { children: schemas, loading, error, retry } = useLazyChildren(
    expanded && isActive, sessionId, "schema_list", null,
  );

  // Auto-expand public schema when schemas load
  useEffect(() => {
    if (!schemas || !isActive) return;
    const pub = schemas.find((s) => s.label === "public");
    if (pub) {
      useTreeStateStore.getState().setNode(`dbtree:${sessionId}:${pub.id}`, true);
    }
  }, [schemas, sessionId, isActive]);

  const handleToggle = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isActive) {
      useConnectionStore.getState().switchDatabase(name);
    }
    useTreeStateStore.getState().toggleNode(stateId);
  }, [name, isActive]);

  return (
    <div>
      <div
        className={`sidebar-db-item${isActive ? " sidebar-db-tree-item--active" : ""}`}
        style={{ cursor: "pointer", padding: "3px 8px", paddingLeft: 20 }}
        onClick={handleToggle}
        title={name}
        data-tree-item
        data-depth="2"
        role="treeitem"
        tabIndex={-1}
        aria-expanded={isActive ? expanded : undefined}
      >
        <button
          className="sidebar-icon-btn"
          aria-label={expanded ? "Collapse" : "Expand"}
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
        <Database size={11} className="sidebar-db-item-icon" />
        <span className="sidebar-db-item-name sidebar-db-item-name--sm">
          {name}
        </span>
        {isActive && <span className="sidebar-db-tree-item-dot" aria-hidden>●</span>}
      </div>

      {expanded && isActive && (
        <div>
          <TreeStatus depth={2} loading={loading} error={error} empty={schemas?.length === 0} onRetry={retry} />
          {schemas?.map((n) => (
            <TreeNodeRow key={n.id} node={n} depth={2} sessionId={sessionId} onNodeClick={onNodeClick} />
          ))}
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
  // Map saved connection id → active runtime session id so backend finds the driver
  const active = useConnectionStore((s) => s.active);
  const sessionId = active && active.savedId === conn.id ? active.activeId : conn.id;
  const activeDbName = active && active.savedId === conn.id ? active.name : null;

  // List databases under the connection
  const { databases, loading: dbsLoading } = useDatabases(expanded ? sessionId : null);

  const isFlat = !isPostgres && !isSqlite;
  const { children: flatSchemas, loading: flatLoading, error: flatError, retry: retryFlat } = useLazyChildren(
    expanded && isFlat, sessionId, "schema_list", null,
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
        data-depth="1"
        role="treeitem"
        tabIndex={-1}
        aria-expanded={expanded}
      >
        <button
          className="sidebar-icon-btn"
          aria-label={expanded ? "Collapse" : "Expand"}
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
        <span className="sidebar-db-item-name sidebar-db-item-name--sm sidebar-db-item-name--bold">
          {conn.name}
        </span>
      </div>

      {expanded && (
        <div>
          {isPostgres ? (
            <>
              {dbsLoading ? (
                <>
                  <SkeletonRow indent={12} />
                  <SkeletonRow indent={12} />
                </>
              ) : databases.length === 0 ? (
                <div className="sidebar-db-tree-item sidebar-db-tree-item--empty">No databases</div>
              ) : (
                databases.map((db) => (
                  <DatabaseNode
                    key={db}
                    name={db}
                    sessionId={sessionId}
                    isActive={db === activeDbName}
                    onNodeClick={onNodeClick}
                  />
                ))
              )}
              <FolderRow def={{ label: "Users & Roles", fetch: "roles" }} parentId={null} depth={1} sessionId={sessionId} onNodeClick={onNodeClick} />
              <FolderRow def={{ label: "Configuration", children: CONFIG_FOLDERS }} parentId={null} depth={1} sessionId={sessionId} onNodeClick={onNodeClick} />
            </>
          ) : isSqlite ? (
            SQLITE_FOLDERS.map((def) => (
              <FolderRow key={def.label} def={def} parentId={null} depth={1} sessionId={sessionId} onNodeClick={onNodeClick} />
            ))
          ) : (
            <>
              <TreeStatus depth={1} loading={flatLoading} error={flatError} empty={flatSchemas?.length === 0} onRetry={retryFlat} />
              {flatSchemas?.map((n) => (
                <TreeNodeRow key={n.id} node={n} depth={1} sessionId={sessionId} onNodeClick={onNodeClick} />
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
