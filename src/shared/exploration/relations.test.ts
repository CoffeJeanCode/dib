import { describe, expect, it } from "bun:test";
import { foreignKeyToRelation } from "./relations";
import { sameObjectRef, tableObjectRef } from "./objectRef";

describe("foreignKeyToRelation", () => {
  it("normalizes outgoing FK to navigable endpoints", () => {
    const rel = foreignKeyToRelation(
      "conn",
      { name: "orders", schema: "public" },
      {
        name: "orders_customer_id_fkey",
        columns: ["customer_id"],
        foreign_table: "customers",
        foreign_schema: "public",
        foreign_columns: ["id"],
        on_delete: "NO ACTION",
        on_update: "NO ACTION",
      },
      "shop",
    );

    expect(rel.relationType).toBe("foreign_key");
    expect(rel.source.columns).toEqual(["customer_id"]);
    expect(rel.target.columns).toEqual(["id"]);
    expect(
      sameObjectRef(
        rel.target.table,
        tableObjectRef("conn", { name: "customers", schema: "public" }, "shop"),
      ),
    ).toBe(true);
  });

  it("keeps composite FK column order", () => {
    const rel = foreignKeyToRelation(
      "c",
      { name: "line_items", schema: null },
      {
        name: "fk",
        columns: ["a", "b"],
        foreign_table: "parents",
        foreign_schema: null,
        foreign_columns: ["x", "y"],
        on_delete: "CASCADE",
        on_update: "CASCADE",
      },
    );
    expect(rel.source.columns).toEqual(["a", "b"]);
    expect(rel.target.columns).toEqual(["x", "y"]);
    expect(rel.target.table.schema).toBeUndefined();
  });
});
