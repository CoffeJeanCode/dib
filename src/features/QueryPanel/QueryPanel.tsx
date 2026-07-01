import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useConnectionStore } from "@/store/connectionStore";
import { useWorkspaceStore } from "@/store/workspaceStore";
import { workspaceService } from "@/services/workspaceService";
import { useDatabaseEngine, DEFAULT_PAGE_SIZE } from "@/hooks/useDatabaseEngine";
import { useWorkspaceService } from "@/hooks/useWorkspaceService";
import { useKeybindings } from "@/hooks/useKeybindings";
import { Layers } from "lucide-react";
import type { TableInfo, PagedResult, PendingChange, GridFilter } from "@/types/db";
import type { TabData, TabPayload } from "@/components/Tab";
import { TableStructureView } from "@/components/TableStructureView";
import { DataGrid } from "@/features/DataGrid";
import { CommitFooter } from "@/components/CommitFooter";
import { TabBar } from "@/components/TabBar";
import { SqlEditor } from "@/features/SqlEditor";
import { SchemaVisualizer } from "@/features/SchemaVisualizer";
import { UnsavedChangesDialog } from "@/components/UnsavedChangesDialog";
import { EmptyWorkspaceState } from "@/components/EmptyWorkspaceState";
import { useToastStore } from "@/store/toastStore";
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
  offset: number;
  pendingChanges: PendingChange[];
  primaryKeyColumn: string;
  pageSize: number;
}

function defaultTableTabState(table: TableInfo): TableTabState {
  return { table, result: null, loading: false, error: null, filters: [], offset: 0, pendingChanges: [], primaryKeyColumn: "", pageSize: DEFAULT_PAGE_SIZE };
}

function tableTabId(table: TableInfo): string {
  return `tab-table-${table.schema ?? "pub"}-${table.name}`;
}

interface QueryPanelProps {
  connectionId: string;
  connectionName: string;
  engine?: string;
  navigateTo?: { table: TableInfo; v: number } | null;
  openScript?: { sql: string; name: string; id: string; v: number } | null;
}

export function QueryPanel({ connectionId, connectionName, engine, navigateTo, openScript }: QueryPanelProps) {
  const toast = useToastStore.getState();

  // ── Engine: tables, columns, relations, data fetching, commits ─────────
  const { tables, columnMap, tableRelations, fetchTablePage, loadTableRelations, loadColumnsBatch, commitChanges } =
    useDatabaseEngine(connectionId);

  // ── Tab lifecycle state ────────────────────────────────────────────────
  const [tabs, setTabs] = useState<TabData[]>([]);
  const tabsRef = useRef(tabs);
  tabsRef.current = tabs;

  const [activeTabId, setActiveTabId] = useState("");
  const closedTabsHistoryRef = useRef<Array<{ tab: TabData; sql?: string }>>([]);

  const [tableTabStates, setTableTabStates] = useState<Record<string, TableTabState>>({});
  const [committing, setCommitting] = useState<string | null>(null);
  const [isReloading, setIsReloading] = useState(false);
  const [closingTabId, setClosingTabId] = useState<string | null>(null);
  const [saveAsTabId, setSaveAsTabId] = useState<string | null>(null);
  const [saveAsName, setSaveAsName] = useState("");
  const [closeAfterSaveAs, setCloseAfterSaveAs] = useState(false);

  // ── Workspace: script persistence, tab SQL buffer ──────────────────────
  const markTabDirty = useCallback((tabId: string) => {
    setTabs((prev) => prev.map((t) => t.id === tabId ? { ...t, isDirty: true } : t));
  }, []);

  const markTabClean = useCallback((tabId: string) => {
    setTabs((prev) => prev.map((t) => t.id === tabId ? { ...t, isDirty: false } : t));
  }, []);

  const { tabSql, registerTabSql, removeTabSql, saveSqlTab, saveNewScript, persistContentChange } =
    useWorkspaceService({ tabsRef, markTabClean, setTabs, connectionId });

  const tabSqlRef = useRef(tabSql);
  tabSqlRef.current = tabSql;

  // ── Focus management ───────────────────────────────────────────────────
  useEffect(() => {
    if (!isReloading) {
      requestAnimationFrame(() => {
        const main = document.getElementById("dib-main-panel");
        const grid = main?.querySelector<HTMLElement>(".dg-wrap");
        const editor = main?.querySelector<HTMLElement>(".monaco-editor textarea");
        (grid ?? editor ?? main)?.focus();
      });
    }
  }, [isReloading]);

  // ── Data loading ───────────────────────────────────────────────────────
  const updateTableTabState = useCallback((tabId: string, patch: Partial<TableTabState>) => {
    setTableTabStates((prev) => {
      const base = prev[tabId] ?? defaultTableTabState({ name: "", schema: null });
      return { ...prev, [tabId]: { ...base, ...patch } };
    });
  }, []);

  const loadTablePage = useCallback(
    async (tabId: string, table: TableInfo, pageOffset: number, pageSize: number, filters: GridFilter[] = []) => {
      updateTableTabState(tabId, { loading: true, error: null });
      try {
        const r = await fetchTablePage(table, pageOffset, pageSize, filters.length > 0 ? filters : null);
        let pkCol = "";
        if (pageOffset === 0) {
          const cols = r.columns;
          const lower = cols.map((c) => c.toLowerCase());
          pkCol = cols[lower.indexOf("id")] ??
            cols[lower.findIndex((c) => c.endsWith("_id") || c === "uuid")] ??
            cols[0] ?? "";
          // Empty table — eagerly load schema so the grid can show columns for row insertion.
          if (cols.length === 0) loadColumnsBatch([table], {});
        }
        updateTableTabState(tabId, {
          result: r,
          offset: pageOffset,
          pageSize,
          loading: false,
          ...(pageOffset === 0 ? { primaryKeyColumn: pkCol, filters, pendingChanges: [] } : { filters }),
        });
      } catch (e) {
        const msg = fmtErr(e);
        updateTableTabState(tabId, { error: msg, loading: false });
        toast.error(msg);
      }
    },
    [fetchTablePage, updateTableTabState, toast, loadColumnsBatch],
  );

  const reloadHandlerRef = useRef<(() => void) | null>(null);
  // React to reloadVersion from store — replaces dib:reload window event
  const reloadVersion = useConnectionStore((s) => s.reloadVersion);
  useEffect(() => { reloadHandlerRef.current?.(); }, [reloadVersion]);

  // Batch-load columns when SchemaVisualizer tab opens
  useEffect(() => {
    const tab = tabs.find((t) => t.id === activeTabId);
    if (tab?.type !== "schema" || tables.length === 0) return;
    loadColumnsBatch(tables, columnMap);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTabId]);

  reloadHandlerRef.current = () => {
    const tab = tabs.find((t) => t.id === activeTabId) ?? null;
    if (tab?.type === "table" && tab.payload.table) {
      const ts = tableTabStates[tab.id];
      if (ts) {
        setIsReloading(true);
        loadTablePage(tab.id, ts.table, ts.offset, ts.pageSize, ts.filters).finally(() => setIsReloading(false));
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
      setCommitting(tabId);
      try {
        await commitChanges(ts.table.name, ts.primaryKeyColumn, ts.pendingChanges);
        updateTableTabState(tabId, { pendingChanges: [] });
        markTabClean(tabId);
        loadTablePage(tabId, ts.table, ts.offset, ts.pageSize, ts.filters);
      } catch (e) {
        updateTableTabState(tabId, { error: fmtErr(e) });
      } finally {
        setCommitting(null);
        requestAnimationFrame(() => {
          document.querySelector<HTMLElement>(".dg-wrap")?.focus();
        });
      }
    },
    [tableTabStates, commitChanges, updateTableTabState, markTabClean, loadTablePage],
  );

  // ── Tab lifecycle ──────────────────────────────────────────────────────
  const openSqlTab = useCallback((sql: string, name: string, scriptId?: string) => {
    const tabId = scriptId ?? crypto.randomUUID();
    setTabs((prev) => {
      if (prev.some((t) => t.id === tabId)) { setActiveTabId(tabId); return prev; }
      // scriptId provided → tab is already saved; null → draft
      const newTab: TabData = { id: tabId, type: "script", title: name, isDirty: false, payload: { sql, filename: name, scriptId: scriptId ?? null }, closeable: true };
      registerTabSql(tabId, sql);
      setActiveTabId(tabId);
      return [...prev, newTab];
    });
  }, [registerTabSql]);

  const openTableTab = useCallback(
    (table: TableInfo, initialFilters?: GridFilter[]) => {
      const tid = tableTabId(table);
      const exists = tabsRef.current.some((t) => t.id === tid);
      if (exists) {
        setActiveTabId(tid);
        if (initialFilters?.length) loadTablePage(tid, table, 0, DEFAULT_PAGE_SIZE, initialFilters);
        return;
      }
      const newTab: TabData = { id: tid, type: "table", title: table.schema ? `${table.schema}.${table.name}` : table.name, isDirty: false, payload: { table }, closeable: true };
      tabsRef.current = [...tabsRef.current, newTab];
      setTabs(tabsRef.current);
      setTableTabStates((prev) => ({ ...prev, [tid]: prev[tid] || defaultTableTabState(table) }));
      setActiveTabId(tid);
      loadTablePage(tid, table, 0, DEFAULT_PAGE_SIZE, initialFilters ?? []);
      loadTableRelations(table);
    },
    [loadTablePage, loadTableRelations],
  );

  const openTableStructureTab = useCallback((table: TableInfo) => {
    const structureTabId = `structure-${table.schema ?? "public"}-${table.name}`;
    const dataTabId = tableTabId(table);
    setTabs((prev) => {
      if (prev.some((t) => t.id === structureTabId)) { setActiveTabId(structureTabId); return prev; }
      const newTab: TabData = { id: structureTabId, type: "table_structure", title: table.schema ? `${table.schema}.${table.name}` : table.name, isDirty: false, payload: { table }, closeable: true };
      const dataTabIdx = prev.findIndex((t) => t.id === dataTabId);
      setActiveTabId(structureTabId);
      if (dataTabIdx !== -1) { const next = [...prev]; next.splice(dataTabIdx + 1, 0, newTab); return next; }
      return [...prev, newTab];
    });
  }, []);

  const toggleStructureTab = useCallback((table: TableInfo) => {
    const structureTabId = `structure-${table.schema ?? "public"}-${table.name}`;
    const dataTabId = tableTabId(table);
    setTabs((prev) => {
      const structureExists = prev.some((t) => t.id === structureTabId);
      const dataExists = prev.some((t) => t.id === dataTabId);
      if (activeTabId === dataTabId) {
        if (structureExists) { setActiveTabId(structureTabId); return prev; }
        const newTab: TabData = { id: structureTabId, type: "table_structure", title: table.schema ? `${table.schema}.${table.name}` : table.name, isDirty: false, payload: { table }, closeable: true };
        const dataTabIdx = prev.findIndex((t) => t.id === dataTabId);
        setActiveTabId(structureTabId);
        if (dataTabIdx !== -1) { const next = [...prev]; next.splice(dataTabIdx + 1, 0, newTab); return next; }
        return [...prev, newTab];
      }
      if (activeTabId === structureTabId && dataExists) { setActiveTabId(dataTabId); return prev; }
      if (!structureExists) {
        const newTab: TabData = { id: structureTabId, type: "table_structure", title: table.schema ? `${table.schema}.${table.name}` : table.name, isDirty: false, payload: { table }, closeable: true };
        setActiveTabId(structureTabId);
        return [...prev, newTab];
      }
      setActiveTabId(structureTabId);
      return prev;
    });
  }, [activeTabId]);

  const openRelationTab = useCallback((table: TableInfo) => {
    const tabId = `tab-rel-${table.name}-${crypto.randomUUID()}`;
    const newTab: TabData = { id: tabId, type: "schema", title: `~ ${table.name}`, isDirty: false, payload: { table }, closeable: true };
    setTabs((prev) => [...prev, newTab]);
    setActiveTabId(tabId);
  }, []);

  const handleTabSelect = useCallback((id: string) => {
    setActiveTabId(id);
  }, []);

  const performClose = useCallback((id: string) => {
    setTabs((prev) => {
      const tab = prev.find((t) => t.id === id);
      if (!tab) return prev;
      if (tab.closeable) {
        closedTabsHistoryRef.current = [...closedTabsHistoryRef.current.slice(-9), { tab, sql: tabSqlRef.current[id] }];
      }
      const next = prev.filter((t) => t.id !== id);
      setActiveTabId((cur) => cur === id ? (next.length > 0 ? next[next.length - 1].id : "") : cur);
      removeTabSql(id);
      setTableTabStates((p) => { const n = { ...p }; delete n[id]; return n; });
      return next;
    });
    setClosingTabId(null);
  }, [removeTabSql]);

  const handleTabClose = useCallback((id: string) => {
    const tab = tabsRef.current.find(t => t.id === id);
    if (tab?.isDirty) {
      setClosingTabId(id);
    } else {
      performClose(id);
    }
  }, [performClose]);

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
    } else {
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
  useEffect(() => { if (navigateTo) openTableTab(navigateTo.table); }, [navigateTo, openTableTab]);
  const lastOpenScriptIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (openScript && openScript.id !== lastOpenScriptIdRef.current) {
      lastOpenScriptIdRef.current = openScript.id;
      openSqlTab(openScript.sql, openScript.name, openScript.id);
    }
  }, [openScript, openSqlTab]);

  // ── Active table → sidebar highlight ──────────────────────────────────
  useEffect(() => {
    const tab = tabs.find((t) => t.id === activeTabId);
    const detail = (tab?.type === "table" && tab.payload.table)
      ? { name: tab.payload.table.name, schema: tab.payload.table.schema ?? null }
      : null;
    useWorkspaceStore.getState().setActiveTable(detail);
  }, [activeTabId, tabs]);

  // ── Focus active tab ───────────────────────────────────────────────────
  useEffect(() => {
    if (!activeTabId) return;
    requestAnimationFrame(() => {
      const main = document.getElementById("dib-main-panel");
      const tab = tabs.find((t) => t.id === activeTabId);
      if (tab?.type === "script") {
        main?.querySelector<HTMLElement>(".monaco-editor textarea")?.focus();
      } else {
        const grid = main?.querySelector<HTMLElement>(".dg-wrap");
        const editor = main?.querySelector<HTMLElement>(".monaco-editor textarea");
        (grid ?? editor)?.focus();
      }
    });
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
      handler: () => { const tab = tabs.find((t) => t.id === activeTabId); if (tab?.closeable) handleTabClose(activeTabId); },
      allowInMonaco: true,
    },
    {
      combo: "ctrl+tab",
      handler: () => {
        if (tabs.length < 2) return;
        const idx = tabs.findIndex((t) => t.id === activeTabId);
        setActiveTabId(tabs[(idx + 1) % tabs.length].id);
      },
      allowInMonaco: true,
    },
    {
      combo: "ctrl+shift+tab",
      handler: () => {
        if (tabs.length < 2) return;
        const idx = tabs.findIndex((t) => t.id === activeTabId);
        setActiveTabId(tabs[(idx - 1 + tabs.length) % tabs.length].id);
      },
      allowInMonaco: true,
    },
    {
      combo: "ctrl+shift+w",
      handler: () => { setTabs([]); setActiveTabId(""); setTableTabStates({}); },
      allowInMonaco: true,
    },
    {
      combo: "ctrl+o",
      handler: () => {
        workspaceService.importScriptDialog()
          .then((result) => {
            if (result) {
              const newId = crypto.randomUUID();
              openSqlTab(result.content, result.name, newId);
              workspaceService.saveInternalScript(newId, result.name, result.content, connectionId).catch(console.error);
            }
          })
          .catch(() => {});
      },
      allowInMonaco: true,
    },
    {
      combo: "ctrl+l",
      handler: () => {
        const main = document.getElementById("dib-main-panel");
        const editor = main?.querySelector<HTMLElement>(".monaco-editor textarea");
        const grid = main?.querySelector<HTMLElement>(".dg-wrap");
        (editor ?? grid ?? main)?.focus();
      },
      allowInMonaco: true,
    },
    {
      combo: "ctrl+n",
      handler: () => { if (activeTabRef.current?.type === "table") useWorkspaceStore.getState().triggerInsertRow(); },
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
            if (prev.some((t) => t.id === tab.id)) { setActiveTabId(tab.id); return prev; }
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
    setTabs((prev) => prev.map((t) => t.id === tabId ? { ...t, payload: { ...t.payload, viewState } } : t));
  }, []);

  // Adapter: SqlEditor sends just `sql`; we add the active tabId context
  const handleContentChange = useCallback((sql: string) => {
    persistContentChange(activeTabIdRef.current, sql);
  }, [persistContentChange]);

  const handleImportScriptAndSave = useCallback((sql: string, name: string) => {
    const newId = crypto.randomUUID();
    openSqlTab(sql, name, newId);
    workspaceService.saveInternalScript(newId, name, sql, connectionId).catch(console.error);
  }, [openSqlTab, connectionId]);

  const handleSaveScript = useCallback((sql: string) => {
    const tab = tabsRef.current.find((t) => t.id === activeTabIdRef.current);
    if (!tab) return;
    if (tab.payload.scriptId == null) {
      setSaveAsTabId(tab.id);
      setSaveAsName(tab.title);
    } else {
      saveSqlTab(tab.id, sql);
    }
  }, [saveSqlTab]);

  const handleSaveAsConfirm = useCallback(async () => {
    if (!saveAsTabId || !saveAsName.trim()) return;
    const sql = tabSqlRef.current[saveAsTabId]
      ?? tabsRef.current.find((t) => t.id === saveAsTabId)?.payload.sql ?? "";
    await saveNewScript(saveAsTabId, saveAsName.trim(), sql);
    const tabId = saveAsTabId;
    const shouldClose = closeAfterSaveAs;
    setSaveAsTabId(null);
    setSaveAsName("");
    setCloseAfterSaveAs(false);
    if (shouldClose) performClose(tabId);
  }, [saveAsTabId, saveAsName, closeAfterSaveAs, saveNewScript, performClose]);

  const handleGridActiveCellChange = useCallback((cell: { row: number; col: number } | null) => {
    const tabId = activeTabIdRef.current;
    setTabs((prev) => prev.map((t) => t.id === tabId ? { ...t, payload: { ...t.payload, activeCell: cell } } : t));
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

  const handleGridFiltersChange = useCallback((newFilters: GridFilter[]) => {
    const tab = activeTabRef.current;
    if (tab?.payload.table) {
      const statePageSize = tableTabStates[activeTabIdRef.current]?.pageSize ?? DEFAULT_PAGE_SIZE;
      loadTablePage(activeTabIdRef.current, tab.payload.table, 0, statePageSize, newFilters);
    }
  }, [loadTablePage, tableTabStates]);

  const handleGridSave = useCallback((changes: PendingChange[]): Promise<void> => {
    if (changes.length > 0) return handleCommit(activeTabIdRef.current);
    return Promise.resolve();
  }, [handleCommit]);

  const handleFkNavigate = useCallback(
    (targetTable: string, targetColumn: string, value: unknown) => {
      const table = tables.find((t) => t.name === targetTable) ?? { name: targetTable, schema: null };
      openTableTab(table, [{ column: targetColumn, operator: "=", value: String(value) }]);
    },
    [tables, openTableTab],
  );

  const handleGridSaveError = useCallback((msg: string) => { toast.warn(`Rollback: ${msg}`); }, [toast]);
  const handleGridForceClose = useCallback(() => { handleTabClose(activeTabIdRef.current); }, [handleTabClose]);
  const handleGridFocusEditor = useCallback(() => {
    const main = document.getElementById("dib-main-panel");
    const editor = main?.querySelector<HTMLElement>(".monaco-editor textarea");
    const grid = main?.querySelector<HTMLElement>(".dg-wrap");
    (editor ?? grid ?? main)?.focus();
  }, []);

  // ── Derived state ──────────────────────────────────────────────────────
  const activeTableState = activeTabId ? tableTabStates[activeTabId] ?? null : null;
  const gridRows = useMemo(() => activeTableState?.result?.rows ?? [], [activeTableState?.result?.rows]);
  const gridCols = useMemo(() => {
    const fromResult = activeTableState?.result?.columns ?? [];
    if (fromResult.length > 0) return fromResult;
    // Empty table — use schema column names as fallback so the grid renders for row insertion.
    const table = activeTab?.type === "table" ? activeTab.payload.table : null;
    return table ? (columnMap[table.name]?.map(c => c.name) ?? []) : [];
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
          <TabBar tabs={tabs} activeId={activeTabId} onSelect={handleTabSelect} onClose={handleTabClose} onReorder={handleTabReorder} />
        )}

        {activeTab?.type === "table" && (
          <>
            {activeTableState?.error && <div className="qp-data-error">{activeTableState.error}</div>}
            <div className="qp-grid-header">
              <span className="qp-breadcrumb">
                {activeTab.payload.table?.schema
                  ? `${activeTab.payload.table.schema}.${activeTab.payload.table.name}`
                  : activeTab.payload.table?.name}
              </span>
            </div>
            {!activeTableState?.loading && !activeTableState?.result && !activeTableState?.error && (
              <div className="qp-data-empty"><p>Loading table…</p></div>
            )}
            <div className="qp-grid-wrap">
              {(activeTableState?.loading || activeTableState?.result) && (
                <DataGrid
                  columns={gridCols}
                  rows={gridRows}
                  loading={activeTableState?.loading ?? false}
                  tableName={activeTab.payload.table?.name}
                  primaryKeyColumn={activeTableState?.primaryKeyColumn}
                  columnInfos={activeTab.payload.table ? columnMap[activeTab.payload.table.name] : undefined}
                  filters={activeTableState?.filters}
                  relations={activeTab.payload.table ? tableRelations[activeTab.payload.table.name] : undefined}
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
                    activeTab.payload.table ? (() => {
                      const t = activeTab.payload.table!;
                      const structId = `structure-${t.schema ?? "public"}-${t.name}`;
                      const structureIsOpen = tabs.some((tb) => tb.id === structId);
                      return (
                        <button
                          id="dib-structure-toggle-btn"
                          className={`qp-structure-footer-btn${structureIsOpen ? " qp-structure-footer-btn--active" : ""}`}
                          onClick={() => toggleStructureTab(t)}
                          title={structureIsOpen ? "Ver datos de la tabla" : "Ver Estructura de tabla (toggle)"}
                          aria-pressed={structureIsOpen}
                        >
                          <Layers size={12} />
                          {structureIsOpen ? "Datos" : "Structure"}
                        </button>
                      );
                    })() : undefined
                  }
                />
              )}
            </div>
            {activeTableState?.result && totalPages > 1 && (
              <div className="qp-pagination">
                <button
                  className="qp-page-btn"
                  disabled={currentPage === 0 || activeTableState.loading}
                  onClick={() => activeTab.payload.table && loadTablePage(activeTabId, activeTab.payload.table, (activeTableState.offset ?? 0) - currentPageSize, currentPageSize, activeTableState.filters)}
                >‹ Prev</button>
                <span className="qp-page-info">{currentPage + 1} / {totalPages}</span>
                <button
                  className="qp-page-btn"
                  disabled={currentPage >= totalPages - 1 || activeTableState.loading}
                  onClick={() => activeTab.payload.table && loadTablePage(activeTabId, activeTab.payload.table, (activeTableState.offset ?? 0) + currentPageSize, currentPageSize, activeTableState.filters)}
                >Next ›</button>
                <select
                  className="qp-page-size-select"
                  value={currentPageSize}
                  onChange={(e) => {
                    const newSize = Number(e.target.value);
                    if (activeTab.payload.table) loadTablePage(activeTabId, activeTab.payload.table, 0, newSize, activeTableState.filters);
                  }}
                >
                  <option value={50}>50 / page</option>
                  <option value={100}>100 / page</option>
                  <option value={500}>500 / page</option>
                </select>
              </div>
            )}
            <div className="qp-footer-row">
              <CommitFooter
                changes={activeTableState?.pendingChanges ?? []}
                committing={committing === activeTabId}
                onRevert={() => {
                  updateTableTabState(activeTabId, { pendingChanges: [] });
                  markTabClean(activeTabId);
                  if (activeTab.payload.table) loadTablePage(activeTabId, activeTab.payload.table, 0, activeTableState?.pageSize ?? DEFAULT_PAGE_SIZE, []);
                }}
                onApply={() => handleCommit(activeTabId)}
              />
            </div>
          </>
        )}

        {activeTab?.type === "script" && (
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
          />
        )}

        {activeTab?.type === "schema" && (
          <SchemaVisualizer
            engine={engine ?? "postgres"}
            tables={tables}
            columnMap={columnMap}
            connectionId={connectionId}
            focusTable={(activeTab.payload as TabPayload).table}
          />
        )}

        {activeTab?.type === "table_structure" && activeTab.payload.table && (
          <TableStructureView connectionId={connectionId} table={activeTab.payload.table} />
        )}

        {!activeTab && <EmptyWorkspaceState />}
      </div>

      {saveAsTabId && (
        <div className="qp-save-as-overlay" onClick={() => { setSaveAsTabId(null); setSaveAsName(""); setCloseAfterSaveAs(false); }}>
          <div className="qp-save-as-dialog" onClick={(e) => e.stopPropagation()}>
            <label className="qp-save-as-label">Nombre del script</label>
            <input
              className="qp-save-as-input"
              value={saveAsName}
              onChange={(e) => setSaveAsName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSaveAsConfirm();
                if (e.key === "Escape") { setSaveAsTabId(null); setSaveAsName(""); setCloseAfterSaveAs(false); }
              }}
              autoFocus
            />
            <div className="qp-save-as-actions">
              <button onClick={() => { setSaveAsTabId(null); setSaveAsName(""); setCloseAfterSaveAs(false); }}>Cancel</button>
              <button className="qp-save-as-confirm" onClick={handleSaveAsConfirm} disabled={!saveAsName.trim()}>Save</button>
            </div>
          </div>
        </div>
      )}

      {closingTabId && (
        (() => {
          const tabToClose = tabs.find(t => t.id === closingTabId);
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
                    await saveSqlTab(tabToClose.id, tabSqlRef.current[tabToClose.id] ?? tabToClose.payload.sql ?? "");
                    performClose(tabToClose.id);
                  }
                } else if (tabToClose.type === "table") {
                  handleCommit(tabToClose.id).then(() => performClose(tabToClose.id));
                } else {
                  performClose(tabToClose.id);
                }
              }}
              onDiscard={() => performClose(tabToClose.id)}
              onCancel={() => setClosingTabId(null)}
            />
          );
        })()
      )}
    </div>
  );
}
