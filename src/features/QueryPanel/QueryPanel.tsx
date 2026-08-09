import { useState, useEffect, useMemo, useCallback, useRef, lazy, Suspense } from "react";
import { useUiStore } from "@/store/uiStore";
import { useConnectionStore } from "@/store/connectionStore";
import { useWorkspaceStore } from "@/store/workspaceStore";
import { workspaceService } from "@/services/workspaceService";
import { useDatabaseEngine, DEFAULT_PAGE_SIZE } from "@/shared/hooks/useDatabaseEngine";
import { useWorkspaceService } from "@/shared/hooks/useWorkspaceService";
import { useKeybindings } from "@/shared/hooks/useKeybindings";
import { useDangerDialog } from "@/shared/hooks/useDangerDialog";
import { useArrowMenuNav } from "@/shared/hooks/useArrowMenuNav";
import { focusWithRetry, FOCUS_SELECTORS } from "@/shared/utils/focusMain";
import { TableActionsMenu, type TableAction } from "@/shared/ui/TableActionsMenu";
import { Braces, Layers, MoreHorizontal, Wand2 } from "lucide-react";
import type { TableInfo, PagedResult, PendingChange, GridFilter, OrderBy } from "@/types/db";
import type { TabData, TabPayload } from "@/features/QueryPanel/Tab";
import { TableStructureView } from "@/features/TableStructure/TableStructureView";
import { DataGrid } from "@/features/DataGrid";
import { CommitFooter } from "@/features/QueryPanel/CommitFooter";
import { TabBar } from "@/features/QueryPanel/TabBar";
import { TrailBreadcrumb } from "@/features/QueryPanel/TrailBreadcrumb";
import { PageSizeSelect } from "@/features/QueryPanel/PageSizeSelect";
import { UnsavedChangesDialog } from "@/shared/ui/UnsavedChangesDialog";
import { EmptyWorkspaceState } from "@/features/QueryPanel/EmptyWorkspaceState";
import { SaveAsDialog } from "@/features/QueryPanel/SaveAsDialog";
import { Skeleton } from "@/shared/ui/Skeleton";
import { useToastStore } from "@/store/toastStore";
import {
  type TrailNode,
  trailNode,
  tableLabel,
  pushTrail,
  syncTrail,
  validTrailIdx,
} from "@/features/QueryPanel/trail";

const SchemaVisualizer = lazy(() =>
  import("@/features/SchemaVisualizer").then((m) => ({ default: m.SchemaVisualizer })),
);
const MockGenerator = lazy(() =>
  import("@/features/MockGenerator/MockGenerator").then((m) => ({ default: m.MockGenerator })),
);
// Monaco is ~3.8 MB of JS. Static-importing it here made every launch parse the
// whole editor before the first table could render, even for a session that
// never opens a script. Loaded on first script tab instead.
const SqlEditor = lazy(() =>
  import("@/features/SqlEditor").then((m) => ({ default: m.SqlEditor })),
);
import "@/shared/ui/menu-shared.css";
import "./QueryPanel.css";

function fmtErr(e: unknown): string {
  if (typeof e === "string") return e;
  if (e && typeof e === "object") {
    const o = e as Record<string, unknown>;
    return String(o.message ?? o.error ?? o.msg ?? JSON.stringify(e));
  }
  return "Unknown error";
}

interface TableTabState {
  table: TableInfo;
  result: PagedResult | null;
  loading: boolean;
  error: string | null;
  filters: GridFilter[];
  orderBy: OrderBy | null;
  offset: number;
  pendingChanges: PendingChange[];
  primaryKeyColumn: string;
  pageSize: number;
  // Relational breadcrumbs: FK hops taken inside this tab. Always ≥1 node.
  trail: TrailNode[];
  trailIdx: number;
}

function defaultTableTabState(table: TableInfo, initialFilters: GridFilter[] = []): TableTabState {
  return {
    table,
    trail: [trailNode(table, initialFilters)],
    trailIdx: 0,
    result: null,
    loading: false,
    error: null,
    filters: [],
    orderBy: null,
    offset: 0,
    pendingChanges: [],
    primaryKeyColumn: "",
    pageSize: DEFAULT_PAGE_SIZE,
  };
}

// Snapshot the live view into the node we are leaving, so back/forward
// restores the filters and sort the user actually had there.
function syncedTrail(ts: TableTabState): TrailNode[] {
  return syncTrail(ts.trail, ts.trailIdx, { filters: ts.filters, orderBy: ts.orderBy });
}

function tableTabId(table: TableInfo): string {
  return `tab-table-${table.schema ?? "pub"}-${table.name}`;
}

// Per-scope (connection+database) tab snapshots. MainContent remounts
// QueryPanel when scopeKey changes; this cache restores each scope's tab set
// on return. Persisted as JSON to localStorage (same pattern as
// treeStateStore) so tabs survive app restarts. Table data is NOT cached:
// restored table tabs re-fetch on activation.
type ScopeSnapshot = { tabs: TabData[]; activeTabId: string; tabSql: Record<string, string> };

const LS_SCOPE_TABS_KEY = "dib_scope_tabs";

function loadScopeTabCache(): Map<string, ScopeSnapshot> {
  try {
    const raw = localStorage.getItem(LS_SCOPE_TABS_KEY);
    return new Map(raw ? Object.entries(JSON.parse(raw) as Record<string, ScopeSnapshot>) : []);
  } catch {
    return new Map();
  }
}

const scopeTabCache = loadScopeTabCache();

// Debounced: tabSql updates on every editor keystroke.
let persistScopeTabsTimer: number | undefined;
function persistScopeTabCache() {
  window.clearTimeout(persistScopeTabsTimer);
  persistScopeTabsTimer = window.setTimeout(() => {
    try {
      localStorage.setItem(LS_SCOPE_TABS_KEY, JSON.stringify(Object.fromEntries(scopeTabCache)));
    } catch {
      // quota exceeded — tab restore is best-effort
    }
  }, 500);
}

interface QueryPanelProps {
  connectionId: string;
  connectionName: string;
  engine?: string;
  scopeKey?: string;
  navigateTo?: { table: TableInfo; v: number } | null;
  openScript?: import("@/types/workspace").OpenScript | null;
}

export function QueryPanel({
  connectionId,
  connectionName,
  engine,
  scopeKey,
  navigateTo,
  openScript,
}: QueryPanelProps) {
  const toast = useToastStore.getState();
  const info = useToastStore((s) => s.info);
  const error = useToastStore((s) => s.error);
  const { handleDropTable } = useDangerDialog(connectionId, info, error);

  const [actionsOpen, setActionsOpen] = useState(false);
  const actionsRef = useRef<HTMLDivElement>(null);
  const actionsBtnRef = useRef<HTMLButtonElement>(null);

  const closeActions = useCallback(() => {
    setActionsOpen(false);
    actionsBtnRef.current?.focus();
  }, []);

  const handleActionsMenuKeyDown = useArrowMenuNav({
    openKey: actionsOpen,
    menuRef: actionsRef,
    itemSelector: ".ui-menu-item",
    onClose: closeActions,
  });

  useEffect(() => {
    if (!actionsOpen) return;
    const close = (e: PointerEvent) => {
      if (actionsRef.current?.contains(e.target as Node)) return;
      if (actionsBtnRef.current?.contains(e.target as Node)) return;
      setActionsOpen(false);
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setActionsOpen(false);
    };
    window.addEventListener("pointerdown", close);
    window.addEventListener("keydown", esc);
    return () => {
      window.removeEventListener("pointerdown", close);
      window.removeEventListener("keydown", esc);
    };
  }, [actionsOpen]);

  const handleTableAction = useCallback(
    (action: TableAction, table: TableInfo) => {
      setActionsOpen(false);
      if (action === "structure") useWorkspaceStore.getState().openTableStructure(table);
      else if (action === "erd") useWorkspaceStore.getState().openTableRelations(table);
      else if (action === "alter")
        useUiStore.getState().setAlterTarget(table);
      else if (action === "insert") {
        useWorkspaceStore.getState().setNavigateTo({ table, v: Date.now() } as any);
        useWorkspaceStore.getState().triggerInsertRow();
      } else if (action === "rename")
        useUiStore.getState().setRenameTarget(table);
      else if (action === "drop") handleDropTable(table);
    },
    [handleDropTable],
  );

  // ── Engine: tables, columns, relations, data fetching, commits ─────────
  const {
    tables,
    columnMap,
    tableRelations,
    fetchTablePage,
    loadTableRelations,
    loadColumnsBatch,
    commitChanges,
  } = useDatabaseEngine(connectionId);

  // ── Tab lifecycle state ────────────────────────────────────────────────
  const scopeSnapshot = scopeKey ? scopeTabCache.get(scopeKey) : undefined;
  const [tabs, setTabs] = useState<TabData[]>(scopeSnapshot?.tabs ?? []);
  const tabsRef = useRef(tabs);
  tabsRef.current = tabs;

  const [activeTabId, setActiveTabId] = useState(scopeSnapshot?.activeTabId ?? "");
  const closedTabsHistoryRef = useRef<Array<{ tab: TabData; sql?: string }>>([]);

  const [tableTabStates, setTableTabStates] = useState<Record<string, TableTabState>>({});
  const [committing, setCommitting] = useState<string | null>(null);
  const [isReloading, setIsReloading] = useState(false);
  const [closingTabId, setClosingTabId] = useState<string | null>(null);
  const [isClosingAll, setIsClosingAll] = useState(false);
  const [saveAsTabId, setSaveAsTabId] = useState<string | null>(null);
  const [saveAsName, setSaveAsName] = useState("");
  const [closeAfterSaveAs, setCloseAfterSaveAs] = useState(false);

  // ── Workspace: script persistence, tab SQL buffer ──────────────────────
  const markTabDirty = useCallback((tabId: string) => {
    setTabs((prev) => prev.map((t) => (t.id === tabId ? { ...t, isDirty: true } : t)));
  }, []);

  const markTabClean = useCallback((tabId: string) => {
    setTabs((prev) => prev.map((t) => (t.id === tabId ? { ...t, isDirty: false } : t)));
  }, []);

  const {
    tabSql,
    registerTabSql,
    removeTabSql,
    saveSqlTab,
    saveNewScript,
    persistContentChange,
    importScript,
  } = useWorkspaceService({
    tabsRef,
    markTabClean,
    setTabs,
    connectionId,
    initialTabSql: scopeSnapshot?.tabSql,
  });

  const tabSqlRef = useRef(tabSql);
  tabSqlRef.current = tabSql;

  // Write-through: keep this scope's snapshot current so a remount (db or
  // connection switch) or app restart restores exactly what the user left.
  useEffect(() => {
    if (!scopeKey) return;
    // strip autoRun — a restored tab must never re-execute its query
    const snapTabs = tabs.map((t) =>
      t.payload.autoRun ? { ...t, payload: { ...t.payload, autoRun: undefined } } : t,
    );
    scopeTabCache.set(scopeKey, { tabs: snapTabs, activeTabId, tabSql });
    persistScopeTabCache();
  }, [scopeKey, tabs, activeTabId, tabSql]);

  // ── Focus management ───────────────────────────────────────────────────
  useEffect(() => {
    if (isReloading) return;
    // Retry-based: on a fresh mount (db/connection switch) Monaco's textarea
    // isn't in the DOM yet — a one-shot fallback to #dib-main-panel here used
    // to steal focus from the editor.
    const tab = tabs.find((t) => t.id === activeTabId);
    const selector = tab ? (FOCUS_SELECTORS[tab.type] ?? "[data-focus-host]") : "#dib-main-panel";
    focusWithRetry(selector);
  }, [isReloading]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Data loading ───────────────────────────────────────────────────────
  const updateTableTabState = useCallback((tabId: string, patch: Partial<TableTabState>) => {
    setTableTabStates((prev) => {
      const base = prev[tabId] ?? defaultTableTabState({ name: "", schema: null });
      return { ...prev, [tabId]: { ...base, ...patch } };
    });
  }, []);

  const loadTablePage = useCallback(
    async (
      tabId: string,
      table: TableInfo,
      pageOffset: number,
      pageSize: number,
      filters: GridFilter[] = [],
      orderBy?: OrderBy | null,
    ) => {
      updateTableTabState(tabId, { loading: true, error: null });
      try {
        const r = await fetchTablePage(
          table,
          pageOffset,
          pageSize,
          filters.length > 0 ? filters : null,
          orderBy,
        );
        let pkCol = "";
        if (pageOffset === 0) {
          const cols = r.columns;
          const lower = cols.map((c) => c.toLowerCase());
          pkCol =
            cols[lower.indexOf("id")] ??
            cols[lower.findIndex((c) => c.endsWith("_id") || c === "uuid")] ??
            cols[0] ??
            "";
          // Empty table — eagerly load schema so the grid can show columns for row insertion.
          if (cols.length === 0) loadColumnsBatch([table], {});
        }
        updateTableTabState(tabId, {
          result: r,
          offset: pageOffset,
          pageSize,
          loading: false,
          orderBy: orderBy ?? null,
          ...(pageOffset === 0
            ? { primaryKeyColumn: pkCol, filters, pendingChanges: [] }
            : { filters }),
        });
      } catch (e) {
        const msg = fmtErr(e);
        updateTableTabState(tabId, { error: msg, loading: false });
        toast.error(msg);
      }
    },
    [fetchTablePage, updateTableTabState, toast, loadColumnsBatch],
  );

  // Table tabs restored from scopeTabCache carry no data — hydrate the active
  // one on activation (initial mount included).
  useEffect(() => {
    const tab = tabsRef.current.find((t) => t.id === activeTabId);
    if (tab?.type === "table" && tab.payload.table && !tableTabStates[tab.id]) {
      const table = tab.payload.table;
      setTableTabStates((prev) => ({ ...prev, [tab.id]: defaultTableTabState(table) }));
      loadTablePage(tab.id, table, 0, DEFAULT_PAGE_SIZE, []);
      loadTableRelations(table);
    }
  }, [activeTabId, tableTabStates, loadTablePage, loadTableRelations]);

  const reloadHandlerRef = useRef<(() => void) | null>(null);
  // React to reloadVersion from store — replaces dib:reload window event
  const reloadVersion = useConnectionStore((s) => s.reloadVersion);
  useEffect(() => {
    reloadHandlerRef.current?.();
  }, [reloadVersion]);

  // Batch-load columns when SchemaVisualizer or MockGenerator tab opens
  useEffect(() => {
    const tab = tabs.find((t) => t.id === activeTabId);
    if (tables.length === 0) return;
    if (tab?.type === "schema") {
      loadColumnsBatch(tables, columnMap);
    } else if (tab?.type === "mock_generator" && tab.payload.table) {
      const t = tab.payload.table;
      if (!columnMap[t.name]?.length) loadColumnsBatch([t], columnMap);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTabId]);

  reloadHandlerRef.current = () => {
    const tab = tabs.find((t) => t.id === activeTabId) ?? null;
    if (tab?.type === "table" && tab.payload.table) {
      const ts = tableTabStates[tab.id];
      if (ts) {
        setIsReloading(true);
        loadColumnsBatch([ts.table], columnMap);
        loadTablePage(tab.id, ts.table, ts.offset, ts.pageSize, ts.filters)
          .catch(() => performClose(tab.id))
          .finally(() => setIsReloading(false));
      }
    } else {
      setIsReloading(true);
      setTimeout(() => setIsReloading(false), 50);
    }
  };

  // ── Commit pending grid changes ────────────────────────────────────────
  const handleCommit = useCallback(
    async (tabId: string) => {
      const ts = tableTabStates[tabId];
      if (!ts || ts.pendingChanges.length === 0) return;
      if (ts.primaryKeyColumn) {
        const pkChanges = ts.pendingChanges.filter(
          (c) => c.column === ts.primaryKeyColumn,
        );
        if (pkChanges.length > 0) {
          toast.warn(
            `Modifying primary key column "${ts.primaryKeyColumn}" in ${pkChanges.length} row(s). This may break referential integrity.`,
          );
        }
      }
      setCommitting(tabId);
      try {
        await commitChanges(ts.table.name, ts.primaryKeyColumn, ts.pendingChanges);
        updateTableTabState(tabId, { pendingChanges: [] });
        markTabClean(tabId);
        await loadTablePage(tabId, ts.table, ts.offset, ts.pageSize, ts.filters, ts.orderBy);
      } catch (e) {
        updateTableTabState(tabId, { error: fmtErr(e) });
      } finally {
        setCommitting(null);
        requestAnimationFrame(() => {
          const main = document.getElementById("dib-main-panel");
          const grid = main?.querySelector<HTMLElement>(".dg-wrap");
          grid?.focus({ preventScroll: true });
        });
      }
    },
    [tableTabStates, commitChanges, updateTableTabState, markTabClean, loadTablePage, toast],
  );

  // ── Tab lifecycle ──────────────────────────────────────────────────────
  const openSqlTab = useCallback(
    (sql: string, name: string, scriptId?: string, autoRun?: boolean) => {
      const tabId = scriptId ?? crypto.randomUUID();
      setTabs((prev) => {
        if (prev.some((t) => t.id === tabId)) {
          return prev;
        }
        const newTab: TabData = {
          id: tabId,
          type: "script",
          title: name,
          isDirty: false,
          payload: { sql, filename: name, scriptId: scriptId ?? null, autoRun },
          closeable: true,
        };
        registerTabSql(tabId, sql);
        return [...prev, newTab];
      });
      setActiveTabId(tabId);
    },
    [registerTabSql],
  );

  // ── Relational breadcrumbs ─────────────────────────────────────────────
  // Point a table tab at trail[idx]: retitle the tab, repoint its payload and
  // re-run the query. Nodes hold coordinates only, so this always re-fetches.
  // pageSize is a preference of the *viewer*, not of the node, so trail hops
  // carry the tab's current page size instead of snapping back to the default.
  const applyTrailNode = useCallback(
    (tabId: string, trail: TrailNode[], idx: number, pageSize: number) => {
      const node = trail[idx];
      if (!node) return;
      tabsRef.current = tabsRef.current.map((t) =>
        t.id === tabId
          ? {
              ...t,
              title: tableLabel(node.table),
              payload: { ...t.payload, table: node.table, activeCell: null },
            }
          : t,
      );
      setTabs(tabsRef.current);
      updateTableTabState(tabId, {
        table: node.table,
        trail,
        trailIdx: idx,
        orderBy: node.orderBy,
      });
      loadTablePage(tabId, node.table, 0, pageSize, node.filters, node.orderBy);
      loadTableRelations(node.table);
    },
    [updateTableTabState, loadTablePage, loadTableRelations],
  );

  const openTableTab = useCallback(
    (table: TableInfo, initialFilters?: GridFilter[]) => {
      const tid = tableTabId(table);
      const exists = tabsRef.current.some((t) => t.id === tid);
      if (exists) {
        setActiveTabId(tid);
        // The tab may be parked on a FK hop (its id is the *root* table), so
        // reopening from the sidebar resets the trail to this table as root.
        const showing = tabsRef.current.find((t) => t.id === tid)?.payload.table;
        if (initialFilters?.length || showing?.name !== table.name) {
          // Reopening from the sidebar is a fresh start, so the default page
          // size applies here — unlike a trail hop, which continues a session.
          applyTrailNode(tid, [trailNode(table, initialFilters ?? [])], 0, DEFAULT_PAGE_SIZE);
        }
        return;
      }
      const newTab: TabData = {
        id: tid,
        type: "table",
        title: table.schema ? `${table.schema}.${table.name}` : table.name,
        isDirty: false,
        payload: { table },
        closeable: true,
      };
      tabsRef.current = [...tabsRef.current, newTab];
      setTabs(tabsRef.current);
      setTableTabStates((prev) => ({
        ...prev,
        [tid]: prev[tid] || defaultTableTabState(table, initialFilters ?? []),
      }));
      setActiveTabId(tid);
      loadTablePage(tid, table, 0, DEFAULT_PAGE_SIZE, initialFilters ?? []);
      loadTableRelations(table);
    },
    [loadTablePage, loadTableRelations, applyTrailNode],
  );

  const openTableStructureTab = useCallback((table: TableInfo) => {
    const structureTabId = `structure-${table.schema ?? "public"}-${table.name}`;
    const dataTabId = tableTabId(table);
    setTabs((prev) => {
      if (prev.some((t) => t.id === structureTabId)) {
        setActiveTabId(structureTabId);
        return prev;
      }
      const newTab: TabData = {
        id: structureTabId,
        type: "table_structure",
        title: table.schema ? `${table.schema}.${table.name}` : table.name,
        isDirty: false,
        payload: { table },
        closeable: true,
      };
      const dataTabIdx = prev.findIndex((t) => t.id === dataTabId);
      setActiveTabId(structureTabId);
      if (dataTabIdx !== -1) {
        const next = [...prev];
        next.splice(dataTabIdx + 1, 0, newTab);
        return next;
      }
      return [...prev, newTab];
    });
  }, []);

  const toggleStructureTab = useCallback(
    (table: TableInfo) => {
      const structureTabId = `structure-${table.schema ?? "public"}-${table.name}`;
      const dataTabId = tableTabId(table);
      setTabs((prev) => {
        const structureExists = prev.some((t) => t.id === structureTabId);
        const dataExists = prev.some((t) => t.id === dataTabId);
        if (activeTabId === dataTabId) {
          if (structureExists) {
            setActiveTabId(structureTabId);
            return prev;
          }
          const newTab: TabData = {
            id: structureTabId,
            type: "table_structure",
            title: table.schema ? `${table.schema}.${table.name}` : table.name,
            isDirty: false,
            payload: { table },
            closeable: true,
          };
          const dataTabIdx = prev.findIndex((t) => t.id === dataTabId);
          setActiveTabId(structureTabId);
          if (dataTabIdx !== -1) {
            const next = [...prev];
            next.splice(dataTabIdx + 1, 0, newTab);
            return next;
          }
          return [...prev, newTab];
        }
        if (activeTabId === structureTabId && dataExists) {
          setActiveTabId(dataTabId);
          return prev;
        }
        if (!structureExists) {
          const newTab: TabData = {
            id: structureTabId,
            type: "table_structure",
            title: table.schema ? `${table.schema}.${table.name}` : table.name,
            isDirty: false,
            payload: { table },
            closeable: true,
          };
          setActiveTabId(structureTabId);
          return [...prev, newTab];
        }
        setActiveTabId(structureTabId);
        return prev;
      });
    },
    [activeTabId],
  );

  const openRelationTab = useCallback((table: TableInfo) => {
    const tabId = `tab-rel-${table.name}-${crypto.randomUUID()}`;
    const newTab: TabData = {
      id: tabId,
      type: "schema",
      title: `~ ${table.name}`,
      isDirty: false,
      payload: { table },
      closeable: true,
    };
    setTabs((prev) => [...prev, newTab]);
    setActiveTabId(tabId);
  }, []);

  const openMockGeneratorTab = useCallback((table: TableInfo) => {
    const tabId = `tab-mock-${table.schema ?? "pub"}-${table.name}`;
    setTabs((prev) => {
      if (prev.some((t) => t.id === tabId)) {
        setActiveTabId(tabId);
        return prev;
      }
      const newTab: TabData = {
        id: tabId,
        type: "mock_generator",
        title: `Mock: ${table.name}`,
        isDirty: false,
        payload: { table },
        closeable: true,
      };
      setActiveTabId(tabId);
      return [...prev, newTab];
    });
  }, []);

  const handleTabSelect = useCallback((id: string) => {
    setActiveTabId(id);
  }, []);

  const performClose = useCallback(
    (id: string) => {
      setTabs((prev) => {
        const tab = prev.find((t) => t.id === id);
        if (!tab) return prev;
        if (tab.closeable) {
          closedTabsHistoryRef.current = [
            ...closedTabsHistoryRef.current.slice(-9),
            { tab, sql: tabSqlRef.current[id] },
          ];
        }
        const closedIdx = prev.findIndex((t) => t.id === id);
        const next = prev.filter((t) => t.id !== id);
        // Editor convention: focus the tab that slid into the closed one's slot
        // (the one on its right), falling back to the left neighbour at the end.
        setActiveTabId((cur) =>
          cur === id
            ? (next[Math.min(closedIdx, next.length - 1)]?.id ?? "")
            : cur,
        );
        removeTabSql(id);
        setTableTabStates((p) => {
          const n = { ...p };
          delete n[id];
          return n;
        });
        return next;
      });
      setClosingTabId(null);
    },
    [removeTabSql],
  );

  useEffect(() => {
    if (isClosingAll && !closingTabId && !saveAsTabId) {
      const nextDirty = tabs.find((t) => t.isDirty && t.closeable);
      if (nextDirty) {
        setClosingTabId(nextDirty.id);
      } else {
        const remainingToClose = tabs.filter((t) => t.closeable);
        remainingToClose.forEach((t) => performClose(t.id));
        setIsClosingAll(false);
      }
    }
  }, [isClosingAll, closingTabId, saveAsTabId, tabs, performClose]);

  const handleTabClose = useCallback(
    (id: string) => {
      const tab = tabsRef.current.find((t) => t.id === id);
      if (tab?.isDirty) {
        setClosingTabId(id);
      } else {
        performClose(id);
      }
    },
    [performClose],
  );

  const handleTabReorder = useCallback((newTabs: TabData[]) => setTabs(newTabs), []);

  // ── Store-based event handlers — replace dib:* window events ──────────
  const pendingOpenStructure = useWorkspaceStore((s) => s.pendingOpenStructure);
  useEffect(() => {
    if (pendingOpenStructure) {
      openTableStructureTab(pendingOpenStructure);
      useWorkspaceStore.getState().clearPendingOpenStructure();
    }
  }, [pendingOpenStructure, openTableStructureTab]);

  const pendingOpenRelations = useWorkspaceStore((s) => s.pendingOpenRelations);
  useEffect(() => {
    if (pendingOpenRelations) {
      openRelationTab(pendingOpenRelations);
      useWorkspaceStore.getState().clearPendingOpenRelations();
    }
  }, [pendingOpenRelations, openRelationTab]);

  const tabAction = useWorkspaceStore((s) => s.tabAction);
  useEffect(() => {
    if (!tabAction) return;
    if (tabAction.type === "close") {
      const tab = activeTabRef.current;
      const tabId = activeTabIdRef.current;
      if (tab?.closeable) handleTabClose(tabId);
    } else if (tabAction.type === "close_by_path" && tabAction.payload) {
      const tabToClose = tabsRef.current.find((t) => t.payload.scriptId === tabAction.payload);
      if (tabToClose) performClose(tabToClose.id);
    } else if (tabAction.type === "mark_deleted" && tabAction.payload) {
      const deletedId = tabAction.payload;
      setTabs((prev) => prev.map((t) =>
        t.payload.scriptId === deletedId ? { ...t, payload: { ...t.payload, isDeleted: true } } : t,
      ));
    } else if (tabAction.type === "new") {
      // Find next available "Untitled N" number from current tabs
      const currentTabs = tabsRef.current;
      let maxUntitled = 0;
      for (const t of currentTabs) {
        const match = t.title.match(/^Untitled(?:\s+(\d+))?\.sql$/);
        if (match) {
          const num = match[1] ? parseInt(match[1], 10) : 1;
          if (num > maxUntitled) maxUntitled = num;
        }
      }
      const nextNum = maxUntitled + 1;
      openSqlTab("", nextNum === 1 ? "Untitled.sql" : `Untitled ${nextNum}.sql`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabAction]);

  // ── Navigate/openScript from App ───────────────────────────────────────
  // One-shot events: consume then clear the store value. Leaving it set
  // replays stale opens on remount (db switch) or when callback identities
  // churn between renders.
  useEffect(() => {
    if (!navigateTo) return;
    openTableTab(navigateTo.table);
    useWorkspaceStore.getState().setNavigateTo(null);
  }, [navigateTo, openTableTab]);
  useEffect(() => {
    if (!openScript) return;
    openSqlTab(openScript.sql, openScript.name, openScript.id, openScript.autoRun);
    useWorkspaceStore.getState().setOpenScript(null);
  }, [openScript, openSqlTab]);

  // ── Active table → sidebar highlight ──────────────────────────────────
  useEffect(() => {
    const tab = tabs.find((t) => t.id === activeTabId);
    const detail =
      tab?.type === "table" && tab.payload.table
        ? { name: tab.payload.table.name, schema: tab.payload.table.schema ?? null }
        : null;
    useWorkspaceStore.getState().setActiveTable(detail);
  }, [activeTabId, tabs]);

  // ── Focus active tab ───────────────────────────────────────────────────
  useEffect(() => {
    if (!activeTabId) return;
    const tab = tabs.find((t) => t.id === activeTabId);
    if (!tab) return;
    const selector = FOCUS_SELECTORS[tab.type] ?? "[data-focus-host]";
    focusWithRetry(selector);
  }, [activeTabId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Stable refs ───────────────────────────────────────────────────────
  const activeTabIdRef = useRef(activeTabId);
  activeTabIdRef.current = activeTabId;
  const activeTab = tabs.find((t) => t.id === activeTabId) ?? null;
  const activeTabRef = useRef(activeTab);
  activeTabRef.current = activeTab;

  // ── Keybindings ────────────────────────────────────────────────────────
  useKeybindings([
    {
      combo: "ctrl+w",
      handler: () => {
        const tab = tabs.find((t) => t.id === activeTabId);
        if (tab?.closeable) handleTabClose(activeTabId);
      },
      allowInMonaco: true,
    },
    // Next / previous tab, with Ctrl+PageDown/PageUp as browser-standard aliases.
    // These only started matching once _key() switched to e.code — webkit2gtk reports
    // Shift+Tab as "ISO_Left_Tab" and PageUp/Down as "Prior"/"Next" via e.key.
    ...[
      { combo: "ctrl+tab", delta: 1 },
      { combo: "ctrl+pagedown", delta: 1 },
      { combo: "ctrl+shift+tab", delta: -1 },
      { combo: "ctrl+pageup", delta: -1 },
    ].map(({ combo, delta }) => ({
      combo,
      handler: () => {
        if (tabs.length < 2) return;
        const idx = tabs.findIndex((t) => t.id === activeTabId);
        setActiveTabId(tabs[(idx + delta + tabs.length) % tabs.length].id);
      },
      allowInMonaco: true,
    })),
    // Alt+1..9 → jump to the Nth tab; Alt+9 is always the last one (browser-style).
    // Combos are fixed at mount, so all 9 register regardless of how many tabs exist.
    ...Array.from({ length: 9 }, (_, i) => ({
      combo: `alt+${i + 1}`,
      handler: () => {
        const tab = i === 8 ? tabs[tabs.length - 1] : tabs[i];
        if (tab) setActiveTabId(tab.id);
      },
      allowInMonaco: true,
    })),
    {
      combo: "ctrl+shift+w",
      handler: () => {
        setIsClosingAll(true);
      },
      allowInMonaco: true,
    },
    {
      combo: "ctrl+o",
      handler: () => {
        workspaceService
          .importScriptDialog()
          .then(async (result) => {
            if (result) {
              // Mode-aware: workspace → .sql file on disk, standalone → virtual script.
              const finalId = await importScript(crypto.randomUUID(), result.name, result.content);
              openSqlTab(result.content, result.name, finalId);
            }
          })
          .catch(console.error);
      },
      allowInMonaco: true,
    },
    {
      combo: "ctrl+l",
      handler: () => {
        const main = document.getElementById("dib-main-panel");
        const editor = main?.querySelector<HTMLElement>(
          ".monaco-editor textarea, .monaco-editor .native-edit-context",
        );
        const grid = main?.querySelector<HTMLElement>(".dg-wrap");
        (editor ?? grid ?? main)?.focus();
      },
      allowInMonaco: true,
    },
    {
      combo: "ctrl+n",
      handler: () => {
        if (activeTabRef.current?.type === "table") useWorkspaceStore.getState().triggerInsertRow();
      },
      allowInMonaco: false,
    },
    {
      combo: "ctrl+t",
      handler: () => {
        // Find next available "Untitled N" number from current tabs
        const currentTabs = tabsRef.current;
        let maxUntitled = 0;
        for (const t of currentTabs) {
          const match = t.title.match(/^Untitled(?:\s+(\d+))?\.sql$/);
          if (match) {
            const num = match[1] ? parseInt(match[1], 10) : 1;
            if (num > maxUntitled) maxUntitled = num;
          }
        }
        const nextNum = maxUntitled + 1;
        openSqlTab("", nextNum === 1 ? "Untitled.sql" : `Untitled ${nextNum}.sql`);
      },
      allowInMonaco: true,
    },
    {
      combo: "ctrl+shift+t",
      handler: () => {
        const history = closedTabsHistoryRef.current;
        if (!history.length) return;
        const last = history[history.length - 1];
        closedTabsHistoryRef.current = history.slice(0, -1);
        const { tab, sql } = last;
        if (tab.type === "table" && tab.payload.table) {
          openTableTab(tab.payload.table);
        } else {
          setTabs((prev) => {
            if (prev.some((t) => t.id === tab.id)) {
              setActiveTabId(tab.id);
              return prev;
            }
            return [...prev, { ...tab, isDirty: false }];
          });
          if (sql !== undefined) registerTabSql(tab.id, sql);
          setActiveTabId(tab.id);
        }
      },
      allowInMonaco: true,
    },
  ]);

  // ── Grid callbacks ─────────────────────────────────────────────────────
  const handleSaveViewState = useCallback((tabId: string, viewState: unknown) => {
    setTabs((prev) =>
      prev.map((t) => (t.id === tabId ? { ...t, payload: { ...t.payload, viewState } } : t)),
    );
  }, []);

  // Adapter: SqlEditor sends just `sql`; we add the active tabId context
  const handleContentChange = useCallback(
    (sql: string, changedTabId?: string) => {
      persistContentChange(changedTabId ?? activeTabIdRef.current, sql);
    },
    [persistContentChange],
  );

  const handleImportScriptAndSave = useCallback(
    (sql: string, name: string) => {
      // Mode-aware: workspace → .sql file on disk, standalone → virtual script.
      importScript(crypto.randomUUID(), name, sql)
        .then((finalId) => openSqlTab(sql, name, finalId))
        .catch(console.error);
    },
    [openSqlTab, importScript],
  );

  const handleSaveScript = useCallback(
    (sql: string) => {
      const tab = tabsRef.current.find((t) => t.id === activeTabIdRef.current);
      if (!tab) return;
      if (tab.payload.scriptId == null || tab.payload.scriptId.startsWith("new-")) {
        setSaveAsTabId(tab.id);
        setSaveAsName(tab.title);
      } else {
        saveSqlTab(tab.id, sql);
      }
    },
    [saveSqlTab],
  );

  const handleSaveAsConfirm = useCallback(
    async (finalName: string) => {
      if (!saveAsTabId || !finalName.trim()) return;
      const sql =
        tabSqlRef.current[saveAsTabId] ??
        tabsRef.current.find((t) => t.id === saveAsTabId)?.payload.sql ??
        "";
      await saveNewScript(saveAsTabId, finalName.trim(), sql);
      const tabId = saveAsTabId;
      const shouldClose = closeAfterSaveAs;
      setSaveAsTabId(null);
      setSaveAsName("");
      setCloseAfterSaveAs(false);
      if (shouldClose) performClose(tabId);
    },
    [saveAsTabId, closeAfterSaveAs, saveNewScript, performClose],
  );

  const handleGridActiveCellChange = useCallback((cell: { row: number; col: number } | null) => {
    const tabId = activeTabIdRef.current;
    setTabs((prev) =>
      prev.map((t) => (t.id === tabId ? { ...t, payload: { ...t.payload, activeCell: cell } } : t)),
    );
  }, []);

  const handleGridPendingChanges = useCallback(
    (changes: PendingChange[]) => {
      if (!activeTabId) return;
      setTableTabStates((prev) => {
        const existing = prev[activeTabId];
        if (!existing) return prev;
        if (changes.length === 0 && existing.pendingChanges.length === 0) return prev;
        return { ...prev, [activeTabId]: { ...existing, pendingChanges: changes } };
      });
      if (changes.length > 0) markTabDirty(activeTabId);
      else markTabClean(activeTabId);
    },
    [activeTabId, markTabDirty, markTabClean],
  );

  const handleGridFiltersChange = useCallback(
    (newFilters: GridFilter[]) => {
      const tab = activeTabRef.current;
      const state = activeTabIdRef.current ? tableTabStates[activeTabIdRef.current] : undefined;
      if (tab?.payload.table) {
        const statePageSize = state?.pageSize ?? DEFAULT_PAGE_SIZE;
        loadTablePage(activeTabIdRef.current, tab.payload.table, 0, statePageSize, newFilters, state?.orderBy ?? undefined);
      }
    },
    [loadTablePage, tableTabStates],
  );

  const handleGridSortChange = useCallback(
    (orderBy: OrderBy | null) => {
      const tab = activeTabRef.current;
      const ts = activeTabIdRef.current ? tableTabStates[activeTabIdRef.current] : undefined;
      if (tab?.payload.table && ts) {
        loadTablePage(activeTabIdRef.current, tab.payload.table, 0, ts.pageSize, ts.filters, orderBy);
      }
    },
    [loadTablePage, tableTabStates],
  );

  const handleGridSave = useCallback(
    (changes: PendingChange[]): Promise<void> => {
      if (changes.length > 0) return handleCommit(activeTabIdRef.current);
      return Promise.resolve();
    },
    [handleCommit],
  );

  // Trail hops discard nothing: refuse to move while edits are uncommitted.
  const warnIfPendingChanges = useCallback(
    (ts: TableTabState) => {
      if (ts.pendingChanges.length === 0) return false;
      toast.warn("Commit or discard your pending changes before navigating.");
      return true;
    },
    [toast],
  );

  const handleFkNavigate = useCallback(
    (targetTable: string, targetColumn: string, value: unknown, inPlace?: boolean) => {
      const table = tables.find((t) => t.name === targetTable) ?? {
        name: targetTable,
        schema: null,
      };
      const filters: GridFilter[] = [
        { column: targetColumn, operator: "=", value: String(value) },
      ];
      const tabId = activeTabIdRef.current;
      const ts = tabId ? tableTabStates[tabId] : undefined;
      // A tab is identified by its *root* table, so a FK cycling back to that
      // root resolves to this very tab — there is no second tab to open, and
      // letting openTableTab handle it would reset the trail to a single node.
      // Pushing a hop keeps the path the user walked.
      const targetIsThisTab = !!ts && tableTabId(table) === tabId;
      if (!ts || (!inPlace && !targetIsThisTab)) {
        openTableTab(table, filters);
        return;
      }
      if (warnIfPendingChanges(ts)) return;
      const { trail, idx } = pushTrail(syncedTrail(ts), ts.trailIdx, trailNode(table, filters));
      applyTrailNode(tabId, trail, idx, ts.pageSize);
    },
    [tables, openTableTab, tableTabStates, applyTrailNode, warnIfPendingChanges],
  );

  const handleTrailGoto = useCallback(
    (idx: number) => {
      const tabId = activeTabIdRef.current;
      const ts = tabId ? tableTabStates[tabId] : undefined;
      if (!ts) return;
      const target = validTrailIdx(ts.trail, idx);
      if (target === null || target === ts.trailIdx) return;
      if (warnIfPendingChanges(ts)) return;
      applyTrailNode(tabId, syncedTrail(ts), target, ts.pageSize);
    },
    [tableTabStates, applyTrailNode, warnIfPendingChanges],
  );

  // Alt+←/→ walk the trail. Registered through the shared keybinding registry
  // so the cell editor and filter inputs keep priority (useKeybindings.ts:67).
  const stepTrail = useCallback(
    (dir: -1 | 1) => {
      const ts = activeTabIdRef.current ? tableTabStates[activeTabIdRef.current] : undefined;
      if (ts) handleTrailGoto(ts.trailIdx + dir);
    },
    [tableTabStates, handleTrailGoto],
  );
  useKeybindings([
    { combo: "alt+arrowleft", handler: () => stepTrail(-1) },
    { combo: "alt+arrowright", handler: () => stepTrail(1) },
  ]);

  const handleGridSaveError = useCallback(
    (msg: string) => {
      toast.warn(`Rollback: ${msg}`);
    },
    [toast],
  );
  const handleGridForceClose = useCallback(() => {
    handleTabClose(activeTabIdRef.current);
  }, [handleTabClose]);
  const handleGridFocusEditor = useCallback(() => {
    const main = document.getElementById("dib-main-panel");
    const editor = main?.querySelector<HTMLElement>(
      ".monaco-editor textarea, .monaco-editor .native-edit-context",
    );
    const grid = main?.querySelector<HTMLElement>(".dg-wrap");
    (editor ?? grid ?? main)?.focus();
  }, []);

  // ── Derived state ──────────────────────────────────────────────────────
  const activeTableState = activeTabId ? (tableTabStates[activeTabId] ?? null) : null;
  const gridRows = useMemo(
    () => activeTableState?.result?.rows ?? [],
    [activeTableState?.result?.rows],
  );
  const gridCols = useMemo(() => {
    const fromResult = activeTableState?.result?.columns ?? [];
    if (fromResult.length > 0) return fromResult;
    // Empty table — use schema column names as fallback so the grid renders for row insertion.
    const table = activeTab?.type === "table" ? activeTab.payload.table : null;
    return table ? (columnMap[table.name]?.map((c) => c.name) ?? []) : [];
  }, [activeTableState?.result?.columns, activeTab, columnMap]);
  const totalRows = activeTableState?.result?.total ?? 0;
  const currentPageSize = activeTableState?.pageSize ?? DEFAULT_PAGE_SIZE;
  const currentPage = Math.floor((activeTableState?.offset ?? 0) / currentPageSize);
  const totalPages = Math.ceil(totalRows / currentPageSize);

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <div className="qp">
      <div className="qp-data">
        {tabs.length > 0 && (
          <TabBar
            tabs={tabs}
            activeId={activeTabId}
            onSelect={handleTabSelect}
            onClose={handleTabClose}
            onReorder={handleTabReorder}
          />
        )}

        {activeTab?.type === "table" && (
          <>
            {activeTableState?.error && (
              <div className="qp-data-error">{activeTableState.error}</div>
            )}
            <div className="qp-grid-header">
              <TrailBreadcrumb
                trail={activeTableState?.trail ?? []}
                trailIdx={activeTableState?.trailIdx ?? 0}
                fallbackLabel={activeTab.payload.table ? tableLabel(activeTab.payload.table) : ""}
                onGoto={handleTrailGoto}
              />
            </div>
            {!activeTableState?.loading &&
              !activeTableState?.result &&
              !activeTableState?.error && (
                <div className="qp-data-empty">
                  <p>Loading table…</p>
                </div>
              )}
            <div className="qp-grid-wrap">
              {(activeTableState?.loading || activeTableState?.result) && (
                <DataGrid
                  columns={gridCols}
                  rows={gridRows}
                  loading={activeTableState?.loading ?? false}
                  tableName={activeTab.payload.table?.name}
                  tableSchema={activeTab.payload.table?.schema ?? null}
                  primaryKeyColumn={activeTableState?.primaryKeyColumn}
                  columnInfos={
                    activeTab.payload.table ? columnMap[activeTab.payload.table.name] : undefined
                  }
                  filters={activeTableState?.filters}
                  orderBy={activeTableState?.orderBy ?? null}
                  onSortChange={handleGridSortChange}
                  relations={
                    activeTab.payload.table
                      ? tableRelations[activeTab.payload.table.name]
                      : undefined
                  }
                  onPendingChanges={handleGridPendingChanges}
                  onFiltersChange={handleGridFiltersChange}
                  onSave={handleGridSave}
                  onForceClose={handleGridForceClose}
                  onFocusEditor={handleGridFocusEditor}
                  onFkNavigate={handleFkNavigate}
                  onSaveError={handleGridSaveError}
                  activeCell={activeTab.payload.activeCell ?? null}
                  onActiveCellChange={handleGridActiveCellChange}
                  footerRight={
                    activeTab.payload.table
                      ? (() => {
                          const t = activeTab.payload.table!;
                          const structId = `structure-${t.schema ?? "public"}-${t.name}`;
                          const structureIsOpen = tabs.some((tb) => tb.id === structId);
                          return (
                            <>
                              <button
                                className="qp-structure-footer-btn"
                                onClick={() => openMockGeneratorTab(t)}
                                title="Generar datos mock para esta tabla"
                              >
                                <Wand2 size={12} />
                                Mock Data
                              </button>
                              <button
                                className="qp-structure-footer-btn"
                                onClick={() => {
                                  const r = activeTableState?.result;
                                  if (!r) return;
                                  useWorkspaceStore.getState().openJsonPanel({
                                    title: `Table: ${t.name}`,
                                    result: {
                                      columns: r.columns,
                                      rows: r.rows as (string | number | boolean | null)[][],
                                      rows_affected: 0,
                                      column_metadata: [],
                                      is_updatable: false,
                                    },
                                  });
                                }}
                                title="View table data as JSON"
                              >
                                <Braces size={12} />
                                JSON
                              </button>
                              <button
                                id="dib-structure-toggle-btn"
                                className={`qp-structure-footer-btn${structureIsOpen ? " qp-structure-footer-btn--active" : ""}`}
                                onClick={() => toggleStructureTab(t)}
                                title={
                                  structureIsOpen
                                    ? "View table data"
                                    : "View table structure (toggle)"
                                }
                                aria-pressed={structureIsOpen}
                              >
                                <Layers size={12} />
                                {structureIsOpen ? "Data" : "Structure"}
                              </button>
                              <div className="dg-footer-actions-wrap">
                                <button
                                  ref={actionsBtnRef}
                                  className={`qp-structure-footer-btn dg-footer-actions-btn${actionsOpen ? " qp-structure-footer-btn--active" : ""}`}
                                  onClick={() => setActionsOpen((v) => !v)}
                                  onKeyDown={(e) => {
                                    if (e.key === "ArrowRight" && !actionsOpen) {
                                      e.preventDefault();
                                      setActionsOpen(true);
                                    } else if (e.key === "ArrowLeft" && actionsOpen) {
                                      e.preventDefault();
                                      setActionsOpen(false);
                                    }
                                  }}
                                  aria-haspopup="menu"
                                  aria-expanded={actionsOpen}
                                  title="Table actions"
                                >
                                  <MoreHorizontal size={14} />
                                </button>
                                {actionsOpen && (
                                  <TableActionsMenu
                                    menuRef={actionsRef}
                                    className="dg-footer-actions-menu"
                                    table={t}
                                    onAction={handleTableAction}
                                    onKeyDown={handleActionsMenuKeyDown}
                                  />
                                )}
                              </div>
                            </>
                          );
                        })()
                      : undefined
                  }
                />
              )}
            </div>
            {activeTableState?.result && totalPages > 1 && (
              <div className="qp-pagination">
                <button
                  className="qp-page-btn"
                  disabled={currentPage === 0 || activeTableState.loading}
                  onClick={() =>
                    activeTab.payload.table &&
                    loadTablePage(
                      activeTabId,
                      activeTab.payload.table,
                      (activeTableState.offset ?? 0) - currentPageSize,
                      currentPageSize,
                      activeTableState.filters,
                    )
                  }
                >
                  ‹ Prev
                </button>
                <span className="qp-page-info">
                  {currentPage + 1} / {totalPages}
                </span>
                <button
                  className="qp-page-btn"
                  disabled={currentPage >= totalPages - 1 || activeTableState.loading}
                  onClick={() =>
                    activeTab.payload.table &&
                    loadTablePage(
                      activeTabId,
                      activeTab.payload.table,
                      (activeTableState.offset ?? 0) + currentPageSize,
                      currentPageSize,
                      activeTableState.filters,
                    )
                  }
                >
                  Next ›
                </button>
                <PageSizeSelect
                  value={currentPageSize}
                  disabled={activeTableState.loading}
                  onChange={(newSize) => {
                    if (activeTab.payload.table)
                      loadTablePage(
                        activeTabId,
                        activeTab.payload.table,
                        0,
                        newSize,
                        activeTableState.filters,
                      );
                  }}
                />
              </div>
            )}
            <div className="qp-footer-row">
              <CommitFooter
                changes={activeTableState?.pendingChanges ?? []}
                committing={committing === activeTabId}
                onRevert={() => {
                  updateTableTabState(activeTabId, { pendingChanges: [] });
                  markTabClean(activeTabId);
                  if (activeTab.payload.table)
                    loadTablePage(
                      activeTabId,
                      activeTab.payload.table,
                      0,
                      activeTableState?.pageSize ?? DEFAULT_PAGE_SIZE,
                      [],
                    );
                }}
                onApply={() => handleCommit(activeTabId)}
              />
            </div>
          </>
        )}

        {activeTab?.type === "script" && (
          <Suspense fallback={<Skeleton height="100%" />}>
          <SqlEditor
            connectionId={connectionId}
            connectionName={connectionName}
            initialSql={tabSql[activeTabId] ?? activeTab.payload.sql}
            onImportScript={handleImportScriptAndSave}
            onDirty={() => markTabDirty(activeTabId)}
            onSaveScript={handleSaveScript}
            tabId={activeTabId}
            viewState={activeTab.payload.viewState}
            onSaveViewState={handleSaveViewState}
            onContentChange={handleContentChange}
            autoRun={activeTab.payload.autoRun}
          />
          </Suspense>
        )}

        {activeTab?.type === "mock_generator" && activeTab.payload.table && (
          <Suspense fallback={<Skeleton height="100%" />}>
            <MockGenerator
              connectionId={connectionId}
              table={activeTab.payload.table}
              columns={columnMap[activeTab.payload.table.name] ?? []}
            />
          </Suspense>
        )}

        {activeTab?.type === "schema" && (
          <Suspense fallback={<Skeleton height="100%" />}>
            <SchemaVisualizer
              engine={engine ?? "postgres"}
              tables={tables}
              columnMap={columnMap}
              connectionId={connectionId}
              focusTable={(activeTab.payload as TabPayload).table}
            />
          </Suspense>
        )}

        {activeTab?.type === "table_structure" && activeTab.payload.table && (
          <TableStructureView connectionId={connectionId} table={activeTab.payload.table} />
        )}

        {!activeTab && <EmptyWorkspaceState />}
      </div>

      {saveAsTabId && (
        <SaveAsDialog
          name={saveAsName}
          onNameChange={setSaveAsName}
          onConfirm={handleSaveAsConfirm}
          onCancel={() => {
            setSaveAsTabId(null);
            setSaveAsName("");
            setCloseAfterSaveAs(false);
            setIsClosingAll(false);
          }}
          disabled={!saveAsName.trim()}
        />
      )}

      {closingTabId &&
        (() => {
          const tabToClose = tabs.find((t) => t.id === closingTabId);
          if (!tabToClose) return null;
          return (
            <UnsavedChangesDialog
              entityName={tabToClose.payload.table?.name ?? tabToClose.title}
              entityType={tabToClose.type === "script" ? "script" : "table"}
              onSave={async () => {
                if (tabToClose.type === "script") {
                  if (tabToClose.payload.scriptId == null) {
                    // Draft: show save-as dialog, close after
                    setClosingTabId(null);
                    setSaveAsTabId(tabToClose.id);
                    setSaveAsName(tabToClose.title);
                    setCloseAfterSaveAs(true);
                  } else {
                    await saveSqlTab(
                      tabToClose.id,
                      tabSqlRef.current[tabToClose.id] ?? tabToClose.payload.sql ?? "",
                    );
                    performClose(tabToClose.id);
                  }
                } else if (tabToClose.type === "table") {
                  handleCommit(tabToClose.id).then(() => performClose(tabToClose.id));
                } else {
                  performClose(tabToClose.id);
                }
              }}
              onDiscard={() => performClose(tabToClose.id)}
              onCancel={() => {
                setClosingTabId(null);
                setIsClosingAll(false);
              }}
            />
          );
        })()}
    </div>
  );
}
