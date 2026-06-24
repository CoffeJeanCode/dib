export interface DbConfig {
  db_type: string;
  host: string | null;
  port: number | null;
  database: string | null;
  username: string | null;
  password: string | null;
  path: string | null;
}

export type ConnectionStatus = "connected" | "disconnected";

export interface ConnectionInfo {
  id: string;
  config: DbConfig;
  status: ConnectionStatus;
}

export interface QueryError {
  message: string;
  code: string | null;
  severity: string | null;
}

export interface TableInfo {
  name: string;
  schema: string | null;
}

export interface ColumnInfo {
  name: string;
  data_type: string;
  is_primary_key: boolean;
  is_nullable: boolean;
}

export interface QueryResult {
  columns: string[];
  rows: (string | number | boolean | null)[][];
  rows_affected: number;
}

export interface PagedResult {
  columns: string[];
  rows: unknown[][];
  total: number;
  offset: number;
  limit: number;
}

export interface SavedConnection {
  id: string;
  name: string;
  engine: string;
  host: string;
  port: number;
  username: string;
  db_name: string;
  path: string | null;
  password: string | null;
}

export type FilterOperator =
  | "=" | "!=" | ">" | ">=" | "<" | "<="
  | "ILIKE" | "NOT ILIKE"
  | "IS NULL" | "IS NOT NULL";

export interface GridFilter {
  column: string;
  operator: FilterOperator;
  value?: string;
}

export interface TableRelation {
  source_table: string;
  source_column: string;
  target_table: string;
  target_column: string;
}

export type PendingChangeType = "insert" | "update" | "delete";

export interface PendingChange {
  id: string;
  type: PendingChangeType;
  table: string;
  row_index?: number;
  column?: string;
  column_type?: string;
  column_types?: Record<string, string>;
  old_value?: unknown;
  new_value?: unknown;
  row_pk_value?: unknown;
}

export interface InternalScript {
  id: string;
  title: string;
  content: string;
  created_at: string;
  updated_at: string;
}

export interface QueryHistoryEntry {
  id: number;
  connection_id: string;
  query_text: string;
  executed_at: string;
  success: boolean;
  execution_time_ms: number;
}

export type SchemaChangeKind = "add_column" | "drop_column" | "rename_column" | "alter_type" | "set_nullable";

export interface SchemaChange {
  kind: SchemaChangeKind;
  column: string;
  new_column?: string;
  data_type?: string;
  nullable?: boolean;
  default_value?: string;
}

/** @deprecated use InternalScript */
export interface ScriptInfo {
  name: string;
  path: string;
}

/** @deprecated use InternalScript */
export interface ScriptMeta {
  name: string;
  modified_ms: number;
  size_bytes: number;
}
