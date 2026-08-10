import { useWorkspaceStore } from "@/store/workspaceStore";
import { refToTableInfo, tableObjectRef } from "./objectRef";
import type { DatabaseObjectRef, OpenDatabaseObjectOptions, TableLike } from "./types";

const TABLE_LIKE: ReadonlySet<string> = new Set([
  "table",
  "view",
  "materialized_view",
]);

/**
 * Single navigation entry for database objects.
 * Callers should not invent parallel openTable / openFromFk / openFromSearch paths.
 */
export function openDatabaseObject(
  ref: DatabaseObjectRef,
  options: OpenDatabaseObjectOptions = {},
): void {
  const mode = options.mode ?? "data";
  const ws = useWorkspaceStore.getState();

  if (TABLE_LIKE.has(ref.objectType)) {
    const table = refToTableInfo(ref);
    if (mode === "structure") {
      ws.openTableStructure(table);
      return;
    }
    if (mode === "relations") {
      ws.openTableRelations(table);
      return;
    }
    ws.setNavigateTo({
      table,
      v: Date.now(),
      filters: options.filters,
    });
    return;
  }

  if (ref.objectType === "column" && ref.parentObjectId) {
    // v1: opening a column opens its parent table (structure later).
    ws.setNavigateTo({
      table: refToTableInfo(ref),
      v: Date.now(),
      filters: options.filters,
    });
  }
}

/** Convenience for code that still holds TableInfo. */
export function openTableObject(
  connectionId: string,
  table: TableLike,
  options?: OpenDatabaseObjectOptions & { database?: string | null },
): void {
  openDatabaseObject(tableObjectRef(connectionId, table, options?.database), options);
}
