import { describe, expect, it } from "bun:test";
import {
  objectRefKey,
  parseObjectRefKey,
  refToTableInfo,
  sameObjectRef,
  serializeObjectRef,
  deserializeObjectRef,
  tableObjectRef,
  viewObjectRef,
} from "./objectRef";

describe("tableObjectRef", () => {
  it("builds a stable table ref from TableInfo", () => {
    const ref = tableObjectRef("conn-1", { name: "customers", schema: "public" }, "prod");
    expect(ref).toEqual({
      connectionId: "conn-1",
      database: "prod",
      schema: "public",
      objectType: "table",
      objectId: "customers",
    });
  });

  it("omits null schema and empty database", () => {
    const ref = tableObjectRef("c", { name: "t", schema: null });
    expect(ref.schema).toBeUndefined();
    expect(ref.database).toBeUndefined();
  });
});

describe("object identity", () => {
  it("sameObjectRef ignores display labels — compares identity fields", () => {
    const a = tableObjectRef("c", { name: "orders", schema: "public" }, "db");
    const b = tableObjectRef("c", { name: "orders", schema: "public" }, "db");
    expect(sameObjectRef(a, b)).toBe(true);
  });

  it("sidebar open and FK open of same table share identity", () => {
    const fromSidebar = tableObjectRef("saved-1", { name: "customers", schema: "public" });
    const fromFk = tableObjectRef("saved-1", { name: "customers", schema: "public" });
    expect(objectRefKey(fromSidebar)).toBe(objectRefKey(fromFk));
    expect(sameObjectRef(fromSidebar, fromFk)).toBe(true);
  });

  it("distinguishes schema-qualified names", () => {
    const a = tableObjectRef("c", { name: "users", schema: "public" });
    const b = tableObjectRef("c", { name: "users", schema: "auth" });
    expect(sameObjectRef(a, b)).toBe(false);
  });

  it("refToTableInfo round-trips without using labels as ids", () => {
    const ref = tableObjectRef("c", { name: "invoices", schema: "billing" });
    expect(refToTableInfo(ref)).toEqual({ name: "invoices", schema: "billing" });
  });
});

describe("serialization", () => {
  it("serializes and deserializes locally", () => {
    const ref = tableObjectRef("conn", { name: "t", schema: "s" }, "db");
    const raw = serializeObjectRef(ref);
    expect(deserializeObjectRef(raw)).toEqual(ref);
  });

  it("objectRefKey is parseable and stable", () => {
    const ref = viewObjectRef("c", { name: "v", schema: "public" });
    const key = objectRefKey(ref);
    expect(parseObjectRefKey(key)).toEqual(ref);
  });

  it("rejects corrupt payloads", () => {
    expect(deserializeObjectRef("{nope")).toBeNull();
    expect(deserializeObjectRef(JSON.stringify({ objectId: "x" }))).toBeNull();
    expect(parseObjectRefKey("not-a-key")).toBeNull();
  });
});
