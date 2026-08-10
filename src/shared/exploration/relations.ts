import type { ForeignKey } from "@/types/db";
import { tableObjectRef } from "./objectRef";
import type { DatabaseRelation, TableLike } from "./types";

/** Normalize a schema ForeignKey into a navigable DatabaseRelation. */
export function foreignKeyToRelation(
  connectionId: string,
  sourceTable: TableLike,
  fk: ForeignKey,
  database?: string | null,
): DatabaseRelation {
  return {
    relationType: "foreign_key",
    name: fk.name,
    source: {
      table: tableObjectRef(connectionId, sourceTable, database),
      columns: [...fk.columns],
    },
    target: {
      table: tableObjectRef(
        connectionId,
        { name: fk.foreign_table, schema: fk.foreign_schema },
        database,
      ),
      columns: [...fk.foreign_columns],
    },
  };
}
