import { useState, useEffect, useMemo, useCallback, useRef, useContext } from "react";
import { invoke } from "@tauri-apps/api/core";

function fmtErr(e: unknown): string {
  if (typeof e === "string") return e;
  if (e && typeof e === "object") {
    const o = e as Record<string, unknown>;
    return String(o.message ?? o.error ?? o.msg ?? JSON.stringify(e));
  }
  return "Unknown error";
}
import { useKeybindings } from "../hooks/useKeybindings";
import {
  LogOut, Network, ChevronRight,
  Key, Hash, Type, Calendar,
  Table2, Pencil, Trash2,
} from "lucide-react";
import type { TableInfo, ColumnInfo, PagedResult, PendingChange, GridFilter } from "../types/db";
import type { TabData, TabPayload } from "./Tab";

function colIcon(col: ColumnInfo) {
  if (col.is_primary_key) return <Key size={12} className="qp-col-icon qp-col-icon--pk" />;
  const t = col.data_type.toUpperCase();
  if (/INT|FLOAT|NUMERIC|DECIMAL|REAL|DOUBLE|SERIAL|NUMBER/.test(t))
    return <Hash size={12} className="qp-col-icon qp-col-icon--num" />;
  if (/DATE|TIME|TIMESTAMP/.test(t))
    return <Calendar size={12} className="qp-col-icon qp-col-icon--date" />;
  return <Type size={12} className="qp-col-icon qp-col-icon--text" />;
}


import { DataGrid } from "./DataGrid";
import { CommitFooter } from "./CommitFooter";
import { TabBar } from "./TabBar";
import { SqlEditor } from "./SqlEditor";
import { SchemaVisualizer } from "./SchemaVisualizer";
import { EmptyWorkspaceState } from "./EmptyWorkspaceState";
import { ContextMenu } from "./ContextMenu";
import { useContextMenu } from "../hooks/useContextMenu";
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
  onDisconnect?: () => void;
  navigateTo?: { table: TableInfo; v: number } | null;
  openScript?: { sql: string; name: string; id: string; v: number } | null;
}

export function QueryPanel({ connectionId, connectionName, engine, onDisconnect, navigateTo, openScript }: QueryPanelProps) {
  const toast = useContext(ToastContext);
  const [tables, setTables] = useState<TableInfo[]>([]);
  const [tablesLoading, setTablesLoading] = useState(true);
  const [tablesError, setTablesError] = useState<string | null>(null);
  const [columnMap, setColumnMap] = useState<Record<string, ColumnInfo[]>>({});
  const [expandedTables, setExpandedTables] = useState<Set<string>>(new Set());

  const [tabs, setTabs] = useState<TabData[]>([]);
  const [activeTabId, setActiveTabId] = useState("");
  const untitledCounterRef = useRef(0);
  // Stack of closed tabs for Ctrl+Shift+T resurrection
  const closedTabsHistoryRef = useRef<Array<{ tab: TabData; sql?: string }>>([]);
  // Stable ref to tabSql so handleTabClose can read it without capturing stale closure
  const tabSqlRef = useRef<Record<string, string>>({});

  // Per-table-tab state
  const [tableTabStates, setTableTabStates] = useState<Record<string, TableTabState>>({});

  // SQL tab content
  const [tabSql, setTabSql] = useState<Record<string, string>>({});
  tabSqlRef.current = tabSql;

  const { menuState, openMenu, closeMenu } = useContextMenu();
  const [contextTable, setContextTable] = useState<TableInfo | null>(null);
  const [committing, setCommitting] = useState<string | null>(null); // tabId being committed

  // ── Tab navigation shortcuts ──────────────────────────────
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
      // Force-close active tab, ignoring dirty state
      combo: "ctrl+shift+w",
      handler: () => handleTabClose(activeTabId),
      allowInMonaco: true,
    },
    {
      // Import SQL file → save to internal DB then open tab
      combo: "ctrl+o",
      handler: () => {
        invoke<{ name: string; content: string } | null>("import_script_dialog")
          .then((result) => {
            if (result) {
              const newId = crypto.randomUUID();
              openSqlTab(result.content, result.name, newId);
              invoke("save_internal_script", { id: newId, title: result.name, content: result.content })
                .catch(console.error);
            }
          })
          .catch(() => {});
      },
      allowInMonaco: true,
    },
    {
      // Focus the active content panel (Monaco editor or DataGrid)
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
      // New untitled SQL editor tab
      combo: "ctrl+t",
      handler: () => {
        untitledCounterRef.current += 1;
        const count = untitledCounterRef.current;
        const name = count === 1 ? "Untitled.sql" : `Untitled-${count}.sql`;
        openSqlTab("", name);
      },
      allowInMonaco: true,
    },
    {
      // Reopen last closed tab
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

  // ── Helpers ────────────────────────────────────────────
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

  // ── Load table list (no schemas — lazy) ────────────────
  // Depends on connectionName too: switching the active database (same connection,
  // different db) keeps connectionId but changes the db name, so this re-runs and
  // repopulates the tree. Clear stale entities + cached columns first.
  useEffect(() => {
    setTables([]);
    setColumnMap({});
    setExpandedTables(new Set());
    setTablesLoading(true);
    setTablesError(null);
    invoke<TableInfo[]>("fetch_tables", { connectionId })
      .then(setTables)
      .catch(() => {
        setTablesError("Error cargando tablas");
        toast.error("Error cargando tablas");
      })
      .finally(() => setTablesLoading(false));
  }, [connectionId, connectionName]);

  // ── Ctrl+R reload listener — registered once, handler updated via ref ──
  const reloadHandlerRef = useRef<(() => void) | null>(null);
  useEffect(() => {
    const dispatch = () => reloadHandlerRef.current?.();
    window.addEventListener("dib:reload", dispatch);
    return () => window.removeEventListener("dib:reload", dispatch);
  }, []);

  // ── Lazy column load on expand ──────────────────────────
  const loadColumnsIfNeeded = useCallback(
    (table: TableInfo) => {
      if (columnMap[table.name] !== undefined) return;
      invoke<ColumnInfo[]>("fetch_table_schema", {
        connectionId,
        tableName: table.name,
        schema: table.schema ?? null,
      })
        .then((cols) => setColumnMap((prev) => ({ ...prev, [table.name]: cols })))
        .catch(() => setColumnMap((prev) => ({ ...prev, [table.name]: [] })));
    },
    [connectionId, columnMap],
  );

  // ── Load table data for a tab ────────────────────────────
  const loadTablePage = useCallback(
    async (tabId: string, table: TableInfo, pageOffset: number, filters: GridFilter[] = []) => {
      updateTableTabState(tabId, { loading: true, error: null });
      try {
        const r = await invoke<PagedResult>("fetch_table_data", {
          connectionId,
          tableName: table.name,
          schema: table.schema ?? null,
          offset: pageOffset,
          limit: PAGE_SIZE,
          filters: filters.length > 0 ? filters : null,
        });
        // Auto-detect PK
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

  // Update reload handler every render so it always has fresh closures
  reloadHandlerRef.current = () => {
    const tab = tabs.find((t) => t.id === activeTabId) ?? null;
    if (tab?.type === "table" && tab.payload.table) {
      const ts = tableTabStates[tab.id];
      if (ts) loadTablePage(tab.id, ts.table, ts.offset, ts.filters);
    }
  };

  // ── Open / activate a table tab ──────────────────────────
  const openTableTab = useCallback(
    (table: TableInfo) => {
      const tid = tableTabId(table);
      const exists = tabs.some((t) => t.id === tid);
      if (exists) {
        setActiveTabId(tid);
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
      setTabs((prev) => [...prev, newTab]);
      setTableTabStates((prev) => ({
        ...prev,
        [tid]: defaultTableTabState(table),
      }));
      setActiveTabId(tid);
      loadTablePage(tid, table, 0, []);
    },
    [tabs, loadTablePage],
  );

  // ── Open SQL editor tab ──────────────────────────────────
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

  // ── External navigation ──────────────────────────────────
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

  // ── Tab select — clears any pending confirmClose on other tabs ──
  const handleTabSelect = useCallback((id: string) => {
    setActiveTabId(id);
    setTabs((prev) => prev.map((t) => t.confirmClose ? { ...t, confirmClose: false } : t));
  }, []);

  // ── Tab close — first click on dirty tab prompts, second actually closes ──
  const handleTabClose = useCallback((id: string) => {
    setTabs((prev) => {
      const tab = prev.find((t) => t.id === id);
      if (!tab) return prev;
      if (tab.isDirty && !tab.confirmClose) {
        return prev.map((t) => t.id === id ? { ...t, confirmClose: true } : t);
      }
      // Push to closed-tabs history before removing (enables Ctrl+Shift+T)
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

  // ── Commit pending changes ───────────────────────────────
  const handleCommit = useCallback(
    async (tabId: string) => {
      const ts = tableTabStates[tabId];
      if (!ts || ts.pendingChanges.length === 0) return;
      setCommitting(tabId);
      try {
        await invoke("apply_changes", {
          connectionId,
          table: ts.table.name,
          primaryKeyColumn: ts.primaryKeyColumn,
          changes: ts.pendingChanges,
        });
        updateTableTabState(tabId, { pendingChanges: [] });
        markTabClean(tabId);
        loadTablePage(tabId, ts.table, ts.offset, ts.filters);
      } catch (e) {
        updateTableTabState(tabId, { error: fmtErr(e) });
      } finally {
        setCommitting(null);
      }
    },
    [tableTabStates, connectionId, updateTableTabState, markTabClean, loadTablePage],
  );

  // ── Save SQL tab → always persists to internal SQLite ───────
  const saveSqlTab = useCallback(
    async (tabId: string, sql: string) => {
      const tab = tabs.find((t) => t.id === tabId);
      if (!tab) return;
      const title = tab.title;
      try {
        await invoke("save_internal_script", { id: tabId, title, content: sql });
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

  // ── Auto-focus content when switching tabs ───────────────
  useEffect(() => {
    if (!activeTabId) return;
    requestAnimationFrame(() => {
      const main = document.getElementById("dib-main-panel");
      const grid = main?.querySelector<HTMLElement>(".dg-wrap");
      const editor = main?.querySelector<HTMLElement>(".monaco-editor textarea");
      (grid ?? editor)?.focus();
    });
  }, [activeTabId]);

  // ── Schema / relation tab ────────────────────────────────
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

  // ── SQL snippet open ─────────────────────────────────────
  const openSnippetTab = useCallback((sql: string, label: string) => {
    openSqlTab(sql, label);
  }, [openSqlTab]);

  // ── Import from file: open tab + persist to internal DB ──
  const handleImportScriptAndSave = useCallback((sql: string, name: string) => {
    const newId = crypto.randomUUID();
    openSqlTab(sql, name, newId);
    invoke("save_internal_script", { id: newId, title: name, content: sql }).catch(console.error);
  }, [openSqlTab]);

  // ── Column tree toggle (lazy-load columns on first expand) ─
  const toggleExpand = useCallback((table: TableInfo) => {
    setExpandedTables((prev) => {
      const next = new Set(prev);
      if (next.has(table.name)) {
        next.delete(table.name);
      } else {
        next.add(table.name);
        loadColumnsIfNeeded(table);
      }
      return next;
    });
  }, [loadColumnsIfNeeded]);

  // ── Active tab info ──────────────────────────────────────
  const activeTab = tabs.find((t) => t.id === activeTabId) ?? null;
  const activeTableState = activeTabId ? tableTabStates[activeTabId] ?? null : null;

  const gridRows = useMemo(() => activeTableState?.result?.rows ?? [], [activeTableState]);
  const gridCols = useMemo(() => activeTableState?.result?.columns ?? [], [activeTableState]);

  // ── Stable DataGrid callbacks (prevents infinite loop) ───
  // DO NOT inline these in JSX — new references cause onPendingChanges
  // effect to fire every render even with the ref guard in DataGrid.
  const activeTabIdRef = useRef(activeTabId);
  activeTabIdRef.current = activeTabId;
  const activeTabRef = useRef(activeTab);
  activeTabRef.current = activeTab;
  // per-tab caches — plain refs, no re-render
  const monacoViewStateCache = useRef<Record<string, unknown>>({});

  // Hoisted DataGrid cursor: persist active cell onto the tab's global payload
  // so it survives unmount / tab switch (criterion: state lives in tab.payload).
  const handleGridActiveCellChange = useCallback((cell: { row: number; col: number } | null) => {
    const tabId = activeTabIdRef.current;
    setTabs((prev) =>
      prev.map((t) =>
        t.id === tabId ? { ...t, payload: { ...t.payload, activeCell: cell } } : t,
      ),
    );
  }, []);

  const handleGridPendingChanges = useCallback((changes: import("../types/db").PendingChange[]) => {
    const tabId = activeTabIdRef.current;
    updateTableTabState(tabId, { pendingChanges: changes });
    if (changes.length > 0) markTabDirty(tabId);
    else markTabClean(tabId);
  }, [updateTableTabState, markTabDirty, markTabClean]);

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

  const totalRows = activeTableState?.result?.total ?? 0;
  const currentPage = Math.floor((activeTableState?.offset ?? 0) / PAGE_SIZE);
  const totalPages = Math.ceil(totalRows / PAGE_SIZE);

  return (
    <div className="qp">
      {/* ── Left: table navigator ─────────────────────── */}
      <aside className="qp-tables">
        <div className="qp-tables-header">
          <span className="qp-db-name" title={connectionName}>{connectionName}</span>
          {onDisconnect && (
            <button className="qp-disconnect-btn" onClick={onDisconnect} title="Disconnect">
              <LogOut size={14} />
            </button>
          )}
        </div>

        {tablesLoading && <div className="qp-placeholder">Loading tables…</div>}
        {tablesError && <div className="qp-error">{tablesError}</div>}
        {!tablesLoading && !tablesError && tables.length === 0 && (
          <div className="qp-placeholder">No tables found</div>
        )}

        <ul className="qp-table-list">
          {tables.map((t) => {
            const label = t.schema ? `${t.schema}.${t.name}` : t.name;
            const tid = tableTabId(t);
            const isActive = activeTabId === tid;
            const expanded = expandedTables.has(t.name);
            const cols = columnMap[t.name];
            return (
              <li key={label} className="qp-tree-node">
                <div
                  className={`qp-table-item${isActive ? " qp-table-item--active" : ""}`}
                  onClick={() => openTableTab(t)}
                  onContextMenu={(e) => { e.preventDefault(); setContextTable(t); openMenu(e); }}
                  title={label}
                >
                  <button
                    className={`qp-chevron${expanded ? " qp-chevron--open" : ""}`}
                    onClick={(e) => { e.stopPropagation(); toggleExpand(t); }}
                    aria-label={expanded ? "Collapse" : "Expand"}
                  >
                    <ChevronRight size={12} />
                  </button>
                  <span className="qp-table-icon">▤</span>
                  <span className="qp-table-name">{t.name}</span>
                </div>
                {expanded && (
                  <ul className="qp-col-list">
                    {cols === undefined ? (
                      <li className="qp-col-item qp-col-item--muted">…</li>
                    ) : cols.length === 0 ? (
                      <li className="qp-col-item qp-col-item--muted">Sin columnas</li>
                    ) : (
                      cols.map((col) => (
                        <li key={col.name} className="qp-col-item">
                          {colIcon(col)}
                          <span className="qp-col-name">{col.name}</span>
                          <span className="qp-col-type">{col.data_type}</span>
                        </li>
                      ))
                    )}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      </aside>

      {/* ── Right: tabbed content ─────────────────────── */}
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

        {/* ── Table view ─────────────────────────────── */}
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
                {activeTableState?.result && (
                  <span className="qp-sql">
                    {totalRows.toLocaleString()} rows · page {currentPage + 1}
                    {totalPages > 1 ? ` / ${totalPages}` : ""}
                  </span>
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
                  onPendingChanges={handleGridPendingChanges}
                  onFiltersChange={handleGridFiltersChange}
                  onSave={handleGridSave}
                  onForceClose={handleGridForceClose}
                  onFocusEditor={handleGridFocusEditor}
                  activeCell={activeTab.payload.activeCell ?? null}
                  onActiveCellChange={handleGridActiveCellChange}
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
          </>
        )}

        {/* ── SQL Editor ─────────────────────────────── */}
        {activeTab?.type === "sql_editor" && (
          <SqlEditor
            connectionId={connectionId}
            connectionName={connectionName}
            initialSql={tabSql[activeTabId] ?? activeTab.payload.sql}
            onImportScript={handleImportScriptAndSave}
            onDirty={() => markTabDirty(activeTabId)}
            onSaveScript={(sql) => saveSqlTab(activeTabId, sql)}
            tabId={activeTabId}
            viewStateCache={monacoViewStateCache}
          />
        )}

        {/* ── Schema Visualizer ──────────────────────── */}
        {activeTab?.type === "schema" && (
          <SchemaVisualizer
            engine={engine ?? "postgres"}
            tables={tables}
            columnMap={columnMap}
            connectionId={connectionId}
            focusTable={(activeTab.payload as TabPayload).table}
          />
        )}

        {/* ── Empty workspace ─────────────────────────── */}
        {!activeTab && <EmptyWorkspaceState />}
      </div>

      <ContextMenu
        open={menuState.open}
        x={menuState.x}
        y={menuState.y}
        items={[
          {
            icon: <Network size={14} />,
            label: "Visualizar Relaciones",
            onClick: () => {
              if (contextTable) openRelationTab(contextTable);
              setContextTable(null); closeMenu();
            },
          },
          {
            icon: <Table2 size={14} />,
            label: "Generar SELECT",
            onClick: () => {
              const t = contextTable;
              setContextTable(null); closeMenu();
              if (t) {
                invoke<string>("generate_crud_sql", { connectionId, tableName: t.name, schema: t.schema ?? null, action: "select" })
                  .then((sql) => openSnippetTab(sql, `SELECT ${t.name}`))
                  .catch((e) => toast.error(fmtErr(e)));
              }
            },
          },
          {
            icon: <Pencil size={14} />,
            label: "Generar INSERT",
            onClick: () => {
              const t = contextTable;
              setContextTable(null); closeMenu();
              if (t) {
                invoke<string>("generate_crud_sql", { connectionId, tableName: t.name, schema: t.schema ?? null, action: "insert" })
                  .then((sql) => openSnippetTab(sql, `INSERT ${t.name}`))
                  .catch((e) => toast.error(fmtErr(e)));
              }
            },
          },
          {
            icon: <Pencil size={14} />,
            label: "Generar UPDATE",
            onClick: () => {
              const t = contextTable;
              setContextTable(null); closeMenu();
              if (t) {
                invoke<string>("generate_crud_sql", { connectionId, tableName: t.name, schema: t.schema ?? null, action: "update" })
                  .then((sql) => openSnippetTab(sql, `UPDATE ${t.name}`))
                  .catch((e) => toast.error(fmtErr(e)));
              }
            },
          },
          {
            icon: <Trash2 size={14} />,
            label: "Vaciar Tabla (TRUNCATE)",
            danger: true,
            onClick: () => {
              if (contextTable)
                openSnippetTab(`TRUNCATE TABLE ${contextTable.name};`, `TRUNCATE ${contextTable.name}`);
              setContextTable(null); closeMenu();
            },
          },
        ]}
        onClose={() => { setContextTable(null); closeMenu(); }}
      />
    </div>
  );
}
