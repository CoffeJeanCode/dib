import type { TableInfo } from "@/types/db";

/** Navigable database object — stable identity, not display label. */
export type DatabaseObjectType =
  | "table"
  | "view"
  | "materialized_view"
  | "column"
  | "index"
  | "constraint"
  | "query";

export interface DatabaseObjectRef {
  /** Saved connection id (profile / history scope). */
  connectionId: string;
  database?: string;
  schema?: string;
  objectType: DatabaseObjectType;
  /** Stable id within connection+schema (table name, column name, …). */
  objectId: string;
  parentObjectId?: string;
}

export interface ExplorationVisit {
  ref: DatabaseObjectRef;
  visitedAt: number;
}

export interface DatabaseRelationEndpoint {
  table: DatabaseObjectRef;
  columns: string[];
}

export interface DatabaseRelation {
  source: DatabaseRelationEndpoint;
  target: DatabaseRelationEndpoint;
  relationType: "foreign_key";
  name?: string;
}

export type OpenObjectMode = "data" | "structure" | "relations";

export interface OpenDatabaseObjectOptions {
  mode?: OpenObjectMode;
  /** Applied when opening a table in data mode (e.g. FK hop). */
  filters?: import("@/types/db").GridFilter[];
}

/** Narrow TableInfo-shaped input used by adapters. */
export type TableLike = Pick<TableInfo, "name" | "schema">;
