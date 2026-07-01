import { safeInvoke } from "@/utils/ipc";
import type { ColumnInfo, PagedResult, QueryResult, PendingChange, GridFilter, TableRelation, ExplainPlan, TableStructure, QueryHistoryEntry, DdlResult, SchemaObjects } from "@/types/db";

export const dbService = {
  fetchTableSchema: (connectionId: string, tableName: string, schema: string | null) =>
    safeInvoke<ColumnInfo[]>("fetch_table_schema", { connectionId, tableName, schema }),

  fetchTableData: (
    connectionId: string,
    tableName: string,
    schema: string | null,
    offset: number,
    limit: number,
    filters: GridFilter[] | null,
  ) =>
    safeInvoke<PagedResult>("fetch_table_data", { connectionId, tableName, schema, offset, limit, filters }),

  runQuery: (connectionId: string, sql: string) =>
    safeInvoke<QueryResult>("run_query", { connectionId, sql }),

  applyChanges: (
    connectionId: string,
    table: string,
    primaryKeyColumn: string,
    changes: PendingChange[],
  ) =>
    safeInvoke<void>("apply_changes", { connectionId, table, primaryKeyColumn, changes }),

  saveQueryHistory: (
    connectionId: string,
    queryText: string,
    success: boolean,
    executionTimeMs: number,
    historyLimit?: number,
  ) =>
    safeInvoke<void>("save_query_history", { connectionId, queryText, success, executionTimeMs, historyLimit }),

  getQueryHistory: (
    connectionId: string,
    limit?: number,
    offset?: number,
  ) =>
    safeInvoke<QueryHistoryEntry[]>("get_query_history", { connectionId, limit, offset }),

  generateCrudSql: (
    connectionId: string,
    tableName: string,
    schema: string | null,
    action: string,
  ) =>
    safeInvoke<string>("generate_crud_sql", { connectionId, tableName, schema, action }),

  applySchemaChanges: (
    connectionId: string,
    tableName: string,
    schema: string | null,
    changes: unknown[],
  ) =>
    safeInvoke<void>("apply_schema_changes", { connectionId, tableName, schema, changes }),

  explainQuery: (connectionId: string, sql: string) =>
    safeInvoke<ExplainPlan>("explain_query", { connectionId, sql }),

  dropTable: (connectionId: string, tableName: string, schema: string | null) =>
    safeInvoke<void>("drop_table", { connectionId, tableName, schema }),

  getNextScriptNumber: () =>
    safeInvoke<number>("get_next_script_number"),

  fetchTableRelations: (connectionId: string, tableName: string, schema: string | null) =>
    safeInvoke<TableRelation[]>("fetch_table_relations", { connectionId, tableName, schema }),

  listDatabases: (connectionId: string) =>
    safeInvoke<string[]>("list_databases", { connectionId }),

  getTableStructure: (connectionId: string, tableName: string, schema: string | null) =>
    safeInvoke<TableStructure>("get_table_structure", { connectionId, tableName, schema }),

  cancelQuery: (connectionId: string) =>
    safeInvoke<void>("cancel_query", { connectionId }),

  getViewDdl: (connectionId: string, viewName: string, schema: string | null) =>
    safeInvoke<DdlResult>("get_view_ddl", { connectionId, viewName, schema }),

  getFunctionDdl: (connectionId: string, functionName: string, schema: string | null) =>
    safeInvoke<DdlResult>("get_function_ddl", { connectionId, functionName, schema }),

  getTriggerDdl: (connectionId: string, triggerName: string, schema: string | null) =>
    safeInvoke<DdlResult>("get_trigger_ddl", { connectionId, triggerName, schema }),

  fetchSchemaObjects: (connectionId: string) =>
    safeInvoke<SchemaObjects>("fetch_schema_objects", { connectionId }),
};
