import { emptyProfile, type AdoptionProfile, type TableRef } from "./types";
import type { ExplorationVisit, DatabaseObjectRef } from "@/shared/exploration/types";
import { objectRefKey, sameObjectRef, tableObjectRef } from "@/shared/exploration/objectRef";

const LS_KEY = "dib:adoption-profile";
const MAX_RECENT = 10;

/** In-memory fallback when `localStorage` is missing (e.g. bun:test). */
let memoryStore: string | null = null;

function readStorage(): string | null {
  try {
    if (typeof localStorage !== "undefined") {
      return localStorage.getItem(LS_KEY);
    }
  } catch {
    /* ignore */
  }
  return memoryStore;
}

function writeStorage(value: string): void {
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(LS_KEY, value);
      return;
    }
  } catch {
    /* quota — fall through to memory */
  }
  memoryStore = value;
}

function clearStorage(): void {
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.removeItem(LS_KEY);
    }
  } catch {
    /* ignore */
  }
  memoryStore = null;
}

function readRaw(): AdoptionProfile {
  try {
    const raw = readStorage();
    if (!raw) return emptyProfile();
    const parsed = JSON.parse(raw) as AdoptionProfile;
    if (!parsed || parsed.version !== 1 || typeof parsed.byConnection !== "object") {
      return emptyProfile();
    }
    return { version: 1, byConnection: parsed.byConnection ?? {} };
  } catch {
    return emptyProfile();
  }
}

function writeRaw(profile: AdoptionProfile): void {
  writeStorage(JSON.stringify(profile));
}

function visitToTableRef(visit: ExplorationVisit): TableRef {
  const { ref } = visit;
  if (ref.objectType === "column" && ref.parentObjectId) {
    return { name: ref.parentObjectId, schema: ref.schema ?? null };
  }
  return { name: ref.objectId, schema: ref.schema ?? null };
}

function recentFromVisits(visits: ExplorationVisit[] | undefined, fallback?: TableRef): TableRef[] {
  if (visits?.length) {
    const seen = new Set<string>();
    const out: TableRef[] = [];
    for (const v of visits) {
      if (v.ref.objectType !== "table" && v.ref.objectType !== "view" && v.ref.objectType !== "materialized_view") {
        continue;
      }
      const t = visitToTableRef(v);
      const k = `${t.schema ?? ""}.${t.name}`;
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(t);
      if (out.length >= MAX_RECENT) break;
    }
    return out;
  }
  return fallback ? [fallback] : [];
}

export function getAdoptionProfile(): AdoptionProfile {
  return readRaw();
}

export function getConnectionExploration(savedId: string) {
  return readRaw().byConnection[savedId];
}

/** Record a navigable object visit (tables/views). Keeps TableRef fields in sync for hub UI. */
export function recordObjectVisit(ref: DatabaseObjectRef): void {
  if (!ref.connectionId) return;
  if (
    ref.objectType !== "table" &&
    ref.objectType !== "view" &&
    ref.objectType !== "materialized_view"
  ) {
    return;
  }

  const visit: ExplorationVisit = { ref, visitedAt: Date.now() };
  const profile = readRaw();
  const prev = profile.byConnection[ref.connectionId] ?? {};
  const priorVisits = prev.recentVisits ?? [];
  const recentVisits = [
    visit,
    ...priorVisits.filter((v) => objectRefKey(v.ref) !== objectRefKey(ref)),
  ].slice(0, MAX_RECENT);

  const tableRef = visitToTableRef(visit);
  profile.byConnection[ref.connectionId] = {
    ...prev,
    lastOpenedTable: tableRef,
    recentTables: recentFromVisits(recentVisits),
    recentVisits,
    tableVisitCount: (prev.tableVisitCount ?? 0) + 1,
  };
  writeRaw(profile);
}

export function recordTableVisit(savedId: string, table: TableRef): void {
  if (!savedId) return;
  recordObjectVisit(tableObjectRef(savedId, table));
}

/** Drop a stale visit when open fails / object missing. */
export function removeObjectVisit(savedId: string, ref: DatabaseObjectRef): void {
  if (!savedId) return;
  const profile = readRaw();
  const prev = profile.byConnection[savedId];
  if (!prev) return;
  const recentVisits = (prev.recentVisits ?? []).filter((v) => !sameObjectRef(v.ref, ref));
  const tables = recentFromVisits(recentVisits);
  profile.byConnection[savedId] = {
    ...prev,
    recentVisits,
    recentTables: tables,
    lastOpenedTable: tables[0],
  };
  writeRaw(profile);
}

/** Test helper — clears adoption memory. */
export function __resetAdoptionProfileForTests(): void {
  clearStorage();
}

/** Test helper — inject raw LS payload (e.g. corrupt JSON). */
export function __seedAdoptionProfileRawForTests(raw: string): void {
  writeStorage(raw);
}
