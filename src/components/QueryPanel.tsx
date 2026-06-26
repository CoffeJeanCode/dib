import { useState, useEffect, useMemo, useCallback, useRef, useContext } from "react";
import { dbService } from "../services/dbService";
import { workspaceService } from "../services/workspaceService";

function fmtErr(e: unknown): string {
  if (typeof e === "string") return e;
  if (e && typeof e === "object") {
    const o = e as Record<string, unknown>;
    return String(o.message ?? o.error ?? o.msg ?? JSON.stringify(e));
  }
  return "Unknown error";
}
import { useKeybindings } from "../hooks/useKeybindings";
import { Layers } from "lucide-react";
import type { TableInfo, ColumnInfo, PagedResult, PendingChange, GridFilter, TableRelation } from "../types/db";
import type { TabData, TabPayload } from "./Tab";
import { TableStructureView } from "./TableStructureView";


import { DataGrid } from "./DataGrid";
import { CommitFooter } from "./CommitFooter";
import { TabBar } from "./TabBar";
import { SqlEditor } from "./SqlEditor";
import { SchemaVisualizer } from "./SchemaVisualizer";
import { EmptyWorkspaceState } from "./EmptyWorkspaceState";
import { ToastContext } from "../App";
import "./QueryPanel.css";

const PAGE_SIZE = 100;

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
  const [tables, setTables] = useState<TableInfo[]>([]);
  const [columnMap, setColumnMap] = useState<Record<string, ColumnInfo[]>>({});

  const [tabs, setTabs] = useState<TabData[]>([]);
  const tabsRef = useRef(tabs);
  tabsRef.current = tabs;

  const [activeTabId, setActiveTabId] = useState("");
  const closedTabsHistoryRef = useRef<Array<{ tab: TabData; sql?: string }>>([]);
  const tabSqlRef = useRef<Record<string, string>>({}); 

  const [tableTabStates, setTableTabStates] = useState<Record<string, TableTabState>>({});
  const [tabSql, setTabSql] = useState<Record<string, string>>({});
  tabSqlRef.current = tabSql;

  const [tableRelations, setTableRelations] = useState<Record<string, TableRelation[]>>({});
  const tableRelationsRef = useRef(tableRelations);
  tableRelationsRef.current = tableRelations;
  const [committing, setCommitting] = useState<string | null>(null);
  const [isReloading, setIsReloading] = useState(false);

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

  useKeybindings([
    {
      combo: "ctrl+w",
      handler: () => {
        const tab = tabs.find((t) => t.id === activeTabId);
        if (tab?.closeable) handleTabClose(activeTabId);
      },
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
      handler: () => {
        setTabs([]);
        setActiveTabId("");
        setTableTabStates({});
        setTabSql({});
      },
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
      handler: () => {
        if (activeTabRef.current?.type === "table") {
          window.dispatchEvent(new CustomEvent("dib:insert-row"));
        }
      },
      allowInMonaco: false,
    },
    {
      combo: "ctrl+t",
      handler: () => {
        // CRITERIO 3: Use real COUNT(*) from saved_scripts for correct sequential numbering.
        dbService.getNextScriptNumber()
          .then((count) => {
            const n = count + 1;
            const name = n === 1 ? "Untitled.sql" : `Untitled-${n}.sql`;
            openSqlTab("", name);
          })
          .catch(() => {
            // Fallback: if the command fails, still open a tab
            openSqlTab("", "Untitled.sql");
          });
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
          if (sql !== undefined) setTabSql((prev) => ({ ...prev, [tab.id]: sql }));
          setActiveTabId(tab.id);
        }
      },
      allowInMonaco: true,
    },
  ]);

  const markTabDirty = useCallback((tabId: string) => {
    setTabs((prev) => prev.map((t) => t.id === tabId ? { ...t, isDirty: true } : t));
  }, []);

  const markTabClean = useCallback((tabId: string) => {
    setTabs((prev) => prev.map((t) => t.id === tabId ? { ...t, isDirty: false } : t));
  }, []);

  const updateTableTabState = useCallback((tabId: string, patch: Partial<TableTabState>) => {
    setTableTabStates((prev) => {
      const existing = prev[tabId];
      const base = existing ?? defaultTableTabState({ name: "", schema: null });
      return { ...prev, [tabId]: { ...base, ...patch } };
    });
  }, []);

  useEffect(() => {
    setTables([]);
    setColumnMap({});
    let mounted = true;
    dbService.fetchTables(connectionId)
      .then((data) => { if (mounted) setTables(data); })
      .catch(() => {});
    return () => { mounted = false; };
  }, [connectionId]);

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
    tables.forEach((t) => {
      if (columnMap[t.name] !== undefined) return;
      dbService.fetchTableSchema(connectionId, t.name, t.schema ?? null)
        .then((cols) => setColumnMap((prev) => ({ ...prev, [t.name]: cols })))
        .catch(() => setColumnMap((prev) => ({ ...prev, [t.name]: [] })));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTabId]);

  const loadTablePage = useCallback(
    async (tabId: string, table: TableInfo, pageOffset: number, filters: GridFilter[] = []) => {
      updateTableTabState(tabId, { loading: true, error: null });
      try {
        const r = await dbService.fetchTableData(
          connectionId,
          table.name,
          table.schema ?? null,
          pageOffset,
          PAGE_SIZE,
          filters.length > 0 ? filters : null,
        );
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
    [connectionId, updateTableTabState, toast],
  );

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

  const openTableTab = useCallback(
    (table: TableInfo, initialFilters?: GridFilter[]) => {
      const tid = tableTabId(table);
      const exists = tabsRef.current.some((t) => t.id === tid);
      
      if (exists) {
        setActiveTabId(tid);
        if (initialFilters?.length) loadTablePage(tid, table, 0, initialFilters);
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
        [tid]: prev[tid] || defaultTableTabState(table),
      }));
      setActiveTabId(tid);
      loadTablePage(tid, table, 0, initialFilters ?? []);
      
      if (!tableRelationsRef.current) tableRelationsRef.current = {};
      if (!tableRelationsRef.current[table.name]) {
        // Eagerly mark as loading to prevent double fetches
        tableRelationsRef.current[table.name] = [];
        dbService.fetchTableRelations(connectionId, table.name, table.schema ?? null)
          .then((rels) => {
             tableRelationsRef.current[table.name] = rels;
             setTableRelations((prev) => ({ ...prev, [table.name]: rels }));
          })
          .catch(() => {});
      }
    },
    [loadTablePage, connectionId],
  );

  const openTableStructureTab = useCallback((table: TableInfo) => {
    const structureTabId = `structure-${table.schema ?? "public"}-${table.name}`;
    const dataTabId = tableTabId(table);
    setTabs((prev) => {
      // If structure tab is already the active one, toggle back to data tab
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
      // Place structure tab right after the data tab for logical grouping
      const dataTabIdx = prev.findIndex((t) => t.id === dataTabId);
      setActiveTabId(structureTabId);
      if (dataTabIdx !== -1) {
        const next = [...prev];
        next.splice(dataTabIdx + 1, 0, newTab);
        return next;
      }
      return [...prev, newTab];
    });
  }, []); // tableTabId is a pure module-level fn, no deps needed

  /** Toggle between data tab and structure tab for the same table. */
  const toggleStructureTab = useCallback((table: TableInfo) => {
    const structureTabId = `structure-${table.schema ?? "public"}-${table.name}`;
    const dataTabId = tableTabId(table);
    setTabs((prev) => {
      const structureExists = prev.some((t) => t.id === structureTabId);
      const dataExists = prev.some((t) => t.id === dataTabId);
      // If currently on data tab → open/focus structure
      if (activeTabId === dataTabId) {
        if (structureExists) { setActiveTabId(structureTabId); return prev; }
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
      // If currently on structure tab → navigate back to data tab
      if (activeTabId === structureTabId && dataExists) {
        setActiveTabId(dataTabId);
        return prev;
      }
      // Otherwise open structure tab normally
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
  }, [activeTabId]); // tableTabId is a pure module-level fn

  useEffect(() => {
    const handler = (e: Event) => {
      const table = (e as CustomEvent<TableInfo>).detail;
      if (table) openTableStructureTab(table);
    };
    window.addEventListener("dib:open-table-structure", handler);
    return () => window.removeEventListener("dib:open-table-structure", handler);
  }, [openTableStructureTab]);

  const openSqlTab = useCallback((sql: string, name: string, scriptId?: string) => {
    const tabId = scriptId ?? crypto.randomUUID();
    setTabs((prev) => {
      if (prev.some((t) => t.id === tabId)) {
        setActiveTabId(tabId);
        return prev;
      }
      const newTab: TabData = {
        id: tabId,
        type: "sql_editor",
        title: name,
        isDirty: false,
        payload: { sql, filename: name },
        closeable: true,
      };
      setTabSql((prev2) => ({ ...prev2, [tabId]: sql }));
      setActiveTabId(tabId);
      return [...prev, newTab];
    });
  }, []);

  useEffect(() => {
    if (!navigateTo) return;
    openTableTab(navigateTo.table);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigateTo]);

  useEffect(() => {
    if (!openScript) return;
    openSqlTab(openScript.sql, openScript.name, openScript.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openScript]);

  const handleTabSelect = useCallback((id: string) => {
    setActiveTabId(id);
    setTabs((prev) => prev.map((t) => t.confirmClose ? { ...t, confirmClose: false } : t));
  }, []);

  const handleTabClose = useCallback((id: string) => {
    setTabs((prev) => {
      const tab = prev.find((t) => t.id === id);
      if (!tab) return prev;
      if (tab.isDirty && !tab.confirmClose) {
        return prev.map((t) => t.id === id ? { ...t, confirmClose: true } : t);
      }
      if (tab.closeable) {
        closedTabsHistoryRef.current = [
          ...closedTabsHistoryRef.current.slice(-9),
          { tab, sql: tabSqlRef.current[id] },
        ];
      }
      const next = prev.filter((t) => t.id !== id);
      setActiveTabId((cur) => cur === id ? (next.length > 0 ? next[next.length - 1].id : "") : cur);
      setTabSql((p) => { const n = { ...p }; delete n[id]; return n; });
      setTableTabStates((p) => { const n = { ...p }; delete n[id]; return n; });
      return next;
    });
  }, []);

  const handleTabReorder = useCallback((newTabs: TabData[]) => {
    setTabs(newTabs);
  }, []);

  const handleCommit = useCallback(
    async (tabId: string) => {
      const ts = tableTabStates[tabId];
      if (!ts || ts.pendingChanges.length === 0) return;
      setCommitting(tabId);
      try {
        await dbService.applyChanges(connectionId, ts.table.name, ts.primaryKeyColumn, ts.pendingChanges);
        updateTableTabState(tabId, { pendingChanges: [] });
        markTabClean(tabId);
        loadTablePage(tabId, ts.table, ts.offset, ts.filters);
      } catch (e) {
        updateTableTabState(tabId, { error: fmtErr(e) });
      } finally {
        setCommitting(null);
        requestAnimationFrame(() => {
          const grid = document.querySelector<HTMLElement>('.dg-wrap');
          grid?.focus();
        });
      }
    },
    [tableTabStates, connectionId, updateTableTabState, markTabClean, loadTablePage],
  );

  const saveSqlTab = useCallback(
    async (tabId: string, sql: string) => {
      const tab = tabs.find((t) => t.id === tabId);
      if (!tab) return;
      const title = tab.title;
      try {
        await workspaceService.saveInternalScript(tabId, title, sql);
        markTabClean(tabId);
        setTabSql((prev) => ({ ...prev, [tabId]: sql }));
        setTabs((prev) => prev.map((t) =>
          t.id === tabId ? { ...t, payload: { ...t.payload, sql } } : t,
        ));
        window.dispatchEvent(new CustomEvent("dib:script-saved"));
      } catch (e) {
        console.error("[DIB] save_internal_script failed:", e);
      }
    },
    [tabs, markTabClean],
  );

  useEffect(() => {
    if (!activeTabId) return;
    requestAnimationFrame(() => {
      const main = document.getElementById("dib-main-panel");
      const tab = tabs.find((t) => t.id === activeTabId);
      if (tab?.type === "sql_editor") {
        // CRITERIO 2: For sql_editor tabs, always focus Monaco — never the result grid.
        const editor = main?.querySelector<HTMLElement>(".monaco-editor textarea");
        editor?.focus();
      } else {
        const grid = main?.querySelector<HTMLElement>(".dg-wrap");
        const editor = main?.querySelector<HTMLElement>(".monaco-editor textarea");
        (grid ?? editor)?.focus();
      }
    });
  }, [activeTabId]); // eslint-disable-line react-hooks/exhaustive-deps

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

  // Dispatch active table to left sidebar for active state highlighting
  useEffect(() => {
    const tab = tabs.find((t) => t.id === activeTabId);
    const detail = (tab?.type === "table" && tab.payload.table)
      ? { name: tab.payload.table.name, schema: tab.payload.table.schema ?? null }
      : null;
    window.dispatchEvent(new CustomEvent("dib:active-table", { detail }));
  }, [activeTabId, tabs]);

  // Listen for relation tab open from left sidebar context menu
  useEffect(() => {
    const handler = (e: Event) => {
      const table = (e as CustomEvent<TableInfo>).detail;
      if (table) openRelationTab(table);
    };
    window.addEventListener("dib:open-table-relations", handler);
    return () => window.removeEventListener("dib:open-table-relations", handler);
  }, [openRelationTab]);

  const handleImportScriptAndSave = useCallback((sql: string, name: string) => {
    const newId = crypto.randomUUID();
    openSqlTab(sql, name, newId);
    workspaceService.saveInternalScript(newId, name, sql).catch(console.error);
  }, [openSqlTab]);


  const activeTab = tabs.find((t) => t.id === activeTabId) ?? null;
  const activeTableState = activeTabId ? tableTabStates[activeTabId] ?? null : null;

  const gridRows = useMemo(() => activeTableState?.result?.rows ?? [], [activeTableState?.result?.rows]);
  const gridCols = useMemo(() => activeTableState?.result?.columns ?? [], [activeTableState?.result?.columns]);

  const activeTabIdRef = useRef(activeTabId);
  activeTabIdRef.current = activeTabId;
  const activeTabRef = useRef(activeTab);
  activeTabRef.current = activeTab;

  const handleSaveViewState = useCallback((tabId: string, viewState: unknown) => {
    setTabs((prev) =>
      prev.map((t) =>
        t.id === tabId ? { ...t, payload: { ...t.payload, viewState } } : t,
      ),
    );
  }, []);

  // Stable callback: syncs unsaved SQL content to global tabSql state so tab switches
  // don't lose content that hasn't been explicitly saved yet.
  const handleContentChange = useCallback((sql: string) => {
    setTabSql((prev) => ({ ...prev, [activeTabIdRef.current]: sql }));
  }, []);

  // Listen for custom events dispatched by Monaco's addCommand handlers (Ctrl+W / Ctrl+T)
  // so these shortcuts work even when Monaco has focus.
  useEffect(() => {
    const closeTab = () => {
      const tab = activeTabRef.current;
      const tabId = activeTabIdRef.current;
      if (tab?.closeable) handleTabClose(tabId);
    };
    const newTab = () => {
      dbService.getNextScriptNumber()
        .then((count) => {
          const n = count + 1;
          openSqlTab("", n === 1 ? "Untitled.sql" : `Untitled-${n}.sql`);
        })
        .catch(() => openSqlTab("", "Untitled.sql"));
    };
    window.addEventListener("dib:close-tab", closeTab);
    window.addEventListener("dib:new-tab", newTab);
    return () => {
      window.removeEventListener("dib:close-tab", closeTab);
      window.removeEventListener("dib:new-tab", newTab);
    };
  }, [handleTabClose, openSqlTab]);

  const handleGridActiveCellChange = useCallback((cell: { row: number; col: number } | null) => {
    const tabId = activeTabIdRef.current;
    setTabs((prev) =>
      prev.map((t) =>
        t.id === tabId ? { ...t, payload: { ...t.payload, activeCell: cell } } : t,
      ),
    );
  }, []);

  const handleGridPendingChanges = useCallback(
    (changes: import("../types/db").PendingChange[]) => {
      if (!activeTabId) return;
      setTableTabStates((prev) => {
        const existing = prev[activeTabId];
        if (!existing) return prev;
        // Avoid infinite loop if no changes and it was already empty
        if (changes.length === 0 && existing.pendingChanges.length === 0) return prev;
        return { ...prev, [activeTabId]: { ...existing, pendingChanges: changes } };
      });
      if (changes.length > 0) markTabDirty(activeTabId);
      else markTabClean(activeTabId);
    },
    [activeTabId, markTabDirty, markTabClean, setTableTabStates],
  );

  const handleGridFiltersChange = useCallback((newFilters: import("../types/db").GridFilter[]) => {
    const tabId = activeTabIdRef.current;
    const tab = activeTabRef.current;
    if (tab?.payload.table) loadTablePage(tabId, tab.payload.table, 0, newFilters);
  }, [loadTablePage]);

  const handleGridSave = useCallback((changes: import("../types/db").PendingChange[]): Promise<void> => {
    if (changes.length > 0) return handleCommit(activeTabIdRef.current);
    return Promise.resolve();
  }, [handleCommit]);

  const handleGridForceClose = useCallback(() => {
    handleTabClose(activeTabIdRef.current);
  }, [handleTabClose]);

  const handleGridFocusEditor = useCallback(() => {
    const main = document.getElementById("dib-main-panel");
    const editor = main?.querySelector<HTMLElement>(".monaco-editor textarea");
    const grid = main?.querySelector<HTMLElement>(".dg-wrap");
    (editor ?? grid ?? main)?.focus();
  }, []);

  const handleFkNavigate = useCallback(
    (targetTable: string, targetColumn: string, value: unknown) => {
      const table = tables.find((t) => t.name === targetTable) ?? { name: targetTable, schema: null };
      const filter: GridFilter = { column: targetColumn, operator: "=", value: String(value) };
      openTableTab(table, [filter]);
    },
    [tables, openTableTab],
  );

  const handleGridSaveError = useCallback((msg: string) => {
    toast.warn(`Rollback: ${msg}`);
  }, [toast]);


  const totalRows = activeTableState?.result?.total ?? 0;
  const currentPage = Math.floor((activeTableState?.offset ?? 0) / PAGE_SIZE);
  const totalPages = Math.ceil(totalRows / PAGE_SIZE);

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
            {activeTableState?.error && <div className="qp-data-error">{activeTableState.error}</div>}
            {(activeTableState?.loading || activeTableState?.result) && (
              <div className="qp-grid-header">
                <span className="qp-breadcrumb">
                  {activeTab.payload.table?.schema
                    ? `${activeTab.payload.table.schema}.${activeTab.payload.table.name}`
                    : activeTab.payload.table?.name}
                </span>
                {activeTab.payload.table && (
                  <button
                    className="qp-structure-btn"
                    title="Ver Estructura"
                    onClick={() => activeTab.payload.table && openTableStructureTab(activeTab.payload.table)}
                  >
                    <Layers size={14} />
                  </button>
                )}
              </div>
            )}
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
                  onClick={() => activeTab.payload.table && loadTablePage(
                    activeTabId, activeTab.payload.table,
                    (activeTableState.offset ?? 0) - PAGE_SIZE,
                    activeTableState.filters,
                  )}
                >
                  ‹ Prev
                </button>
                <span className="qp-page-info">{currentPage + 1} / {totalPages}</span>
                <button
                  className="qp-page-btn"
                  disabled={currentPage >= totalPages - 1 || activeTableState.loading}
                  onClick={() => activeTab.payload.table && loadTablePage(
                    activeTabId, activeTab.payload.table,
                    (activeTableState.offset ?? 0) + PAGE_SIZE,
                    activeTableState.filters,
                  )}
                >
                  Next ›
                </button>
              </div>
            )}
            <div className="qp-footer-row">
              <CommitFooter
                changes={activeTableState?.pendingChanges ?? []}
                committing={committing === activeTabId}
                onRevert={() => {
                  updateTableTabState(activeTabId, { pendingChanges: [] });
                  markTabClean(activeTabId);
                  if (activeTab.payload.table) {
                    loadTablePage(activeTabId, activeTab.payload.table, 0, []);
                  }
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
          <TableStructureView
            connectionId={connectionId}
            table={activeTab.payload.table}
          />
        )}

        {!activeTab && <EmptyWorkspaceState />}
      </div>
    </div>
  );
}
