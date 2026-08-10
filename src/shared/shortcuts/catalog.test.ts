import { expect, test } from "bun:test";
import {
  SHORTCUT_CATALOG,
  assertNoShortcutConflicts,
  cheatSheetSections,
  combo,
  display,
  findConflicts,
} from "./catalog";

test("shortcut catalog has no overlapping-scope conflicts", () => {
  expect(findConflicts()).toEqual([]);
  expect(() => assertNoShortcutConflicts()).not.toThrow();
});

test("sidebar activity uses Ctrl+Shift+digit (not Visual EXPLAIN E)", () => {
  expect(combo("sidebar.activity.1")).toBe("ctrl+shift+1");
  expect(combo("sidebar.activity.2")).toBe("ctrl+shift+2");
  expect(combo("sidebar.activity.3")).toBe("ctrl+shift+3");
  expect(combo("sql.visualExplain")).toBe("ctrl+shift+e");
  expect(display("sql.visualExplain")).toBe("Ctrl+Shift+E");
});

test("detects global (allowInMonaco) vs monaco clash on same combo", () => {
  const conflicts = findConflicts([
    {
      id: "a",
      combos: ["ctrl+shift+e"],
      description: "sidebar",
      section: "navigation",
      scopes: ["global"],
    },
    {
      id: "b",
      combos: ["ctrl+shift+e"],
      description: "explain",
      section: "sql",
      scopes: ["monaco"],
    },
  ]);
  expect(conflicts).toEqual([
    { combo: "ctrl+shift+e", a: "a", b: "b", scopes: ["monaco"] },
  ]);
});

test("grid vs monaco same combo is allowed (focus-scoped)", () => {
  expect(
    findConflicts([
      {
        id: "sql.save",
        combos: ["ctrl+s"],
        description: "Save script",
        section: "sql",
        scopes: ["monaco"],
      },
      {
        id: "grid.save",
        combos: ["ctrl+s"],
        description: "Save changes",
        section: "grid-edit",
        scopes: ["grid"],
      },
    ]),
  ).toEqual([]);
});

test("cheat sheet sections are non-empty and cover Visual EXPLAIN", () => {
  const sections = cheatSheetSections();
  expect(sections.length).toBeGreaterThan(3);
  const sql = sections.find((s) => s.title === "SQL Editor");
  expect(sql?.rows.some(([c, d]) => c.includes("Ctrl+Shift+E") && d.includes("EXPLAIN"))).toBe(
    true,
  );
});

test("every catalog id is unique", () => {
  const ids = SHORTCUT_CATALOG.map((e) => e.id);
  expect(new Set(ids).size).toBe(ids.length);
});
