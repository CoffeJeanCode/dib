/** Local exploration memory — no onboarding/step fields. */

import type { ExplorationVisit } from "@/shared/exploration/types";

export interface TableRef {
  name: string;
  schema: string | null;
}

export interface ConnectionExploration {
  lastOpenedTable?: TableRef;
  /** Most-recently opened tables (newest first), capped in profileStore. */
  recentTables?: TableRef[];
  /** Object-level visits (tables/views) for Continue / recents. */
  recentVisits?: ExplorationVisit[];
  tableVisitCount?: number;
}

export interface AdoptionProfile {
  version: 1;
  /** Keyed by saved connection id. */
  byConnection: Record<string, ConnectionExploration>;
}

export function emptyProfile(): AdoptionProfile {
  return { version: 1, byConnection: {} };
}

export function tableKey(t: TableRef): string {
  return `${t.schema ?? ""}.${t.name}`;
}

export function sameTable(a: TableRef, b: TableRef): boolean {
  return a.name === b.name && (a.schema ?? null) === (b.schema ?? null);
}
