import { useState, useEffect, useMemo, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  LogOut, Network, ChevronRight,
  Key, Hash, Type, Calendar,
  Table2, Pencil, Trash2,
} from "lucide-react";
import type { TableInfo, ColumnInfo, PagedResult, PendingChange, GridFilter } from "../types/db";

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
import type { TabData } from "./Tab";
import "./QueryPanel.css";

const PAGE_SIZE = 100;
const EXPLORER_TAB_ID = "tab-explorer";
const SCHEMA_TAB_ID = "tab-schema";

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

  const [activeTable, setActiveTable] = useState<TableInfo | null>(null);
  const [filters, setFilters] = useState<GridFilter[]>([]);
  const [pagedResult, setPagedResult] = useState<PagedResult | null>(null);
  const [queryLoading, setQueryLoading] = useState(false);
  const [queryError, setQueryError] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const [pendingChanges, setPendingChanges] = useState<PendingChange[]>([]);
  const [committing, setCommitting] = useState(false);
  const [primaryKeyColumn, setPrimaryKeyColumn] = useState<string>("");

  const [tabs, setTabs] = useState<TabData[]>([
    { id: EXPLORER_TAB_ID, label: "Explorador", icon: "table" },
    { id: SCHEMA_TAB_ID, label: "Schema", icon: "schema" },
    { id: "tab-query-1", label: "Consulta 1", icon: "query" },
  ]);
  const [activeTabId, setActiveTabId] = useState(EXPLORER_TAB_ID);
  const [tabSql, setTabSql] = useState<Record<string, string>>({});
  const [relationTabMap, setRelationTabMap] = useState<Record<string, TableInfo>>({});

  const { menuState, openMenu, closeMenu } = useContextMenu();
  const [contextTable, setContextTable] = useState<TableInfo | null>(null);
  const [expandedTables, setExpandedTables] = useState<Set<string>>(new Set());

  const toggleExpand = useCallback((name: string) => {
    setExpandedTables((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name); else next.add(name);
      return next;
    });
  }, []);

  const openSqlTab = useCallback((sql: string, label: string) => {
    const tabId = `tab-sql-${Date.now()}`;
    setTabs((prev) => [...prev, { id: tabId, label, icon: "query" }]);
    setTabSql((prev) => ({ ...prev, [tabId]: sql }));
    setActiveTabId(tabId);
  }, []);

  const isExplorerTab = activeTabId === EXPLORER_TAB_ID;
  const isSchemaTab = activeTabId === SCHEMA_TAB_ID;
  const isRelationTab = activeTabId in relationTabMap;

  useEffect(() => {
    setTablesLoading(true);
    setTablesError(null);
    invoke<TableInfo[]>("fetch_tables", { connectionId })
      .then((t) => {
        setTables(t);
        // Fetch column info for schema visualizer
        Promise.all(
          t.map((table) =>
            invoke<ColumnInfo[]>("fetch_table_schema", {
              connectionId,
              tableName: table.name,
              schema: table.schema ?? null,
            }).then((cols) => [table.name, cols] as const)
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

  const loadPage = useCallback(
    async (table: TableInfo, pageOffset: number, activeFilters: GridFilter[] = []) => {
      setQueryError(null);
      setQueryLoading(true);
      try {
        const r = await invoke<PagedResult>("fetch_table_data", {
          connectionId,
          tableName: table.name,
          schema: table.schema ?? null,
          offset: pageOffset,
          limit: PAGE_SIZE,
          filters: activeFilters.length > 0 ? activeFilters : null,
        });
        setPagedResult(r);
        setOffset(pageOffset);
        if (pageOffset === 0) {
          const cols = r.columns;
          const lower = cols.map((c) => c.toLowerCase());
          const detected =
            cols[lower.indexOf("id")] ??
            cols[lower.findIndex((c) => c.endsWith("_id") || c === "uuid")] ??
            cols[0] ??
            "";
          setPrimaryKeyColumn(detected);
        }
      } catch (e) {
        setQueryError(String(e));
      } finally {
        setQueryLoading(false);
      }
    },
    [connectionId],
  );

  const handleTableClick = useCallback(
    async (table: TableInfo) => {
      setActiveTable(table);
      setPagedResult(null);
      setPendingChanges([]);
      setFilters([]);
      await loadPage(table, 0, []);
    },
    [loadPage],
  );

  const handleFiltersChange = useCallback(
    (newFilters: GridFilter[]) => {
      setFilters(newFilters);
      if (activeTable) loadPage(activeTable, 0, newFilters);
    },
    [activeTable, loadPage],
  );

  // External navigation from CommandPalette
  useEffect(() => {
    if (!navigateTo) return;
    setActiveTabId(EXPLORER_TAB_ID);
    handleTableClick(navigateTo.table);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigateTo]);

  // External script open from CommandPalette
  useEffect(() => {
    if (!openScript) return;
    const tabId = `tab-script-${openScript.v}`;
    setTabs((prev) => [...prev, { id: tabId, label: openScript.name, icon: "query" }]);
    setTabSql((prev) => ({ ...prev, [tabId]: openScript.sql }));
    setActiveTabId(tabId);
  }, [openScript]);

  const handlePendingChanges = useCallback((changes: PendingChange[]) => {
    setPendingChanges(changes);
  }, []);

  const handleRevert = useCallback(() => {
    setPendingChanges([]);
    if (activeTable) handleTableClick(activeTable);
  }, [activeTable, handleTableClick]);

  const handleCommit = useCallback(async () => {
    if (pendingChanges.length === 0 || !activeTable) return;
    setCommitting(true);
    try {
      await invoke("apply_changes", {
        connectionId,
        table: activeTable.name,
        primaryKeyColumn,
        changes: pendingChanges,
      });
      setPendingChanges([]);
      loadPage(activeTable, offset);
    } catch (e) {
      setQueryError(String(e));
    } finally {
      setCommitting(false);
    }
  }, [connectionId, activeTable, pendingChanges, primaryKeyColumn, offset, loadPage]);

  const handleTabClose = useCallback((id: string) => {
    if (id === EXPLORER_TAB_ID || id === SCHEMA_TAB_ID) return;
    setTabs((prev) => prev.filter((t) => t.id !== id));
    setTabSql((prev) => { const next = { ...prev }; delete next[id]; return next; });
    setRelationTabMap((prev) => { const next = { ...prev }; delete next[id]; return next; });
    setActiveTabId((prev) => (prev === id ? EXPLORER_TAB_ID : prev));
  }, []);

  const handleVisualizeRelations = useCallback((table: TableInfo) => {
    const tabId = `tab-rel-${table.name}-${Date.now()}`;
    setTabs((prev) => [...prev, { id: tabId, label: `~ ${table.name}`, icon: "schema" }]);
    setRelationTabMap((prev) => ({ ...prev, [tabId]: table }));
    setActiveTabId(tabId);
  }, []);

  const totalPages = pagedResult ? Math.ceil(pagedResult.total / PAGE_SIZE) : 0;
  const currentPage = Math.floor(offset / PAGE_SIZE);
  const gridRows = useMemo(() => pagedResult?.rows ?? [], [pagedResult]);
  const gridCols = useMemo(() => pagedResult?.columns ?? [], [pagedResult]);

  return (
    <div className="qp">
      <aside className="qp-tables">
        <div className="qp-tables-header">
          <span className="qp-db-name" title={connectionName}>
            {connectionName}
          </span>
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
            const isActive = activeTable?.name === t.name && activeTable?.schema === t.schema;
            const expanded = expandedTables.has(t.name);
            const cols = columnMap[t.name];
            return (
              <li key={label} className="qp-tree-node">
                <div
                  className={`qp-table-item${isActive ? " qp-table-item--active" : ""}`}
                  onClick={() => { setActiveTabId(EXPLORER_TAB_ID); handleTableClick(t); }}
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

      <div className="qp-data">
        <TabBar tabs={tabs} activeId={activeTabId} onSelect={setActiveTabId} onClose={handleTabClose} />

        {isExplorerTab ? (
          <>
            {!activeTable && !queryLoading && (
              <div className="qp-data-empty">
                <p>Select a table to view its data</p>
              </div>
            )}
            {queryError && <div className="qp-data-error">{queryError}</div>}
            {(queryLoading || pagedResult) && (
              <div className="qp-grid-header">
                <span className="qp-breadcrumb">
                  {activeTable?.schema
                    ? `${activeTable.schema}.${activeTable.name}`
                    : activeTable?.name}
                </span>
                {pagedResult && (
                  <span className="qp-sql">
                    {pagedResult.total.toLocaleString()} rows · page {currentPage + 1}
                    {totalPages > 1 ? ` / ${totalPages}` : ""}
                  </span>
                )}
              </div>
            )}
            <div className="qp-grid-wrap">
              {(queryLoading || pagedResult) && (
                <DataGrid
                  columns={gridCols}
                  rows={gridRows}
                  loading={queryLoading}
                  tableName={activeTable?.name}
                  primaryKeyColumn={primaryKeyColumn}
                  columnInfos={activeTable ? columnMap[activeTable.name] : undefined}
                  filters={filters}
                  onFiltersChange={handleFiltersChange}
                  onPendingChanges={handlePendingChanges}
                />
              )}
            </div>
            {pagedResult && totalPages > 1 && (
              <div className="qp-pagination">
                <button
                  className="qp-page-btn"
                  disabled={currentPage === 0 || queryLoading}
                  onClick={() => activeTable && loadPage(activeTable, offset - PAGE_SIZE, filters)}
                >
                  ‹ Prev
                </button>
                <span className="qp-page-info">{currentPage + 1} / {totalPages}</span>
                <button
                  className="qp-page-btn"
                  disabled={currentPage >= totalPages - 1 || queryLoading}
                  onClick={() => activeTable && loadPage(activeTable, offset + PAGE_SIZE, filters)}
                >
                  Next ›
                </button>
              </div>
            )}
            <CommitFooter
              changes={pendingChanges}
              committing={committing}
              onRevert={handleRevert}
              onApply={handleCommit}
            />
          </>
        ) : isSchemaTab ? (
          <SchemaVisualizer
            engine={engine ?? "postgres"}
            tables={tables}
            columnMap={columnMap}
          />
        ) : isRelationTab ? (
          <SchemaVisualizer
            engine={engine ?? "postgres"}
            tables={tables}
            columnMap={columnMap}
            connectionId={connectionId}
            focusTable={relationTabMap[activeTabId]}
          />
        ) : (
          <SqlEditor
            connectionId={connectionId}
            connectionName={connectionName}
            initialSql={tabSql[activeTabId]}
            onImportScript={openSqlTab}
          />
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
              if (contextTable) handleVisualizeRelations(contextTable);
              setContextTable(null); closeMenu();
            },
          },
          {
            icon: <Table2 size={14} />,
            label: "Generar SELECT",
            onClick: () => {
              if (contextTable) {
                const cols = columnMap[contextTable.name] ?? [];
                openSqlTab(genSelect(contextTable.name, cols), `SELECT ${contextTable.name}`);
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
                openSqlTab(genUpdate(contextTable.name, cols), `UPDATE ${contextTable.name}`);
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
                openSqlTab(`TRUNCATE TABLE ${contextTable.name};`, `TRUNCATE ${contextTable.name}`);
              setContextTable(null); closeMenu();
            },
          },
        ]}
        onClose={() => { setContextTable(null); closeMenu(); }}
      />
    </div>
  );
}
