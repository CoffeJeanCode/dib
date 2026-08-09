import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import { isMac } from "@/shared/utils/platform";
import { useWorkspaceStore } from "@/store/workspaceStore";
import { useConnectionStore } from "@/store/connectionStore";
import {
  Search,
  Table2,
  FileText,
  Zap,
  Database,
  Trash2,
  Scissors,
  Edit3,
  ChevronLeft,
  Loader2,
  Eye,
  Activity,
  Network,
  Wrench,
  PlusSquare,
  Rows,
  MoreHorizontal,
} from "lucide-react";
import type { TableInfo, InternalScript } from "@/types/db";
import type { FsNode } from "@/types/workspace";
import { dbService } from "@/services/dbService";
import { workspaceService } from "@/services/workspaceService";
import { useDangerDialog } from "@/shared/hooks/useDangerDialog";
import { useArrowMenuNav } from "@/shared/hooks/useArrowMenuNav";
import { TableActionsMenu, type TableAction } from "@/shared/ui/TableActionsMenu";
import { Tooltip } from "@/shared/ui/Tooltip";
import { useToastStore } from "@/store/toastStore";
import { useUiStore } from "@/store/uiStore";
import "@/shared/ui/dialog-shared.css";
import "@/shared/ui/menu-shared.css";
import "./CommandPalette.css";

export function generateOrmAlias(tableName: string): string {
  return tableName
    .split("_")
    .filter(Boolean)
    .map((block) => block[0])
    .join("")
    .toLowerCase();
}

export interface CommandAction {
  id: string;
  label: string;
  onAction: () => void;
}

// "create" is not a sub-mode — it opens the wizard directly with no table picker
type DdlMode = "drop" | "truncate" | "rename" | "alter" | "insert" | null;

type DbObjectSubtype = "view" | "mat_view" | "function" | "procedure" | "trigger";

type PaletteItem =
  | { kind: "table"; id: string; label: string; table: TableInfo; matchedAlias?: string }
  | { kind: "script"; id: string; label: string; script: InternalScript }
  | { kind: "action"; id: string; label: string; onAction: () => void }
  | { kind: "database"; id: string; label: string; dbName: string }
  | {
      kind: "object";
      id: string;
      label: string;
      subtype: DbObjectSubtype;
      name: string;
      schema: string | null;
    }
  | { kind: "diagram"; id: string; label: string; table: TableInfo }
  | { kind: "ddl"; id: string; label: string; action: "alter" | "create" | "drop" | "truncate"; table: TableInfo }
  | { kind: "dml"; id: string; label: string; action: "insert"; table: TableInfo }
  | { kind: "wsfile"; id: string; label: string; path: string };

const OBJECT_ICON: Record<DbObjectSubtype, React.ReactNode> = {
  view: <Eye size={16} />,
  mat_view: <Eye size={16} />,
  function: <Zap size={16} />,
  procedure: <Zap size={16} />,
  trigger: <Activity size={16} />,
};

const OBJECT_TAG: Record<DbObjectSubtype, string> = {
  view: "view",
  mat_view: "mat",
  function: "fn",
  procedure: "proc",
  trigger: "trg",
};

const ITEM_ICON: Record<PaletteItem["kind"], React.ReactNode> = {
  table: <Table2 size={16} />,
  script: <FileText size={16} />,
  action: <Zap size={16} />,
  database: <Database size={16} />,
  object: <Eye size={16} />,
  diagram: <Network size={16} />,
  ddl: <Wrench size={16} />, // Render logic will override this based on action
  dml: <Rows size={16} />,
  wsfile: <FileText size={16} />,
};

const ITEM_CATEGORY: Record<PaletteItem["kind"], string> = {
  table: "Table",
  script: "Script",
  action: "Action",
  database: "Database",
  object: "DB Object",
  diagram: "ERD Diagram",
  ddl: "Structure",
  dml: "Data",
  wsfile: "Script",
};

function getPaletteItemIcon(
  item: PaletteItem,
  ddlMode: DdlMode,
  ddlModeIcon: React.ReactNode | undefined,
): React.ReactNode {
  if (ddlMode && item.kind === "table") return ddlModeIcon;
  if (item.kind === "object") return OBJECT_ICON[item.subtype];
  if (item.kind === "ddl") {
    return item.action === "create" ? <PlusSquare size={16} /> : <Wrench size={16} />;
  }
  return ITEM_ICON[item.kind];
}

type PaletteHintSegment = { keys: string[]; label: string };

function paletteHint(keys: string[], label: string): PaletteHintSegment {
  return { keys, label };
}

function PaletteKeyHint({
  segments,
  className,
}: {
  segments: PaletteHintSegment[];
  className?: string;
}) {
  return (
    <span className={className ? `palette-key-hint ${className}` : "palette-key-hint"}>
      {segments.map((seg, i) => (
        <React.Fragment key={`${seg.label}-${i}`}>
          {i > 0 && (
            <span className="palette-hint-sep" aria-hidden="true">
              |
            </span>
          )}
          <span className="palette-hint-group">
            {seg.keys.map((key, j) => (
              <React.Fragment key={j}>
                {j > 0 && (
                  <span className="palette-hint-plus" aria-hidden="true">
                    +
                  </span>
                )}
                <kbd className="palette-hint-kbd">{key}</kbd>
              </React.Fragment>
            ))}
            <span className="palette-hint-label">{seg.label}</span>
          </span>
        </React.Fragment>
      ))}
    </span>
  );
}

function getPaletteItemHint(item: PaletteItem, ddlMode: DdlMode): PaletteHintSegment[] {
  if (item.kind === "table" && !ddlMode) {
    return isMac
      ? [paletteHint(["⌥", "↵"], "ERD"), paletteHint(["⌃", "↵"], "Structure")]
      : [paletteHint(["Alt", "↵"], "ERD"), paletteHint(["Ctrl", "↵"], "Structure")];
  }
  return [];
}

const DDL_MODE_META: Record<
  NonNullable<DdlMode>,
  { label: string; icon: React.ReactNode; danger: boolean }
> = {
  drop: {
    label: "DROP TABLE",
    icon: <Trash2 size={14} />,
    danger: true,
  },
  truncate: {
    label: "TRUNCATE TABLE",
    icon: <Scissors size={14} />,
    danger: true,
  },
  rename: {
    label: "RENAME TABLE",
    icon: <Edit3 size={14} />,
    danger: false,
  },
  alter: {
    label: "ALTER TABLE",
    icon: <Wrench size={14} />,
    danger: false,
  },
  insert: {
    label: "INSERT ROW",
    icon: <PlusSquare size={14} />,
    danger: false,
  },
};

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  actions?: CommandAction[];
}

export function CommandPalette({ open, onClose, actions = [] }: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [baseItems, setBaseItems] = useState<PaletteItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [ddlMode, setDdlMode] = useState<DdlMode>(null);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const paletteRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuBtnRef = { current: null as HTMLButtonElement | null };
  const pointerActiveRef = useRef(false);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!menuOpenId) {
      setMenuPos(null);
      return;
    }
    const btn = menuBtnRef.current;
    if (!btn) return;
    const r = btn.getBoundingClientRect();
    const w = 150;
    const left = Math.max(4, r.right - w);
    setMenuPos({ top: r.bottom + 4, left });

    const close = (e: PointerEvent) => {
      if (!menuRef.current || menuRef.current.contains(e.target as Node)) return;
      if (!paletteRef.current || !paletteRef.current.contains(e.target as Node)) {
        setMenuOpenId(null);
      }
    };
    window.addEventListener("pointerdown", close);
    return () => window.removeEventListener("pointerdown", close);
  }, [menuOpenId]);

  const connectionId = useConnectionStore((s) => s.active?.activeId ?? null);
  const info = useToastStore((s) => s.info);
  const error = useToastStore((s) => s.error);
  const { handleDropTable, handleTruncateTable } = useDangerDialog(connectionId, info, error);
  const recentCommands = useUiStore((s) => s.recentCommands);
  const pushToRecents = useUiStore((s) => s.pushToRecents);

  const closeTableMenu = useCallback(() => {
    setMenuOpenId(null);
    inputRef.current?.focus();
  }, []);

  const handleTableMenuAction = useCallback(
    (action: TableAction, table: TableInfo) => {
      const itemId = menuOpenId ?? "";
      if (action === "structure") {
        useWorkspaceStore.getState().openTableStructure(table);
      } else if (action === "erd") {
        useWorkspaceStore.getState().openTableRelations(table);
        pushToRecents({
          type: "diagram",
          id: `diagram:${itemId}`,
          label: `Diagram: ${table.name}`,
          table,
        });
      } else if (action === "alter") {
        useUiStore.getState().setAlterTarget(table);
        pushToRecents({
          type: "ddl",
          id: `ddl:alter:${itemId}`,
          label: `Alter ${table.name}`,
          action: "alter",
          table,
        });
      } else if (action === "insert") {
        useWorkspaceStore.getState().setNavigateTo({ table, v: Date.now() } as any);
        useWorkspaceStore.getState().triggerInsertRow();
        pushToRecents({
          type: "dml",
          id: `dml:insert:${itemId}`,
          label: `Insert ${table.name}`,
          action: "insert",
          table,
        });
      } else if (action === "rename") {
        useUiStore.getState().setRenameTarget(table);
      } else if (action === "drop") {
        handleDropTable(table);
        pushToRecents({ type: "ddl", id: `ddl:drop:${menuOpenId}`, label: `Drop ${table.name}`, action: "drop", table });
      }
      setMenuOpenId(null);
      onClose();
    },
    [menuOpenId, pushToRecents, handleDropTable, onClose],
  );

  const handleMenuKeyDown = useArrowMenuNav({
    // portal mounts only once menuPos is measured — key on both so the
    // first item gets focused on the commit where the menu actually exists
    openKey: menuOpenId && menuPos ? menuOpenId : null,
    menuRef,
    itemSelector: ".ui-menu-item",
    onClose: closeTableMenu,
  });

  useEffect(() => {
    if (!resultsRef.current) return;
    const el = resultsRef.current.querySelector(`[data-palette-index="${selectedIndex}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  useEffect(() => {
    if (!open) {
      setDdlMode(null);
      setBaseItems([]);
      return;
    }
    previousFocusRef.current = document.activeElement as HTMLElement | null;
    const store = useUiStore.getState();
    const initQuery = store.paletteInitialQuery ?? "";
    const initDdlMode = store.paletteInitialDdlMode as DdlMode | null;
    useUiStore.setState({ paletteInitialQuery: null, paletteInitialDdlMode: null });
    setQuery(initQuery);
    if (initDdlMode) setDdlMode(initDdlMode);
    setSelectedIndex(0);
    setLoading(true);
    setBaseItems([]);
    requestAnimationFrame(() => inputRef.current?.focus());

    const next: PaletteItem[] = [];
    const loaders: Promise<void>[] = [];

    // Scripts are not fetched into local state — they're read live from
    // useWorkspaceStore (single source of truth shared with the Sidebar).
    // Just make sure the store has the latest data.
    workspaceService
      .getInternalScripts()
      .then((scripts) => useWorkspaceStore.getState().setInternalScripts(scripts))
      .catch(console.error);

    // Standalone virtual scripts live in virtual_scripts keyed by the STABLE
    // saved-connection id — same source the Sidebar tree reads, so both stay
    // in sync. Inside a workspace the sidebar shows disk files instead, so
    // the palette mirrors that and skips virtual scripts (see wsFileItems).
    const savedId = useConnectionStore.getState().active?.savedId;
    if (savedId && !useWorkspaceStore.getState().activeWorkspacePath) {
      workspaceService
        .getVirtualScripts(savedId)
        .then((rows) =>
          setVirtualScripts(
            rows.map((r) => ({
              id: r.id,
              title: r.name,
              content: r.content ?? "",
              created_at: r.created_at ?? "",
              updated_at: r.updated_at ?? "",
              connection_id: r.connection_id,
            })),
          ),
        )
        .catch(() => setVirtualScripts([]));
    } else {
      setVirtualScripts([]);
    }

    if (connectionId) {
      loaders.push(
        dbService
          .listDatabases(connectionId)
          .then((dbs) => {
            for (const db of dbs) {
              next.push({ kind: "database", id: `db:${db}`, label: db, dbName: db });
            }
          })
          .catch(() => {}),
      );
      loaders.push(
        dbService
          .fetchSchemaObjects(connectionId)
          .then((obj) => {
            for (const t of obj.tables ?? []) {
              const label = t.schema ? `${t.schema}.${t.name}` : t.name;
              next.push({ kind: "table", id: `t:${label}`, label, table: t });
            }
            const pushObj = (
              subtype: DbObjectSubtype,
              items: { name: string; schema?: string | null }[],
            ) => {
              for (const it of items) {
                const label = it.schema ? `${it.schema}.${it.name}` : it.name;
                next.push({
                  kind: "object",
                  id: `obj:${subtype}:${label}`,
                  label,
                  subtype,
                  name: it.name,
                  schema: it.schema ?? null,
                });
              }
            };
            pushObj("view", obj.views ?? []);
            pushObj("mat_view", obj.materialized_views ?? []);
            pushObj("function", obj.functions ?? []);
            pushObj("procedure", obj.procedures ?? []);

            for (const t of obj.triggers ?? []) {
              const label = t.schema ? `${t.schema}.${t.trigger_name}` : t.trigger_name;
              const uniqueId = `obj:trigger:${label}:${t.table_name}`;
              next.push({
                kind: "object",
                id: uniqueId,
                label: `${label} on ${t.table_name}`,
                subtype: "trigger",
                name: t.trigger_name,
                schema: t.schema ?? null,
              });
            }
          })
          .catch(() => {}),
      );
    }

    Promise.all(loaders).then(() => {
      setBaseItems([...next]);
      setLoading(false);
    });
  }, [open, connectionId]);

  // Single source of truth: same array Sidebar reads, kept live via scriptVersion.
  const internalScripts = useWorkspaceStore((s) => s.internalScripts);
  const [virtualScripts, setVirtualScripts] = useState<InternalScript[]>([]);

  // Workspace files (.sql on disk) — same tree the Sidebar renders. Content
  // is read lazily on select via readTextFile, mirroring Sidebar's onNodeClick.
  const workspaceTree = useWorkspaceStore((s) => s.workspaceTree);
  const activeWorkspacePath = useWorkspaceStore((s) => s.activeWorkspacePath);
  const wsFileItems = useMemo<PaletteItem[]>(() => {
    if (!activeWorkspacePath || !workspaceTree) return [];
    const out: PaletteItem[] = [];
    const walk = (n: FsNode) => {
      if (n.isDir || n.is_dir) {
        (n.children ?? []).forEach(walk);
        return;
      }
      out.push({ kind: "wsfile", id: `f:${n.path}`, label: n.name, path: n.path });
    };
    (workspaceTree.children ?? []).forEach(walk);
    return out;
  }, [activeWorkspacePath, workspaceTree]);

  const scriptItems = useMemo<PaletteItem[]>(
    () => [
      ...wsFileItems,
      ...(activeWorkspacePath ? [] : virtualScripts).map((s) => ({
        kind: "script" as const,
        id: `s:${s.id}`,
        label: s.title,
        script: s,
      })),
      ...internalScripts.map((s) => ({
        kind: "script" as const,
        id: `s:${s.id}`,
        label: s.title,
        script: s,
      })),
    ],
    [internalScripts, virtualScripts, wsFileItems, activeWorkspacePath],
  );

  const enterDdlMode = useCallback((mode: NonNullable<DdlMode>) => {
    setDdlMode(mode);
    setQuery("");
    setSelectedIndex(0);
    pointerActiveRef.current = false;
    requestAnimationFrame(() => inputRef.current?.focus());
  }, []);

  // DDL static actions — built-in, appear under > prefix and in suggestions
  const ddlActionItems = useMemo<PaletteItem[]>(
    () =>
      connectionId
        ? [
            {
              kind: "action",
              id: "ddl:drop",
              label: "Drop Table…",
              onAction: () => enterDdlMode("drop"),
            },
            {
              kind: "action",
              id: "ddl:truncate",
              label: "Truncate Table…",
              onAction: () => enterDdlMode("truncate"),
            },
            {
              kind: "action",
              id: "ddl:rename",
              label: "Rename Table…",
              onAction: () => enterDdlMode("rename"),
            },
            {
              kind: "action",
              id: "ddl:alter",
              label: "Alter Table…",
              onAction: () => enterDdlMode("alter"),
            },
            {
              kind: "action",
              id: "ddl:create",
              label: "Create Table…",
              onAction: () => {
                useUiStore.getState().setCreateTarget({ name: "", schema: null });
                onClose();
              },
            },
            {
              kind: "action",
              id: "dml:insert",
              label: "Insert Row…",
              onAction: () => enterDdlMode("insert"),
            },
          ]
        : [],
    [connectionId, enterDdlMode],
  );

  const matchTables = useCallback((items: PaletteItem[], q: string): PaletteItem[] => {
    const qLower = q.toLowerCase();
    const aliasMatches: PaletteItem[] = [];
    const textMatches: PaletteItem[] = [];
    for (const item of items) {
      if (item.kind !== "table") continue;
      const alias = generateOrmAlias(item.table.name);
      if (alias === qLower) aliasMatches.push({ ...item, matchedAlias: alias });
      else if (item.label.toLowerCase().includes(qLower)) textMatches.push(item);
    }
    return [...aliasMatches, ...textMatches];
  }, []);

  const filtered = useMemo<PaletteItem[]>(() => {
    // DDL sub-mode: show only tables with ORM search
    if (ddlMode) {
      const pool = baseItems.filter((i) => i.kind === "table");
      const q = query.trim().toLowerCase();
      return q ? matchTables(pool, q) : pool;
    }

    const actionItems: PaletteItem[] = [
      ...actions.map((a) => ({
        kind: "action" as const,
        id: `a:${a.id}`,
        label: a.label,
        onAction: a.onAction,
      })),
      ...ddlActionItems,
    ];

    const q = query.trim();
    if (!q) {
      const recent = recentCommands
        .map((rc) => {
          if (rc.type === "action") return actionItems.find((a) => a.id === rc.id);
          if (rc.type === "table")
            return baseItems.find((b) => b.kind === "table" && b.id === rc.id);
          if (rc.type === "script") return scriptItems.find((s) => s.id === rc.id);
          if (rc.type === "wsfile") return scriptItems.find((s) => s.id === rc.id);
          if (rc.type === "database")
            return baseItems.find((b) => b.kind === "database" && b.id === rc.id);
          if (rc.type === "object")
            return baseItems.find((b) => b.kind === "object" && b.id === rc.id);
          if (rc.type === "diagram")
            return { kind: "diagram", id: rc.id, label: rc.label, table: rc.table };
          if (rc.type === "ddl")
            return { kind: "ddl", id: rc.id, label: rc.label, action: rc.action, table: rc.table };
          if (rc.type === "dml")
            return { kind: "dml", id: rc.id, label: rc.label, action: rc.action, table: rc.table };
          return null;
        })
        .filter(Boolean) as PaletteItem[];

      if (recent.length > 0) return recent;
      return connectionId
        ? [...actionItems, ...baseItems.filter((i) => i.kind === "table")].slice(0, 5)
        : [...actionItems, ...scriptItems].slice(0, 5);
    }

    const symbol = q[0];
    const rest = q.slice(1).toLowerCase().trim();

    if (symbol === ">") {
      const pool = [...actionItems];
      return rest ? pool.filter((i) => i.label.toLowerCase().includes(rest)) : pool;
    }
    if (symbol === "@") {
      const pool = baseItems.filter((i) => i.kind === "database");
      return rest ? pool.filter((i) => i.label.toLowerCase().includes(rest)) : pool;
    }
    if (symbol === "#") {
      return rest ? scriptItems.filter((i) => i.label.toLowerCase().includes(rest)) : scriptItems;
    }
    if (symbol === "%") {
      const pool = baseItems.filter((i) => i.kind === "object");
      return rest
        ? pool.filter(
            (i) =>
              i.label.toLowerCase().includes(rest) ||
              (i.kind === "object" && OBJECT_TAG[i.subtype].includes(rest)),
          )
        : pool;
    }

    // No prefix → tables with ORM alias priority
    return matchTables(baseItems, q);
  }, [query, baseItems, scriptItems, actions, ddlActionItems, ddlMode, matchTables]);

  useEffect(() => {
    setSelectedIndex(0);
    setMenuOpenId(null);
  }, [query, ddlMode]);

  const execute = useCallback(
    async (item: PaletteItem) => {
      // DDL mode-switch actions stay open
      if (item.kind === "action" && item.id.startsWith("ddl:")) {
        item.onAction();
        return;
      }

      // DDL sub-mode table selection
      if (ddlMode && item.kind === "table") {
        if (ddlMode === "drop") {
          handleDropTable(item.table);
          pushToRecents({ type: "ddl", id: `ddl:drop:${item.id}`, label: `Drop ${item.table.name}`, action: "drop", table: item.table });
        }
        if (ddlMode === "truncate") {
          handleTruncateTable(item.table);
          pushToRecents({ type: "ddl", id: `ddl:truncate:${item.id}`, label: `Truncate ${item.table.name}`, action: "truncate", table: item.table });
        }
        if (ddlMode === "rename")
          useUiStore.getState().setRenameTarget(item.table);
        if (ddlMode === "alter") {
          useUiStore.getState().setAlterTarget(item.table);
          pushToRecents({
            type: "ddl",
            id: `ddl:alter:${item.id}`,
            label: `Alter ${item.table.name}`,
            action: "alter",
            table: item.table,
          });
        }
        if (ddlMode === "insert") {
          useWorkspaceStore.getState().setNavigateTo({ table: item.table, v: Date.now() } as any);
          useWorkspaceStore.getState().triggerInsertRow();
          pushToRecents({
            type: "dml",
            id: `dml:insert:${item.id}`,
            label: `Insert ${item.table.name}`,
            action: "insert",
            table: item.table,
          });
        }
        onClose();
        return;
      }

      if (item.kind === "diagram") {
        useWorkspaceStore.getState().openTableRelations(item.table);
        pushToRecents({ type: "diagram", id: item.id, label: item.label, table: item.table });
        onClose();
        return;
      }

      if (item.kind === "ddl" && item.action === "alter") {
        useUiStore.getState().setAlterTarget(item.table);
        pushToRecents({
          type: "ddl",
          id: item.id,
          label: item.label,
          action: item.action,
          table: item.table,
        });
        onClose();
        return;
      }

      if (item.kind === "ddl" && (item.action === "drop" || item.action === "truncate")) {
        if (item.action === "drop") handleDropTable(item.table);
        else handleTruncateTable(item.table);
        pushToRecents({ type: "ddl", id: item.id, label: item.label, action: item.action, table: item.table });
        onClose();
        return;
      }

      if (item.kind === "ddl" && item.action !== "alter") {
        useToastStore.getState().warn(`Unknown DDL action: "${item.action}"`);
        onClose();
        return;
      }

      if (item.kind === "dml" && item.action === "insert") {
        useWorkspaceStore.getState().setNavigateTo({ table: item.table, v: Date.now() } as any);
        useWorkspaceStore.getState().triggerInsertRow();
        pushToRecents({
          type: "dml",
          id: item.id,
          label: item.label,
          action: item.action,
          table: item.table,
        });
        onClose();
        return;
      }

      if (item.kind === "table") {
        useWorkspaceStore.getState().setNavigateTo({ table: item.table, v: Date.now() } as any);
        pushToRecents({ type: "table", id: item.id, label: item.label, table: item.table });
      } else if (item.kind === "wsfile") {
        // Disk file — read lazily, same flow as Sidebar's onNodeClick.
        workspaceService
          .readTextFile(item.path)
          .then((content) =>
            useWorkspaceStore
              .getState()
              .setOpenScript({ sql: content, name: item.label, id: item.path, v: Date.now() }),
          )
          .catch((e) => useToastStore.getState().error(`Failed to read file: ${String(e)}`));
        pushToRecents({ type: "wsfile", id: item.id, label: item.label, path: item.path });
      } else if (item.kind === "script") {
        useWorkspaceStore.getState().setOpenScript({
          sql: item.script.content,
          name: item.script.title,
          id: item.script.id,
          v: Date.now(),
        } as any);
        pushToRecents({ type: "script", id: item.id, label: item.label, script: item.script });
      } else if (item.kind === "database") {
        useConnectionStore.getState().switchDatabase(item.dbName);
        pushToRecents({ type: "database", id: item.id, label: item.label, dbName: item.dbName });
      } else if (item.kind === "object" && connectionId) {
        const { subtype, name, schema } = item;
        const fetcher =
          subtype === "view" || subtype === "mat_view"
            ? dbService.getViewDdl(connectionId, name, schema)
            : subtype === "function"
              ? dbService.getFunctionDdl(connectionId, name, schema)
              : subtype === "procedure"
                ? dbService.getFunctionDdl(connectionId, name, schema)
                : subtype === "trigger"
                  ? dbService.getTriggerDdl(connectionId, name, schema)
                  : Promise.resolve({ ddl: "" });
        fetcher
          .then((res) =>
            useWorkspaceStore.getState().setOpenScript({
              sql: res.ddl,
              name: `${OBJECT_TAG[subtype]}·${name}`,
              id: `obj-${item.id}`,
              v: Date.now(),
            } as any),
          )
          .catch(() => {});
        pushToRecents({ type: "object", id: item.id, label: item.label, subtype, name, schema });
      } else if (item.kind === "action") {
        item.onAction();
        pushToRecents({ type: "action", id: item.id, label: item.label });
      }
      onClose();
    },
    [ddlMode, handleDropTable, handleTruncateTable, connectionId, onClose, pushToRecents],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (menuOpenId) {
        if (e.key === "ArrowLeft" || e.key === "Escape") {
          e.preventDefault();
          setMenuOpenId(null);
          inputRef.current?.focus();
        }
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        pointerActiveRef.current = false;
        setSelectedIndex((i) => Math.min(i + 1, filtered.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        pointerActiveRef.current = false;
        setSelectedIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter" && e.altKey && filtered[selectedIndex]?.kind === "table") {
        // Alt+Enter → open ERD for focused table
        e.preventDefault();
        const item = filtered[selectedIndex] as {
          kind: "table";
          id: string;
          label: string;
          table: TableInfo;
        };
        useWorkspaceStore.getState().openTableRelations(item.table);
        pushToRecents({
          type: "diagram",
          id: `diagram:${item.id}`,
          label: `Diagram: ${item.table.name}`,
          table: item.table,
        });
        onClose();
      } else if (
        e.key === "ArrowRight" &&
        !menuOpenId &&
        filtered[selectedIndex]?.kind === "table"
      ) {
        e.preventDefault();
        setMenuOpenId(filtered[selectedIndex].id);
      } else if (e.key === "ArrowLeft" && menuOpenId) {
        e.preventDefault();
        setMenuOpenId(null);
      } else if (
        e.key === "Enter" &&
        (e.ctrlKey || e.metaKey) &&
        filtered[selectedIndex]?.kind === "table"
      ) {
        useWorkspaceStore.getState().openTableStructure(filtered[selectedIndex].table!);
        onClose();
      } else if (e.key === "Enter" && filtered[selectedIndex]) {
        execute(filtered[selectedIndex]);
      }
    },
    [filtered, selectedIndex, execute, ddlMode, menuOpenId, onClose, pushToRecents],
  );

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (ddlMode) {
        setDdlMode(null);
        setQuery("");
      } else onClose();
    };
    window.addEventListener("keydown", handler);
    return () => {
      window.removeEventListener("keydown", handler);
      // Restore focus to the element that was focused before the palette opened.
      // Skip if a modal was triggered from the palette (danger dialog, rename, etc.)
      // Skip too when the action opened a script/table tab (openScript/navigateTo
      // still pending in the store at cleanup time) — the tab-activation focus
      // in QueryPanel owns focus then, and restoring here would steal it back.
      const s = useUiStore.getState();
      const ws = useWorkspaceStore.getState();
      const navigated = ws.openScript || ws.navigateTo;
      if (!navigated && !s.alterTarget && !s.renameTarget && !s.dbAction && !s.dangerDialog) {
        const prev = previousFocusRef.current;
        if (prev && document.contains(prev)) {
          prev.focus({ preventScroll: true });
        } else {
          // Direct focus, not focusWithRetry: a retry call would cancel a
          // pending editor-focus request via the generation counter.
          document.getElementById("dib-main-panel")?.focus();
        }
      }
    };
  }, [open, ddlMode, onClose]);

  if (!open) return null;

  const isEmpty = query.trim() === "" && !ddlMode;
  const currentDdlMeta = ddlMode ? DDL_MODE_META[ddlMode] : null;

  return (
    <div className="dialog-backdrop palette-backdrop" onClick={onClose}>
      <div ref={paletteRef} className="palette" onClick={(e) => e.stopPropagation()}>
        {/* DDL sub-mode indicator */}
        {ddlMode && currentDdlMeta && (
          <div
            className={`palette-ddl-bar${currentDdlMeta.danger ? " palette-ddl-bar--danger" : " palette-ddl-bar--alter"}`}
          >
            <button
              className="palette-ddl-back"
              onClick={() => {
                setDdlMode(null);
                setQuery("");
              }}
              title="Back (Esc)"
            >
              <ChevronLeft size={14} />
            </button>
            <span className="palette-ddl-icon">{currentDdlMeta.icon}</span>
            <span className="palette-ddl-label">{currentDdlMeta.label}</span>
            <PaletteKeyHint
              className="palette-ddl-hint"
              segments={[
                paletteHint([], "type to filter"),
                paletteHint(["↑↓"], "navigate"),
                paletteHint(["↵"], "apply"),
              ]}
            />
          </div>
        )}

        <div className="palette-input-wrap">
          <Search size={16} className="palette-input-icon" />
          <input
            ref={inputRef}
            className="palette-input"
            type="text"
            placeholder={
              ddlMode
                ? "Filter tables…"
                : connectionId
                  ? "Tables · > actions · @ db · # scripts · % views/fn/triggers"
                  : "> actions · # scripts"
            }
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
          />
        </div>

        <div className="palette-results" ref={resultsRef}>
          {loading ? (
            <div className="palette-empty">
              <Loader2 size={16} className="palette-spinner" />
              <span>Loading…</span>
            </div>
          ) : filtered.length === 0 ? (
            <div className="palette-empty">No results</div>
          ) : (
            filtered.map((item, i) => {
              const isRecentView = !ddlMode && isEmpty && recentCommands.length > 0;
              const prevItem = i > 0 ? filtered[i - 1] : null;
              const showHeader = ddlMode
                ? i === 0
                : isRecentView
                  ? i === 0
                  : !prevItem || prevItem.kind !== item.kind;
              const headerText = ddlMode
                ? "TABLES"
                : isRecentView
                  ? "RECENT"
                  : isEmpty
                    ? "SUGGESTIONS"
                    : ITEM_CATEGORY[item.kind].toUpperCase();

              const hintSegments = getPaletteItemHint(item, ddlMode);
              const isSelected = i === selectedIndex;

              const isDdlAction = item.kind === "action" && item.id.startsWith("ddl:");
              const isDangerItem = ddlMode === "drop" || ddlMode === "truncate";

              const isTableItem = item.kind === "table" && !!connectionId;

              return (
                <React.Fragment key={item.id}>
                  {showHeader && <div className="palette-group-header">{headerText}</div>}
                  <Tooltip
                    content={
                      hintSegments.length > 0 ? <PaletteKeyHint segments={hintSegments} /> : null
                    }
                  >
                    <div
                      data-palette-index={i}
                      className={[
                        "palette-item",
                        isSelected ? "palette-item--selected" : "",
                        isDangerItem && item.kind === "table" ? "palette-item--danger" : "",
                        isDdlAction ? "palette-item--ddl" : "",
                        isTableItem && !ddlMode ? "palette-item--table" : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                      onClick={(e) => {
                        if (item.kind === "table" && item.table) {
                          if (e.altKey) {
                            useWorkspaceStore.getState().openTableRelations(item.table);
                            pushToRecents({
                              type: "diagram",
                              id: `diagram:${item.id}`,
                              label: `Diagram: ${item.table.name}`,
                              table: item.table,
                            });
                            onClose();
                            return;
                          }
                          if (e.ctrlKey || e.metaKey) {
                            useWorkspaceStore.getState().openTableStructure(item.table);
                            onClose();
                            return;
                          }
                        }
                        execute(item);
                      }}
                      onPointerMove={() => {
                        pointerActiveRef.current = true;
                        setSelectedIndex(i);
                        if (menuOpenId && menuOpenId !== item.id) setMenuOpenId(null);
                      }}
                    >
                      <span
                        className={`palette-item-icon${item.kind === "action" || item.kind === "database" ? " palette-item-icon--action" : ""}`}
                      >
                        {getPaletteItemIcon(item, ddlMode, currentDdlMeta?.icon)}
                      </span>
                      <span className="palette-item-label">
                        <span className="palette-item-label-text">{item.label}</span>
                        {item.kind === "table" && (item as any).matchedAlias && (
                          <span className="palette-item-alias">{(item as any).matchedAlias}</span>
                        )}
                      </span>
                      {isTableItem && !ddlMode && (
                        <span
                          className="palette-table-actions"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            ref={(el) => {
                              if (el && menuOpenId === item.id) menuBtnRef.current = el;
                            }}
                            className="palette-table-action-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              menuBtnRef.current = e.currentTarget;
                              setMenuOpenId(menuOpenId === item.id ? null : item.id);
                            }}
                            title="More actions"
                          >
                            <MoreHorizontal size={14} />
                          </button>
                        </span>
                      )}
                    </div>
                  </Tooltip>
                </React.Fragment>
              );
            })
          )}
        </div>

        {filtered.length > 0 && (
          <div className="palette-footer">
            <PaletteKeyHint
              className="palette-footer-hints"
              segments={[
                paletteHint(["↑↓"], "navigate"),
                paletteHint(["↵"], "select"),
                paletteHint(["esc"], ddlMode ? "back" : "close"),
              ]}
            />
          </div>
        )}
      </div>

      {menuOpenId &&
        menuPos &&
        (() => {
          const item = filtered.find((f) => f.id === menuOpenId);
          if (!item || item.kind !== "table") return null;
          return createPortal(
            <TableActionsMenu
              menuRef={menuRef}
              className="palette-table-menu"
              style={{ top: menuPos.top, left: menuPos.left }}
              table={item.table}
              onAction={handleTableMenuAction}
              onKeyDown={handleMenuKeyDown}
            />,
            document.body,
          );
        })()}
    </div>
  );
}
