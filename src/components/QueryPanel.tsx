import { useState, useEffect, useMemo, useCallback, useRef, useContext } from "react";
import { workspaceService } from "@/services/workspaceService";
import { dbService } from "@/services/dbService";
import { useDatabaseEngine, PAGE_SIZE } from "@/hooks/useDatabaseEngine";
import { useWorkspaceService } from "@/hooks/useWorkspaceService";
import { useKeybindings } from "@/hooks/useKeybindings";
import { Layers } from "lucide-react";
import type { TableInfo, PagedResult, PendingChange, GridFilter } from "@/types/db";
import type { TabData, TabPayload } from "./Tab";
import { TableStructureView } from "./TableStructureView";
import { DataGrid } from "./DataGrid";
import { CommitFooter } from "./CommitFooter";
import { TabBar } from "./TabBar";
import { SqlEditor } from "./SqlEditor";
import { SchemaVisualizer } from "./SchemaVisualizer";
import { EmptyWorkspaceState } from "./EmptyWorkspaceState";
import { ToastContext } from "@/App";
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
}

function defaultTableTabState(table: TableInfo): TableTabState {
  return { table, result: null, loading: false, error: null, filters: [], offset: 0, pendingChanges: [], primaryKeyColumn: "" };
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
  const toast = useContext(ToastContext);

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

  // ── Workspace: script persistence, tab SQL buffer ──────────────────────
  const markTabDirty = useCallback((tabId: string) => {
    setTabs((prev) => prev.map((t) => t.id === tabId ? { ...t, isDirty: true } : t));
  }, []);

  const markTabClean = useCallback((tabId: string) => {
    setTabs((prev) => prev.map((t) => t.id === tabId ? { ...t, isDirty: false } : t));
  }, []);

  const { tabSql, registerTabSql, removeTabSql, saveSqlTab, persistContentChange } =
    useWorkspaceService({ tabsRef, markTabClean, setTabs });

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
    async (tabId: string, table: TableInfo, pageOffset: number, filters: GridFilter[] = []) => {
      updateTableTabState(tabId, { loading: true, error: null });
      try {
        const r = await fetchTablePage(table, pageOffset, filters.length > 0 ? filters : null);
        let pkCol = "";
        if (pageOffset === 0) {
          const cols = r.columns;
          const lower = cols.map((c) => c.toLowerCase());
          pkCol = cols[lower.indexOf("id")] ??
            cols[lower.findIndex((c) => c.endsWith("_id") || c === "uuid")] ??
            cols[0] ?? "";
        }
        updateTableTabState(tabId, {
          result: r,
          offset: pageOffset,
          loading: false,
          ...(pageOffset === 0 ? { primaryKeyColumn: pkCol, filters, pendingChanges: [] } : { filters }),
        });
      } catch (e) {
        const msg = fmtErr(e);
        updateTableTabState(tabId, { error: msg, loading: false });
        toast.error(msg);
      }
    },
    [fetchTablePage, updateTableTabState, toast],
  );

  const reloadHandlerRef = useRef<(() => void) | null>(null);
  useEffect(() => {
    const dispatch = () => reloadHandlerRef.current?.();
    window.addEventListener("dib:reload", dispatch);
    return () => window.removeEventListener("dib:reload", dispatch);
  }, []);

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
        loadTablePage(tab.id, ts.table, ts.offset, ts.filters).finally(() => setIsReloading(false));
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
        loadTablePage(tabId, ts.table, ts.offset, ts.filters);
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
      const newTab: TabData = { id: tabId, type: "sql_editor", title: name, isDirty: false, payload: { sql, filename: name }, closeable: true };
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
        if (initialFilters?.length) loadTablePage(tid, table, 0, initialFilters);
        return;
      }
      const newTab: TabData = { id: tid, type: "table", title: table.schema ? `${table.schema}.${table.name}` : table.name, isDirty: false, payload: { table }, closeable: true };
      tabsRef.current = [...tabsRef.current, newTab];
      setTabs(tabsRef.current);
      setTableTabStates((prev) => ({ ...prev, [tid]: prev[tid] || defaultTableTabState(table) }));
      setActiveTabId(tid);
      loadTablePage(tid, table, 0, initialFilters ?? []);
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
    setTabs((prev) => prev.map((t) => t.confirmClose ? { ...t, confirmClose: false } : t));
  }, []);

  const handleTabClose = useCallback((id: string) => {
    setTabs((prev) => {
      const tab = prev.find((t) => t.id === id);
      if (!tab) return prev;
      if (tab.isDirty && !tab.confirmClose) return prev.map((t) => t.id === id ? { ...t, confirmClose: true } : t);
      if (tab.closeable) {
        closedTabsHistoryRef.current = [...closedTabsHistoryRef.current.slice(-9), { tab, sql: tabSqlRef.current[id] }];
      }
      const next = prev.filter((t) => t.id !== id);
      setActiveTabId((cur) => cur === id ? (next.length > 0 ? next[next.length - 1].id : "") : cur);
      removeTabSql(id);
      setTableTabStates((p) => { const n = { ...p }; delete n[id]; return n; });
      return next;
    });
  }, [removeTabSql]);

  const handleTabReorder = useCallback((newTabs: TabData[]) => setTabs(newTabs), []);

  // ── Event listeners ────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: Event) => {
      const table = (e as CustomEvent<TableInfo>).detail;
      if (table) openTableStructureTab(table);
    };
    window.addEventListener("dib:open-table-structure", handler);
    return () => window.removeEventListener("dib:open-table-structure", handler);
  }, [openTableStructureTab]);

  useEffect(() => {
    const handler = (e: Event) => {
      const table = (e as CustomEvent<TableInfo>).detail;
      if (table) openRelationTab(table);
    };
    window.addEventListener("dib:open-table-relations", handler);
    return () => window.removeEventListener("dib:open-table-relations", handler);
  }, [openRelationTab]);

  useEffect(() => {
    const closeTab = () => {
      const tab = activeTabRef.current;
      const tabId = activeTabIdRef.current;
      if (tab?.closeable) handleTabClose(tabId);
    };
    const newTab = () => {
      dbService.getNextScriptNumber()
        .then((count) => { const n = count + 1; openSqlTab("", n === 1 ? "Untitled.sql" : `Untitled-${n}.sql`); })
        .catch(() => openSqlTab("", "Untitled.sql"));
    };
    window.addEventListener("dib:close-tab", closeTab);
    window.addEventListener("dib:new-tab", newTab);
    return () => { window.removeEventListener("dib:close-tab", closeTab); window.removeEventListener("dib:new-tab", newTab); };
  }, [handleTabClose, openSqlTab]);

  // ── Navigate/openScript from App ───────────────────────────────────────
  useEffect(() => { if (navigateTo) openTableTab(navigateTo.table); }, [navigateTo]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (openScript) openSqlTab(openScript.sql, openScript.name, openScript.id); }, [openScript]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Active table → sidebar highlight ──────────────────────────────────
  useEffect(() => {
    const tab = tabs.find((t) => t.id === activeTabId);
    const detail = (tab?.type === "table" && tab.payload.table)
      ? { name: tab.payload.table.name, schema: tab.payload.table.schema ?? null }
      : null;
    window.dispatchEvent(new CustomEvent("dib:active-table", { detail }));
  }, [activeTabId, tabs]);

  // ── Focus active tab ───────────────────────────────────────────────────
  useEffect(() => {
    if (!activeTabId) return;
    requestAnimationFrame(() => {
      const main = document.getElementById("dib-main-panel");
      const tab = tabs.find((t) => t.id === activeTabId);
      if (tab?.type === "sql_editor") {
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
              workspaceService.saveInternalScript(newId, result.name, result.content).catch(console.error);
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
      handler: () => { if (activeTabRef.current?.type === "table") window.dispatchEvent(new CustomEvent("dib:insert-row")); },
      allowInMonaco: false,
    },
    {
      combo: "ctrl+t",
      handler: () => {
        dbService.getNextScriptNumber()
          .then((count) => { const n = count + 1; openSqlTab("", n === 1 ? "Untitled.sql" : `Untitled-${n}.sql`); })
          .catch(() => openSqlTab("", "Untitled.sql"));
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
            return [...prev, { ...tab, confirmClose: false, isDirty: false }];
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
    workspaceService.saveInternalScript(newId, name, sql).catch(console.error);
  }, [openSqlTab]);

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
    if (tab?.payload.table) loadTablePage(activeTabIdRef.current, tab.payload.table, 0, newFilters);
  }, [loadTablePage]);

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
  const gridCols = useMemo(() => activeTableState?.result?.columns ?? [], [activeTableState?.result?.columns]);
  const totalRows = activeTableState?.result?.total ?? 0;
  const currentPage = Math.floor((activeTableState?.offset ?? 0) / PAGE_SIZE);
  const totalPages = Math.ceil(totalRows / PAGE_SIZE);

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
              {activeTab.payload.table && (
                <button className="qp-structure-btn" title="Ver Estructura" onClick={() => activeTab.payload.table && openTableStructureTab(activeTab.payload.table)}>
                  <Layers size={14} />
                </button>
              )}
            </div>
            {!activeTableState?.loading && !activeTableState?.result && !activeTableState?.error && (
              <div className="qp-data-empty"><p>Cargando tabla…</p></div>
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
                  onClick={() => activeTab.payload.table && loadTablePage(activeTabId, activeTab.payload.table, (activeTableState.offset ?? 0) - PAGE_SIZE, activeTableState.filters)}
                >‹ Prev</button>
                <span className="qp-page-info">{currentPage + 1} / {totalPages}</span>
                <button
                  className="qp-page-btn"
                  disabled={currentPage >= totalPages - 1 || activeTableState.loading}
                  onClick={() => activeTab.payload.table && loadTablePage(activeTabId, activeTab.payload.table, (activeTableState.offset ?? 0) + PAGE_SIZE, activeTableState.filters)}
                >Next ›</button>
              </div>
            )}
            <div className="qp-footer-row">
              <CommitFooter
                changes={activeTableState?.pendingChanges ?? []}
                committing={committing === activeTabId}
                onRevert={() => {
                  updateTableTabState(activeTabId, { pendingChanges: [] });
                  markTabClean(activeTabId);
                  if (activeTab.payload.table) loadTablePage(activeTabId, activeTab.payload.table, 0, []);
                }}
                onApply={() => handleCommit(activeTabId)}
              />
            </div>
          </>
        )}

        {activeTab?.type === "sql_editor" && (
          <SqlEditor
            connectionId={connectionId}
            connectionName={connectionName}
            initialSql={tabSql[activeTabId] ?? activeTab.payload.sql}
            onImportScript={handleImportScriptAndSave}
            onDirty={() => markTabDirty(activeTabId)}
            onSaveScript={(sql) => saveSqlTab(activeTabId, sql)}
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
    </div>
  );
}
