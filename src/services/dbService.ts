import { invoke } from "@tauri-apps/api/core";
import type { TableInfo, ColumnInfo, PagedResult, QueryResult, PendingChange, GridFilter, TableRelation, ExplainPlan, TableStructure } from "../types/db";

export const dbService = {
  fetchTables: (connectionId: string) =>
    invoke<TableInfo[]>("fetch_tables", { connectionId }),

  fetchTableSchema: (connectionId: string, tableName: string, schema: string | null) =>
    invoke<ColumnInfo[]>("fetch_table_schema", { connectionId, tableName, schema }),

  fetchTableData: (
    connectionId: string,
    tableName: string,
    schema: string | null,
    offset: number,
    limit: number,
    filters: GridFilter[] | null,
  ) =>
    invoke<PagedResult>("fetch_table_data", { connectionId, tableName, schema, offset, limit, filters }),

  runQuery: (connectionId: string, sql: string) =>
    invoke<QueryResult>("run_query", { connectionId, sql }),

  applyChanges: (
    connectionId: string,
    table: string,
    primaryKeyColumn: string,
    changes: PendingChange[],
  ) =>
    invoke<void>("apply_changes", { connectionId, table, primaryKeyColumn, changes }),

  saveQueryHistory: (
    connectionId: string,
    queryText: string,
    success: boolean,
    executionTimeMs: number,
  ) =>
    invoke<void>("save_query_history", { connectionId, queryText, success, executionTimeMs }),

  generateCrudSql: (
    connectionId: string,
    tableName: string,
    schema: string | null,
    action: string,
  ) =>
    invoke<string>("generate_crud_sql", { connectionId, tableName, schema, action }),

  applySchemaChanges: (
    connectionId: string,
    tableName: string,
    schema: string | null,
    changes: unknown[],
  ) =>
    invoke<void>("apply_schema_changes", { connectionId, tableName, schema, changes }),

  /** Run EXPLAIN (ANALYZE, FORMAT JSON) and return a structured plan tree. */
  explainQuery: (connectionId: string, sql: string) =>
    invoke<ExplainPlan>("explain_query", { connectionId, sql }),

  /** Drop a table transactionally. Backend validates the identifier. */
  dropTable: (connectionId: string, tableName: string, schema: string | null) =>
    invoke<void>("drop_table", { connectionId, tableName, schema }),

  /** Returns COUNT(*) from saved_scripts for correct Untitled-N numbering. */
  getNextScriptNumber: () =>
    invoke<number>("get_next_script_number"),

  fetchTableRelations: (connectionId: string, tableName: string, schema: string | null) =>
    invoke<TableRelation[]>("fetch_table_relations", { connectionId, tableName, schema }),

  listDatabases: (connectionId: string) =>
    invoke<string[]>("list_databases", { connectionId }),

  getTableStructure: (connectionId: string, tableName: string, schema: string | null) =>
    invoke<TableStructure>("get_table_structure", { connectionId, tableName, schema }),
};
