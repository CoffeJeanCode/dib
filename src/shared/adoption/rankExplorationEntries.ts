import type { TableInfo } from "@/types/db";
import { sameTable, type TableRef } from "./types";

export type ExplorationEntryKind =
  | "continue_table"
  | "open_table"
  | "search_tables"
  | "new_sql"
  | "create_table";

export interface ExplorationEntry {
  id: string;
  kind: ExplorationEntryKind;
  label: string;
  table?: TableInfo;
}

export interface ExplorationContext {
  readonly: boolean;
  tables: TableInfo[];
  /** False while schema fetch is in flight. */
  tablesReady: boolean;
  recentTables?: TableRef[] | null;
  lastOpenedTable?: TableRef | null;
  /** Max important table chips. */
  maxImportant?: number;
}

const DEFAULT_MAX_IMPORTANT = 4;

const SYSTEM_SCHEMAS = new Set([
  "pg_catalog",
  "information_schema",
  "pg_toast",
  "sys",
  "INFORMATION_SCHEMA",
]);

/** Names that usually matter to product users (cold start only). */
const DOMAIN_NAME =
  /^(users?|accounts?|orders?|customers?|products?|items?|payments?|invoices?|organizations?|orgs?|companies?|employees?|clients?|sessions?|posts?|messages?|bookings?|transactions?|roles?|permissions?)$/i;

function labelOf(t: TableInfo): string {
  return t.schema ? `${t.schema}.${t.name}` : t.name;
}

function findTable(tables: TableInfo[], ref: TableRef | null | undefined): TableInfo | undefined {
  if (!ref) return undefined;
  return tables.find((t) => sameTable(t, ref));
}

export function isSystemTable(t: TableInfo): boolean {
  const schema = t.schema ?? "";
  if (SYSTEM_SCHEMAS.has(schema)) return true;
  const n = t.name.toLowerCase();
  return n.startsWith("pg_") || n.startsWith("sql_") || n.startsWith("sqlite_");
}

export function scoreDomainTable(t: TableInfo): number {
  if (isSystemTable(t)) return -100;
  let score = 0;
  const schema = (t.schema ?? "").toLowerCase();
  if (!schema || schema === "public" || schema === "main" || schema === "dbo") score += 10;
  if (DOMAIN_NAME.test(t.name)) score += 50;
  if (!t.name.includes("__")) score += 2;
  if (t.name.length <= 24) score += 1;
  return score;
}

/**
 * Resolve tables worth surfacing on the empty hub.
 * Prefer user recents; cold start only shows high-confidence domain tables
 * (or the whole set when tiny). Never dumps an arbitrary catalog slice.
 */
export function pickImportantTables(
  tables: TableInfo[],
  recent: TableRef[] | null | undefined,
  maxImportant = DEFAULT_MAX_IMPORTANT,
): TableInfo[] {
  const resolvedRecent: TableInfo[] = [];
  for (const ref of recent ?? []) {
    const hit = findTable(tables, ref);
    if (hit && !resolvedRecent.some((t) => sameTable(t, hit))) resolvedRecent.push(hit);
    if (resolvedRecent.length >= maxImportant) return resolvedRecent;
  }
  if (resolvedRecent.length > 0) return resolvedRecent;

  const userTables = tables.filter((t) => !isSystemTable(t));
  if (userTables.length === 0) return [];
  if (userTables.length <= 3) return userTables.slice(0, maxImportant);

  const scored = userTables
    .map((t) => ({ t, score: scoreDomainTable(t) }))
    .filter((x) => x.score >= 50)
    .sort((a, b) => b.score - a.score || a.t.name.localeCompare(b.t.name));

  return scored.slice(0, maxImportant).map((x) => x.t);
}

/**
 * Rank exploration entries for the empty hub.
 * Doors into the app — not a catalog dump or task list.
 */
export function rankExplorationEntries(ctx: ExplorationContext): ExplorationEntry[] {
  const max = ctx.maxImportant ?? DEFAULT_MAX_IMPORTANT;
  const entries: ExplorationEntry[] = [];

  if (!ctx.tablesReady) {
    entries.push({ id: "search_tables", kind: "search_tables", label: "Search tables" });
    entries.push({ id: "new_sql", kind: "new_sql", label: "New SQL" });
    return entries;
  }

  if (ctx.tables.length === 0) {
    entries.push({ id: "new_sql", kind: "new_sql", label: "New SQL" });
    if (!ctx.readonly) {
      entries.push({ id: "create_table", kind: "create_table", label: "Create table" });
    }
    return entries;
  }

  const recent = ctx.recentTables?.length
    ? ctx.recentTables
    : ctx.lastOpenedTable
      ? [ctx.lastOpenedTable]
      : [];

  const important = pickImportantTables(ctx.tables, recent, max);
  const continueTable = findTable(ctx.tables, ctx.lastOpenedTable ?? recent[0] ?? null);

  if (continueTable && important.some((t) => sameTable(t, continueTable))) {
    entries.push({
      id: `continue:${labelOf(continueTable)}`,
      kind: "continue_table",
      label: labelOf(continueTable),
      table: continueTable,
    });
  }

  for (const t of important) {
    if (continueTable && sameTable(t, continueTable)) continue;
    entries.push({
      id: `table:${labelOf(t)}`,
      kind: "open_table",
      label: labelOf(t),
      table: t,
    });
  }

  entries.push({ id: "search_tables", kind: "search_tables", label: "Search tables" });
  entries.push({ id: "new_sql", kind: "new_sql", label: "New SQL" });
  return entries;
}
