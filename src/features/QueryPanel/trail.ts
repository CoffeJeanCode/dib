import type { TableInfo, GridFilter, OrderBy } from "@/types/db";

/**
 * Relational breadcrumbs: navigation history inside a single table tab.
 *
 * A node stores only the *coordinate* of a view (table + filters + sort), never
 * its rows — going back re-runs the query instead of showing a stale snapshot.
 *
 * ponytail: no page offset in the node. loadTablePage only detects the primary
 * key when offset === 0, so restoring a node mid-page would carry the previous
 * table's PK. Trail hops always land on page 1.
 */
export interface TrailNode {
  table: TableInfo;
  filters: GridFilter[];
  orderBy: OrderBy | null;
}

export function trailNode(table: TableInfo, filters: GridFilter[] = []): TrailNode {
  return { table, filters, orderBy: null };
}

export function tableLabel(t: TableInfo): string {
  return t.schema ? `${t.schema}.${t.name}` : t.name;
}

/** Browser semantics: pushing from a middle node truncates everything after it. */
export function pushTrail(
  trail: TrailNode[],
  idx: number,
  node: TrailNode,
): { trail: TrailNode[]; idx: number } {
  const kept = trail.slice(0, idx + 1);
  return { trail: [...kept, node], idx: kept.length };
}

/** Write the live view state back into the node you are leaving. */
export function syncTrail(
  trail: TrailNode[],
  idx: number,
  patch: Partial<TrailNode>,
): TrailNode[] {
  if (!trail[idx]) return trail;
  return trail.map((n, i) => (i === idx ? { ...n, ...patch } : n));
}

/** Returns the index, or null when it falls outside the trail (no-op at either end). */
export function validTrailIdx(trail: TrailNode[], idx: number): number | null {
  return idx >= 0 && idx < trail.length ? idx : null;
}
