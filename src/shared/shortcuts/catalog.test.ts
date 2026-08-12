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

test("sidebar activity uses Shift+Alt+Q/W/E (not Visual EXPLAIN E)", () => {
  expect(combo("sidebar.activity.1")).toBe("alt+shift+q");
  expect(combo("sidebar.activity.2")).toBe("alt+shift+w");
  expect(combo("sidebar.activity.3")).toBe("alt+shift+e");
  expect(combo("sql.visualExplain")).toBe("ctrl+shift+e");
  expect(display("sql.visualExplain")).toBe("Ctrl+Shift+E");
  expect(display("sidebar.activity.1")).toBe("Shift+Alt+Q");
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

test("combos follow _key() modifier order (ctrl → alt → shift)", () => {
  // useKeybindings _key() emits "ctrl", "alt", "shift" in that order, so a combo
  // like "shift+alt+q" never matches the produced "alt+shift+q" event string.
  const RANK = new Map<string, number>([["ctrl", 0], ["alt", 1], ["shift", 2]]);
  for (const e of SHORTCUT_CATALOG) {
    for (const c of e.combos) {
      const mods = c.split("+").filter((p) => RANK.has(p));
      const ranks = mods.map((m) => RANK.get(m)!);
      expect(
        [...ranks].sort((a, b) => a - b),
        `combo "${c}" (${e.id}) modifiers out of normalizer order`,
      ).toEqual(ranks);
    }
  }
});
