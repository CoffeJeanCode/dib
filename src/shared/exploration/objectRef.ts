import type {
  DatabaseObjectRef,
  DatabaseObjectType,
  TableLike,
} from "./types";

const REF_VERSION = 1 as const;

type SerializedRef = DatabaseObjectRef & { v: typeof REF_VERSION };

function normalizeSchema(schema: string | null | undefined): string | undefined {
  return schema == null || schema === "" ? undefined : schema;
}

function normalizeDatabase(database: string | null | undefined): string | undefined {
  return database == null || database === "" ? undefined : database;
}

function makeRef(
  connectionId: string,
  objectType: DatabaseObjectType,
  table: TableLike,
  database?: string | null,
  parentObjectId?: string,
): DatabaseObjectRef {
  const ref: DatabaseObjectRef = {
    connectionId,
    objectType,
    objectId: table.name,
  };
  const schema = normalizeSchema(table.schema);
  const db = normalizeDatabase(database);
  if (schema) ref.schema = schema;
  if (db) ref.database = db;
  if (parentObjectId) ref.parentObjectId = parentObjectId;
  return ref;
}

export function tableObjectRef(
  connectionId: string,
  table: TableLike,
  database?: string | null,
): DatabaseObjectRef {
  return makeRef(connectionId, "table", table, database);
}

export function viewObjectRef(
  connectionId: string,
  table: TableLike,
  database?: string | null,
): DatabaseObjectRef {
  return makeRef(connectionId, "view", table, database);
}

export function materializedViewObjectRef(
  connectionId: string,
  table: TableLike,
  database?: string | null,
): DatabaseObjectRef {
  return makeRef(connectionId, "materialized_view", table, database);
}

export function columnObjectRef(
  connectionId: string,
  table: TableLike,
  columnName: string,
  database?: string | null,
): DatabaseObjectRef {
  return makeRef(connectionId, "column", { name: columnName, schema: table.schema }, database, table.name);
}

export function refToTableInfo(ref: DatabaseObjectRef): { name: string; schema: string | null } {
  if (ref.objectType === "column" && ref.parentObjectId) {
    return { name: ref.parentObjectId, schema: ref.schema ?? null };
  }
  return { name: ref.objectId, schema: ref.schema ?? null };
}

export function sameObjectRef(a: DatabaseObjectRef, b: DatabaseObjectRef): boolean {
  return (
    a.connectionId === b.connectionId &&
    a.objectType === b.objectType &&
    a.objectId === b.objectId &&
    (a.schema ?? undefined) === (b.schema ?? undefined) &&
    (a.database ?? undefined) === (b.database ?? undefined) &&
    (a.parentObjectId ?? undefined) === (b.parentObjectId ?? undefined)
  );
}

/** Compact stable key for history / Sets — not a display label. */
export function objectRefKey(ref: DatabaseObjectRef): string {
  const parts = [
    ref.connectionId,
    ref.database ?? "",
    ref.schema ?? "",
    ref.objectType,
    ref.parentObjectId ?? "",
    ref.objectId,
  ];
  return parts.join("\u001f");
}

export function parseObjectRefKey(key: string): DatabaseObjectRef | null {
  const parts = key.split("\u001f");
  if (parts.length !== 6) return null;
  const [connectionId, database, schema, objectType, parentObjectId, objectId] = parts;
  if (!connectionId || !objectType || !objectId) return null;
  const allowed: DatabaseObjectType[] = [
    "table",
    "view",
    "materialized_view",
    "column",
    "index",
    "constraint",
    "query",
  ];
  if (!allowed.includes(objectType as DatabaseObjectType)) return null;
  const ref: DatabaseObjectRef = {
    connectionId,
    objectType: objectType as DatabaseObjectType,
    objectId,
  };
  if (database) ref.database = database;
  if (schema) ref.schema = schema;
  if (parentObjectId) ref.parentObjectId = parentObjectId;
  return ref;
}

export function serializeObjectRef(ref: DatabaseObjectRef): string {
  const payload: SerializedRef = { v: REF_VERSION, ...ref };
  return JSON.stringify(payload);
}

export function deserializeObjectRef(raw: string): DatabaseObjectRef | null {
  try {
    const parsed = JSON.parse(raw) as Partial<SerializedRef>;
    if (
      !parsed ||
      parsed.v !== REF_VERSION ||
      typeof parsed.connectionId !== "string" ||
      typeof parsed.objectType !== "string" ||
      typeof parsed.objectId !== "string"
    ) {
      return null;
    }
    return {
      connectionId: parsed.connectionId,
      objectType: parsed.objectType as DatabaseObjectType,
      objectId: parsed.objectId,
      ...(parsed.database ? { database: parsed.database } : {}),
      ...(parsed.schema ? { schema: parsed.schema } : {}),
      ...(parsed.parentObjectId ? { parentObjectId: parsed.parentObjectId } : {}),
    };
  } catch {
    return null;
  }
}

/** Human path for headers — never used as identity. */
export function objectDisplayPath(ref: DatabaseObjectRef, opts?: { includeDatabase?: boolean }): string {
  const parts: string[] = [];
  if (opts?.includeDatabase && ref.database) parts.push(ref.database);
  if (ref.schema) parts.push(ref.schema);
  if (ref.objectType === "column" && ref.parentObjectId) {
    parts.push(ref.parentObjectId, ref.objectId);
  } else {
    parts.push(ref.objectId);
  }
  return parts.join(" / ");
}
