import type { GridFilter, TableInfo } from "./db";

export interface NavTable {
  table: TableInfo;
  v: number;
  /** Optional filters when opening via FK / related-record navigation. */
  filters?: GridFilter[];
}
export interface OpenScript { sql: string; name: string; id: string; v: number; autoRun?: boolean; }
/** Sidebar "Run" without opening the editor — QueryPanel opens a results-only tab. */
export interface PendingScriptRun { sql: string; name: string; id: string; v: number; }

export interface FsNode {
  name: string;
  path: string;
  isDir: boolean;
  is_dir?: boolean;
  children?: FsNode[];
  color?: string | null;
  sort_order?: number;
  is_pinned?: boolean;
  content?: string;
}

export type DbConnectionStatus = "disconnected" | "connecting" | "connected" | "error";
export type WorkspaceLayout = "simple" | "advance";

export interface Workspace {
  id: string;
  name: string;
  root_path: string;
  connection_ids: string;
}
