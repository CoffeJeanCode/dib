import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
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

function genSelect(tableName: string, cols: ColumnInfo[]): string {
  const list = cols.length > 0 ? cols.map((c) => c.name).join(", ") : "*";
  return `SELECT ${list}\nFROM ${tableName};`;
}

function genUpdate(tableName: string, cols: ColumnInfo[]): string {
  const pk = cols.find((c) => c.is_primary_key);
  const setCols = cols.filter((c) => !c.is_primary_key);
  const setClause = setCols.length > 0
    ? setCols.map((c) => `  ${c.name} = ?`).join(",\n")
    : "  -- columna = valor";
  return `UPDATE ${tableName}\nSET\n${setClause}\nWHERE ${pk?.name ?? "id"} = ?;`;
}

import { DataGrid } from "./DataGrid";
import { CommitFooter } from "./CommitFooter";
import { TabBar } from "./TabBar";
import { SqlEditor } from "./SqlEditor";
import { SchemaVisualizer } from "./SchemaVisualizer";
import { ContextMenu } from "./ContextMenu";
import { useContextMenu } from "../hooks/useContextMenu";
import "./QueryPanel.css";

const PAGE_SIZE = 100;
const SCHEMA_TAB_ID = "tab-schema";

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
  openScript?: { sql: string; name: string; v: number } | null;
}

export function QueryPanel({ connectionId, connectionName, engine, onDisconnect, navigateTo, openScript }: QueryPanelProps) {
  const [tables, setTables] = useState<TableInfo[]>([]);
  const [tablesLoading, setTablesLoading] = useState(true);
  const [tablesError, setTablesError] = useState<string | null>(null);
  const [columnMap, setColumnMap] = useState<Record<string, ColumnInfo[]>>({});
  const [expandedTables, setExpandedTables] = useState<Set<string>>(new Set());

  const [tabs, setTabs] = useState<TabData[]>([
    { id: SCHEMA_TAB_ID, type: "schema", title: "Schema", isDirty: false, payload: {}, closeable: false },
  ]);
  const [activeTabId, setActiveTabId] = useState(SCHEMA_TAB_ID);

  // Per-table-tab state
  const [tableTabStates, setTableTabStates] = useState<Record<string, TableTabState>>({});

  // SQL tab content
  const [tabSql, setTabSql] = useState<Record<string, string>>({});

  const { menuState, openMenu, closeMenu } = useContextMenu();
  const [contextTable, setContextTable] = useState<TableInfo | null>(null);
  const [committing, setCommitting] = useState<string | null>(null); // tabId being committed

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

  // ── Load tables ─────────────────────────────────────────
  useEffect(() => {
    setTablesLoading(true);
    setTablesError(null);
    invoke<TableInfo[]>("fetch_tables", { connectionId })
      .then((t) => {
        setTables(t);
        Promise.all(
          t.map((table) =>
            invoke<ColumnInfo[]>("fetch_table_schema", {
              connectionId,
              tableName: table.name,
              schema: table.schema ?? null,
            }).then((cols) => [table.name, cols] as const),
          ),
        )
          .then((entries) => {
            const map: Record<string, ColumnInfo[]> = {};
            for (const [name, cols] of entries) map[name] = cols;
            setColumnMap(map);
          })
          .catch(() => {});
      })
      .catch(() => setTablesError("Error cargando tablas"))
      .finally(() => setTablesLoading(false));
  }, [connectionId]);

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
        updateTableTabState(tabId, { error: String(e), loading: false });
      }
    },
    [connectionId, updateTableTabState],
  );

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
  const openSqlTab = useCallback((sql: string, name: string) => {
    const tabId = `tab-sql-${Date.now()}`;
    const newTab: TabData = {
      id: tabId,
      type: "sql_editor",
      title: name,
      isDirty: false,
      payload: { sql, filename: name },
      closeable: true,
    };
    setTabs((prev) => [...prev, newTab]);
    setTabSql((prev) => ({ ...prev, [tabId]: sql }));
    setActiveTabId(tabId);
  }, []);

  // ── External navigation ──────────────────────────────────
  useEffect(() => {
    if (!navigateTo) return;
    openTableTab(navigateTo.table);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigateTo]);

  useEffect(() => {
    if (!openScript) return;
    openSqlTab(openScript.sql, openScript.name);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openScript]);

  // ── Tab close / reorder ──────────────────────────────────
  const handleTabClose = useCallback((id: string) => {
    if (id === SCHEMA_TAB_ID) return;
    setTabs((prev) => prev.filter((t) => t.id !== id));
    setTabSql((prev) => { const next = { ...prev }; delete next[id]; return next; });
    setTableTabStates((prev) => { const next = { ...prev }; delete next[id]; return next; });
    setActiveTabId((prev) => (prev === id ? SCHEMA_TAB_ID : prev));
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
        updateTableTabState(tabId, { error: String(e) });
      } finally {
        setCommitting(null);
      }
    },
    [tableTabStates, connectionId, updateTableTabState, markTabClean, loadTablePage],
  );

  // ── Save SQL tab to workspace ────────────────────────────
  const saveSqlTab = useCallback(
    async (tabId: string, sql: string) => {
      const tab = tabs.find((t) => t.id === tabId);
      if (!tab) return;
      const filename = tab.payload.filename ?? tab.title ?? "query.sql";
      try {
        await invoke("save_script", { filename, content: sql, format: "sql" });
        markTabClean(tabId);
        // Update stored SQL and payload filename
        setTabSql((prev) => ({ ...prev, [tabId]: sql }));
        setTabs((prev) => prev.map((t) =>
          t.id === tabId
            ? { ...t, payload: { ...t.payload, sql, filename } }
            : t,
        ));
      } catch (e) {
        console.error("[DIB] save_script failed:", e);
      }
    },
    [tabs, markTabClean],
  );

  // ── Schema / relation tab ────────────────────────────────
  const openRelationTab = useCallback((table: TableInfo) => {
    const tabId = `tab-rel-${table.name}-${Date.now()}`;
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

  // ── Column tree toggle ───────────────────────────────────
  const toggleExpand = useCallback((name: string) => {
    setExpandedTables((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name); else next.add(name);
      return next;
    });
  }, []);

  // ── Active tab info ──────────────────────────────────────
  const activeTab = tabs.find((t) => t.id === activeTabId) ?? null;
  const activeTableState = activeTabId ? tableTabStates[activeTabId] ?? null : null;

  const gridRows = useMemo(() => activeTableState?.result?.rows ?? [], [activeTableState]);
  const gridCols = useMemo(() => activeTableState?.result?.columns ?? [], [activeTableState]);

  const totalRows = activeTableState?.result?.total ?? 0;
  const currentPage = Math.floor((activeTableState?.offset ?? 0) / PAGE_SIZE);
  const totalPages = Math.ceil(totalRows / PAGE_SIZE);

  // ── Pagination ref for current tab ───────────────────────
  const activeTabIdRef = useRef(activeTabId);
  activeTabIdRef.current = activeTabId;

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
                    onClick={(e) => { e.stopPropagation(); toggleExpand(t.name); }}
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
        <TabBar
          tabs={tabs}
          activeId={activeTabId}
          onSelect={setActiveTabId}
          onClose={handleTabClose}
          onReorder={handleTabReorder}
        />

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
                  onFiltersChange={(newFilters) => {
                    if (activeTab.payload.table) {
                      loadTablePage(activeTabId, activeTab.payload.table, 0, newFilters);
                    }
                  }}
                  onPendingChanges={(changes) => {
                    updateTableTabState(activeTabId, { pendingChanges: changes });
                    if (changes.length > 0) markTabDirty(activeTabId);
                    else markTabClean(activeTabId);
                  }}
                  onSave={(changes) => {
                    if (changes.length > 0) return handleCommit(activeTabId);
                    return Promise.resolve();
                  }}
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
            onImportScript={openSqlTab}
            onDirty={() => markTabDirty(activeTabId)}
            onSaveScript={(sql) => saveSqlTab(activeTabId, sql)}
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

        {/* ── Empty state ─────────────────────────────── */}
        {!activeTab && (
          <div className="qp-data-empty">
            <p>Selecciona una tabla o abre una consulta</p>
          </div>
        )}
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
              if (contextTable) {
                const cols = columnMap[contextTable.name] ?? [];
                openSnippetTab(genSelect(contextTable.name, cols), `SELECT ${contextTable.name}`);
              }
              setContextTable(null); closeMenu();
            },
          },
          {
            icon: <Pencil size={14} />,
            label: "Generar UPDATE",
            onClick: () => {
              if (contextTable) {
                const cols = columnMap[contextTable.name] ?? [];
                openSnippetTab(genUpdate(contextTable.name, cols), `UPDATE ${contextTable.name}`);
              }
              setContextTable(null); closeMenu();
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
