import { describe, expect, it } from "bun:test";
import {
  pickImportantTables,
  rankExplorationEntries,
  scoreDomainTable,
} from "./rankExplorationEntries";
import type { TableInfo } from "@/types/db";

const t = (name: string, schema: string | null = "public"): TableInfo => ({ name, schema });

describe("pickImportantTables", () => {
  it("prefers recent visits over catalog order", () => {
    const tables = [t("zzz"), t("users"), t("aaa")];
    const important = pickImportantTables(tables, [{ name: "users", schema: "public" }]);
    expect(important.map((x) => x.name)).toEqual(["users"]);
  });

  it("on cold start with many tables, only surfaces domain-named ones", () => {
    const tables = [
      t("migration_log_2024"),
      t("tmp_backup"),
      t("users"),
      t("orders"),
      t("flyway_schema_history"),
      t("audit_event_payload_blob"),
    ];
    const important = pickImportantTables(tables, []);
    expect(important.map((x) => x.name).sort()).toEqual(["orders", "users"]);
  });

  it("on cold start with few user tables, shows them all", () => {
    const tables = [t("alpha"), t("beta")];
    expect(pickImportantTables(tables, []).map((x) => x.name)).toEqual(["alpha", "beta"]);
  });

  it("skips system tables", () => {
    expect(scoreDomainTable(t("pg_class", "pg_catalog"))).toBeLessThan(0);
  });

  it("returns empty when no recents and no domain signal in a large catalog", () => {
    const tables = Array.from({ length: 20 }, (_, i) => t(`entity_${i}`));
    expect(pickImportantTables(tables, [])).toEqual([]);
  });
});

describe("rankExplorationEntries", () => {
  it("while loading, offers search + SQL (no fake tables)", () => {
    const entries = rankExplorationEntries({
      readonly: false,
      tables: [],
      tablesReady: false,
    });
    expect(entries.map((e) => e.kind)).toEqual(["search_tables", "new_sql"]);
  });

  it("empty writable DB offers SQL and create table", () => {
    const entries = rankExplorationEntries({
      readonly: false,
      tables: [],
      tablesReady: true,
    });
    expect(entries.map((e) => e.kind)).toEqual(["new_sql", "create_table"]);
  });

  it("large irrelevant catalog → search + SQL only", () => {
    const tables = Array.from({ length: 20 }, (_, i) => t(`entity_${i}`));
    const entries = rankExplorationEntries({
      readonly: false,
      tables,
      tablesReady: true,
    });
    expect(entries.map((e) => e.kind)).toEqual(["search_tables", "new_sql"]);
  });

  it("pins continue from recent and lists other recents", () => {
    const users = t("users");
    const orders = t("orders");
    const entries = rankExplorationEntries({
      readonly: false,
      tables: [users, orders, t("noise_table_xyz")],
      tablesReady: true,
      lastOpenedTable: { name: "users", schema: "public" },
      recentTables: [
        { name: "users", schema: "public" },
        { name: "orders", schema: "public" },
      ],
    });
    expect(entries[0]).toMatchObject({ kind: "continue_table", label: "public.users" });
    expect(entries.filter((e) => e.kind === "open_table").map((e) => e.label)).toEqual([
      "public.orders",
    ]);
    expect(entries.some((e) => e.kind === "search_tables")).toBe(true);
    expect(entries.some((e) => e.kind === "new_sql")).toBe(true);
  });

  it("never returns create_table when readonly", () => {
    const entries = rankExplorationEntries({
      readonly: true,
      tables: [t("users")],
      tablesReady: true,
    });
    expect(entries.every((e) => e.kind !== "create_table")).toBe(true);
  });
});
