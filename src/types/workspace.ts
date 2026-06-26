import type { TableInfo } from "./db";

export interface NavTable { table: TableInfo; v: number }
export interface OpenScript { sql: string; name: string; id: string; v: number }
