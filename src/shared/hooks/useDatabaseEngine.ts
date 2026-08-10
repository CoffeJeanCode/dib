import { useState, useCallback, useRef, useEffect } from "react";
import { dbService } from "@/services/dbService";
import { useConnectionStore } from "@/store/connectionStore";
import type { TableInfo, ColumnInfo, PagedResult, GridFilter, TableRelation, PendingChange, OrderBy } from "@/types/db";

export const DEFAULT_PAGE_SIZE = 100;

export function useDatabaseEngine(connectionId: string) {
  const databaseName = useConnectionStore((s) => s.active?.name ?? "");
  const [tables, setTables] = useState<TableInfo[]>([]);
  const [tablesLoading, setTablesLoading] = useState(true);
  const [columnMap, setColumnMap] = useState<Record<string, ColumnInfo[]>>({});
  const columnMapRef = useRef(columnMap);
  columnMapRef.current = columnMap;

  // Reloads force-refetch via loadColumnsBatch(..., {}) — keep stale types visible
  // until the new schema arrives so the grid header does not flash empty.
  const [tableRelations, setTableRelations] = useState<Record<string, TableRelation[]>>({});
  const tableRelationsRef = useRef<Record<string, TableRelation[]>>({});

  // Refetch schema when the connection OR current database changes (tabs stay
  // mounted across switchDatabase — connectionId alone is not enough).
  useEffect(() => {
    let mounted = true;
    setTables([]);
    setTablesLoading(true);
    setColumnMap({});
    tableRelationsRef.current = {};
    setTableRelations({});
    dbService.fetchSchemaObjects(connectionId)
      .then((obj) => {
        if (!mounted) return;
        setTables(obj.tables);
        setTablesLoading(false);
      })
      .catch(() => {
        if (mounted) setTablesLoading(false);
      });
    return () => { mounted = false; };
  }, [connectionId, databaseName]);

  // Pure fetch — callers own state updates
  const fetchTablePage = useCallback(
    (table: TableInfo, offset: number, pageSize: number, filters: GridFilter[] | null, orderBy?: OrderBy | null): Promise<PagedResult> =>
      dbService.fetchTableData(connectionId, table.name, table.schema ?? null, offset, pageSize, filters, orderBy),
    [connectionId],
  );

  const loadTableRelations = useCallback((table: TableInfo) => {
    if (tableRelationsRef.current[table.name] !== undefined) return;
    tableRelationsRef.current[table.name] = [];
    dbService.fetchTableRelations(connectionId, table.name, table.schema ?? null)
      .then((rels) => {
        tableRelationsRef.current[table.name] = rels;
        setTableRelations((prev) => ({ ...prev, [table.name]: rels }));
      })
      .catch(() => {});
  }, [connectionId]);

  // One call for the whole list. Fanning out per table meant N concurrent
  // information_schema queries queued behind a 10-connection pool.
  // Pass existing={} to force a refetch (e.g. after Ctrl+R / ALTER TABLE).
  const loadColumnsBatch = useCallback((tableList: TableInfo[], existing?: Record<string, ColumnInfo[]>) => {
    const map = existing ?? columnMapRef.current;
    const missing = tableList.filter((t) => map[t.name] === undefined);
    if (missing.length === 0) return;
    dbService
      .fetchTableSchemas(connectionId, missing.map((t) => ({ name: t.name, schema: t.schema ?? null })))
      .then((results) =>
        setColumnMap((p) => {
          const next = { ...p };
          for (const r of results) next[r.name] = r.columns;
          return next;
        }),
      )
      .catch(() =>
        setColumnMap((p) => {
          const next = { ...p };
          for (const t of missing) next[t.name] ??= [];
          return next;
        }),
      );
  }, [connectionId]);

  const commitChanges = useCallback(
    (tableName: string, pkCol: string, changes: PendingChange[]): Promise<void> =>
      dbService.applyChanges(connectionId, tableName, pkCol, changes),
    [connectionId],
  );

  return {
    tables,
    tablesLoading,
    columnMap,
    tableRelations,
    tableRelationsRef,
    fetchTablePage,
    loadTableRelations,
    loadColumnsBatch,
    commitChanges,
  };
}
