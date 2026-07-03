import type { TableInfo } from "./db";

export interface NavTable { table: TableInfo; v: number }
export interface OpenScript { sql: string; name: string; id: string; v: number; autoRun?: boolean; }

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
export type WorkspaceLayout = "unified" | "split";

export interface Workspace {
  id: string;
  name: string;
  root_path: string;
  connection_ids: string;
}
