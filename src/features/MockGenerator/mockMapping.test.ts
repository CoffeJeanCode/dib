import { describe, expect, it } from "bun:test";
import { guessFaker, guessAll } from "./mockMapping";
import type { ColumnInfo } from "@/types/db";

const col = (over: Partial<ColumnInfo>): ColumnInfo => ({
  name: "x",
  data_type: "text",
  is_primary_key: false,
  is_nullable: true,
  ...over,
});

describe("guessFaker", () => {
  it("matches on column name before falling back to type", () => {
    expect(guessFaker(col({ name: "email" }))).toBe("email");
    expect(guessFaker(col({ name: "correo_electronico" }))).toBe("email");
    expect(guessFaker(col({ name: "first_name" }))).toBe("first_name");
    expect(guessFaker(col({ name: "ciudad" }))).toBe("city");
  });

  it("prefers the more specific name rule", () => {
    // "first_name" must not be swallowed by the generic /name/ rule.
    expect(guessFaker(col({ name: "first_name" }))).toBe("first_name");
    expect(guessFaker(col({ name: "last_name" }))).toBe("last_name");
    expect(guessFaker(col({ name: "name" }))).toBe("full_name");
  });

  it("falls back to the data type when the name says nothing", () => {
    expect(guessFaker(col({ name: "col_a", data_type: "boolean" }))).toBe("boolean");
    expect(guessFaker(col({ name: "col_b", data_type: "integer" }))).toBe("number");
    expect(guessFaker(col({ name: "col_c", data_type: "varchar" }))).toBe("word");
    expect(guessFaker(col({ name: "col_d", data_type: "bytea" }))).toBe("");
  });

  it("leaves auto-increment primary keys to the database", () => {
    expect(guessFaker(col({ name: "id", data_type: "serial", is_primary_key: true }))).toBe("");
    expect(guessFaker(col({ name: "id", data_type: "bigint", is_primary_key: true }))).toBe("");
    // A uuid PK is client-generated, so it still gets filled.
    expect(guessFaker(col({ name: "id", data_type: "uuid", is_primary_key: true }))).toBe("uuid");
  });

  it("maps every column, keyed by name", () => {
    expect(guessAll([col({ name: "email" }), col({ name: "nope", data_type: "bytea" })]))
      .toEqual({ email: "email", nope: "" });
  });
});
