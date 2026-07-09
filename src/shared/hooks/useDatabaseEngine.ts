import { useState, useCallback, useRef, useEffect } from "react";
import { dbService } from "@/services/dbService";
import { useConnectionStore } from "@/store/connectionStore";
import type { TableInfo, ColumnInfo, PagedResult, GridFilter, TableRelation, PendingChange, OrderBy } from "@/types/db";

export const DEFAULT_PAGE_SIZE = 100;

export function useDatabaseEngine(connectionId: string) {
  const [tables, setTables] = useState<TableInfo[]>([]);
  const [columnMap, setColumnMap] = useState<Record<string, ColumnInfo[]>>({});
  const reloadVersion = useConnectionStore((s) => s.reloadVersion);

  // Invalidate columnMap on reload (e.g. after ALTER TABLE) so next
  // loadColumnsBatch re-fetches instead of hitting the early-return guard.
  useEffect(() => {
    setColumnMap({});
  }, [reloadVersion]);
  const [tableRelations, setTableRelations] = useState<Record<string, TableRelation[]>>({});
  const tableRelationsRef = useRef<Record<string, TableRelation[]>>({});

  useEffect(() => {
    let mounted = true;
    setTables([]);
    setColumnMap({});
    tableRelationsRef.current = {};
    dbService.fetchSchemaObjects(connectionId)
      .then((obj) => { if (mounted) setTables(obj.tables); })
      .catch(() => {});
    return () => { mounted = false; };
  }, [connectionId]);

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

  const loadColumnsBatch = useCallback((tableList: TableInfo[], existing: Record<string, ColumnInfo[]>) => {
    tableList.forEach((t) => {
      if (existing[t.name] !== undefined) return;
      dbService.fetchTableSchema(connectionId, t.name, t.schema ?? null)
        .then((cols) => setColumnMap((p) => ({ ...p, [t.name]: cols })))
        .catch(() => setColumnMap((p) => ({ ...p, [t.name]: [] })));
    });
  }, [connectionId]);

  const commitChanges = useCallback(
    (tableName: string, pkCol: string, changes: PendingChange[]): Promise<void> =>
      dbService.applyChanges(connectionId, tableName, pkCol, changes),
    [connectionId],
  );

  return {
    tables,
    columnMap,
    tableRelations,
    tableRelationsRef,
    fetchTablePage,
    loadTableRelations,
    loadColumnsBatch,
    commitChanges,
  };
}
