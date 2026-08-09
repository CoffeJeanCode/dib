// bun test src/features/QueryPanel/trail.test.ts
import { expect, test } from "bun:test";
import type { GridFilter } from "@/types/db";
import { pushTrail, syncTrail, validTrailIdx, trailNode } from "./trail";

const n = (name: string) => trailNode({ name, schema: null });

test("push appends and advances", () => {
  const a = pushTrail([n("users")], 0, n("orders"));
  expect(a.trail.map((x) => x.table.name)).toEqual(["users", "orders"]);
  expect(a.idx).toBe(1);
});

test("push from a middle node truncates the tail", () => {
  const { trail } = pushTrail([n("users"), n("orders"), n("payments")], 0, n("sessions"));
  expect(trail.map((x) => x.table.name)).toEqual(["users", "sessions"]);
});

test("an index outside the trail is rejected", () => {
  const t = [n("users"), n("orders")];
  expect(validTrailIdx(t, -1)).toBeNull();
  expect(validTrailIdx(t, 2)).toBeNull();
  expect(validTrailIdx(t, 1)).toBe(1);
});

// A self-referencing FK (employees.manager_id → employees) or a cycle back to
// the root table puts the same table in the trail twice. That must be a normal
// hop, not a collision.
test("the same table can appear twice in the trail", () => {
  const { trail, idx } = pushTrail([n("users"), n("orders")], 1, n("users"));
  expect(trail.map((x) => x.table.name)).toEqual(["users", "orders", "users"]);
  expect(idx).toBe(2);
});

test("sync on an out-of-range index leaves the trail untouched", () => {
  const t = [n("users")];
  expect(syncTrail(t, 5, { filters: [] })).toBe(t);
});

test("sync writes live state into the node being left", () => {
  const f: GridFilter[] = [{ column: "id", operator: "=", value: "42" }];
  const t = syncTrail([n("users"), n("orders")], 0, { filters: f });
  expect(t[0].filters).toEqual(f);
  expect(t[1].filters).toEqual([]);
});
