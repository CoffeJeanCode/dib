import { safeInvoke as invoke } from "../utils/ipc";
import type { TableInfo, ColumnInfo, PagedResult, QueryResult, PendingChange, GridFilter, TableRelation, ExplainPlan, TableStructure, QueryHistoryEntry } from "../types/db";

/**
 * Wraps Tauri `invoke` with connection-error handling.
 *
 * - On CONNECTION_REFUSED / channel closed / backend-not-ready, logs a
 *   friendly error and dispatches `dib:backend-error` so the UI can show
 *   a toast instead of crashing.
 * - On any other error, re-throws so callers can handle as before.
 */
async function safeInvoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  try {
    return await invoke<T>(cmd, args);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    const isConnError =
      /connection refused/i.test(msg) ||
      /channel.*closed/i.test(msg) ||
      /backend.*not.*ready/i.test(msg) ||
      /ipc.*call.*failed/i.test(msg) ||
      /Failed to fetch/i.test(msg);

    if (isConnError) {
      console.error(`[dbService] Backend unavailable (${cmd}):`, msg);
      window.dispatchEvent(
        new CustomEvent("dib:backend-error", {
          detail: { command: cmd, message: msg },
        }),
      );
      // Return a rejected promise so callers still get the error path,
      // but the toast has already been dispatched.
      throw new Error("El backend de Tauri no está disponible. Intenta reiniciar la aplicación.");
    }

    // Non-connection errors: re-throw as-is
    throw err;
  }
}

export const dbService = {
  fetchTables: (connectionId: string) =>
    safeInvoke<TableInfo[]>("fetch_tables", { connectionId }),

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
  ) =>
    safeInvoke<void>("save_query_history", { connectionId, queryText, success, executionTimeMs }),

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

  /** Run EXPLAIN (ANALYZE, FORMAT JSON) and return a structured plan tree. */
  explainQuery: (connectionId: string, sql: string) =>
    safeInvoke<ExplainPlan>("explain_query", { connectionId, sql }),

  /** Drop a table transactionally. Backend validates the identifier. */
  dropTable: (connectionId: string, tableName: string, schema: string | null) =>
    safeInvoke<void>("drop_table", { connectionId, tableName, schema }),

  /** Returns COUNT(*) from saved_scripts for correct Untitled-N numbering. */
  getNextScriptNumber: () =>
    safeInvoke<number>("get_next_script_number"),

  fetchTableRelations: (connectionId: string, tableName: string, schema: string | null) =>
    safeInvoke<TableRelation[]>("fetch_table_relations", { connectionId, tableName, schema }),

  listDatabases: (connectionId: string) =>
    safeInvoke<string[]>("list_databases", { connectionId }),

  getTableStructure: (connectionId: string, tableName: string, schema: string | null) =>
    safeInvoke<TableStructure>("get_table_structure", { connectionId, tableName, schema }),
};
