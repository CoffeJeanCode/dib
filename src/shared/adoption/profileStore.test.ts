import { describe, expect, it, beforeEach } from "bun:test";
import {
  getAdoptionProfile,
  getConnectionExploration,
  recordTableVisit,
  __resetAdoptionProfileForTests,
  __seedAdoptionProfileRawForTests,
} from "./profileStore";

describe("profileStore", () => {
  beforeEach(() => {
    __resetAdoptionProfileForTests();
  });

  it("starts empty", () => {
    expect(getAdoptionProfile()).toEqual({ version: 1, byConnection: {} });
  });

  it("records recent tables MRU", () => {
    recordTableVisit("conn-a", { name: "users", schema: "public" });
    recordTableVisit("conn-a", { name: "orders", schema: "public" });
    recordTableVisit("conn-a", { name: "users", schema: "public" });
    const mem = getConnectionExploration("conn-a");
    expect(mem?.lastOpenedTable).toEqual({ name: "users", schema: "public" });
    expect(mem?.recentTables?.map((t) => t.name)).toEqual(["users", "orders"]);
    expect(mem?.tableVisitCount).toBe(3);
    expect(mem?.recentVisits?.[0]?.ref.objectId).toBe("users");
    expect(mem?.recentVisits?.[0]?.visitedAt).toBeGreaterThan(0);
  });

  it("isolates connections", () => {
    recordTableVisit("a", { name: "t1", schema: null });
    recordTableVisit("b", { name: "t2", schema: null });
    expect(getConnectionExploration("a")?.lastOpenedTable?.name).toBe("t1");
    expect(getConnectionExploration("b")?.lastOpenedTable?.name).toBe("t2");
  });

  it("survives corrupt storage", () => {
    __seedAdoptionProfileRawForTests("{not-json");
    expect(getAdoptionProfile()).toEqual({ version: 1, byConnection: {} });
  });
});
