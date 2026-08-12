/**
 * Single source of truth for keyboard shortcuts.
 *
 * Rules:
 * - Every app shortcut (registry, Monaco, grid) must be listed here.
 * - Same combo + overlapping scopes = conflict (caught by catalog.test.ts).
 * - `global` with allowInMonaco semantics intersects `monaco` — do not reuse
 *   Monaco chords for global allowInMonaco handlers.
 */

export type ShortcutScope = "global" | "monaco" | "grid";

export type ShortcutSection =
  | "navigation"
  | "palette"
  | "tabs"
  | "sql"
  | "grid-edit"
  | "grid-select"
  | "layout";

export interface ShortcutEntry {
  id: string;
  /** Normalized combos matching useKeybindings `_key()` output. */
  combos: readonly string[];
  /** Optional cheat-sheet / tooltip override (defaults to formatted primary combo). */
  display?: string;
  description: string;
  section: ShortcutSection;
  /** Where the shortcut is active. Overlapping scopes + same combo = conflict. */
  scopes: readonly ShortcutScope[];
  /** Include in KeyboardCheatSheet (default true). */
  cheatSheet?: boolean;
}

const SECTION_TITLES: Record<ShortcutSection, string> = {
  navigation: "Global Navigation",
  palette: "Command Palette",
  tabs: "Tabs",
  sql: "SQL Editor",
  "grid-edit": "DataGrid — Editing",
  "grid-select": "DataGrid — Selection",
  layout: "Layout",
};

/** Cheat sheet section order. */
const SECTION_ORDER: ShortcutSection[] = [
  "navigation",
  "palette",
  "tabs",
  "sql",
  "grid-edit",
  "grid-select",
  "layout",
];

export const SHORTCUT_CATALOG: readonly ShortcutEntry[] = [
  // ── Navigation / sidebar activity (Shift+Alt+Q/W/E — home row, ergonomic) ──
  // NOTE: combos must follow the _key() modifier order (ctrl → alt → shift), so
  // "Shift+Alt" is registered as alt+shift+q. `display` keeps the plain label.
  {
    id: "sidebar.activity.1",
    combos: ["alt+shift+q"],
    display: "Shift+Alt+Q",
    description: "Sidebar: Instances / Explorer",
    section: "navigation",
    scopes: ["global"],
  },
  {
    id: "sidebar.activity.2",
    combos: ["alt+shift+w"],
    display: "Shift+Alt+W",
    description: "Sidebar: Workspaces (home) / Files (connected)",
    section: "navigation",
    scopes: ["global"],
  },
  {
    id: "sidebar.activity.3",
    combos: ["alt+shift+e"],
    display: "Shift+Alt+E",
    description: "Sidebar: History (when connected)",
    section: "navigation",
    scopes: ["global"],
  },
  {
    id: "sidebar.toggle",
    combos: ["ctrl+b"],
    description: "Toggle sidebar",
    section: "navigation",
    scopes: ["global"],
  },
  {
    id: "panel.focusMain",
    combos: ["ctrl+0"],
    description: "Focus main panel",
    section: "navigation",
    scopes: ["global"],
  },
  {
    id: "panel.focusEditor",
    combos: ["ctrl+l"],
    description: "Focus editor / grid",
    section: "navigation",
    scopes: ["global"],
  },
  {
    id: "app.reloadData",
    combos: ["ctrl+r"],
    description: "Reload active data",
    section: "navigation",
    scopes: ["global"],
  },
  {
    id: "app.reloadApp",
    combos: ["ctrl+shift+r"],
    description: "Reload app",
    section: "navigation",
    scopes: ["global"],
  },
  {
    id: "help.cheatSheet",
    combos: ["ctrl+/"],
    description: "Keyboard shortcuts",
    section: "navigation",
    scopes: ["global"],
  },
  {
    id: "layout.bottomPanel",
    combos: ["ctrl+j"],
    description: "Toggle bottom panel",
    section: "layout",
    scopes: ["global"],
    cheatSheet: false,
  },

  // ── Palette ──
  {
    id: "palette.open",
    combos: ["ctrl+p", "ctrl+k"],
    display: "Ctrl+P / Ctrl+K",
    description: "Open Command Palette",
    section: "palette",
    scopes: ["global"],
  },
  {
    id: "palette.actions",
    combos: ["ctrl+shift+p"],
    description: "Palette: actions",
    section: "palette",
    scopes: ["global"],
  },
  {
    id: "palette.database",
    combos: ["ctrl+shift+d"],
    description: "Palette: switch database",
    section: "palette",
    scopes: ["global"],
  },
  {
    id: "palette.script",
    combos: ["ctrl+shift+s"],
    description: "Palette: open script",
    section: "palette",
    scopes: ["global"],
  },
  {
    id: "palette.objects",
    combos: ["ctrl+shift+o"],
    description: "Palette: DB objects",
    section: "palette",
    scopes: ["global"],
  },
  {
    id: "palette.alter",
    combos: ["ctrl+shift+a"],
    description: "Palette: Alter Table",
    section: "palette",
    scopes: ["global"],
    cheatSheet: false,
  },
  {
    id: "palette.drop",
    combos: ["ctrl+shift+x"],
    description: "Palette: Drop Table",
    section: "palette",
    scopes: ["global"],
    cheatSheet: false,
  },
  {
    id: "palette.insert",
    combos: ["ctrl+shift+i"],
    description: "Palette: Insert Row",
    section: "palette",
    scopes: ["global"],
    cheatSheet: false,
  },

  // ── Tabs ──
  {
    id: "tab.new",
    combos: ["ctrl+t"],
    description: "New SQL tab",
    section: "tabs",
    scopes: ["global"],
  },
  {
    id: "tab.close",
    combos: ["ctrl+w"],
    description: "Close active tab",
    section: "tabs",
    scopes: ["global"],
  },
  {
    id: "tab.closeAll",
    combos: ["ctrl+shift+w"],
    description: "Close ALL tabs",
    section: "tabs",
    scopes: ["global"],
  },
  {
    id: "tab.restore",
    combos: ["ctrl+shift+t"],
    description: "Restore last tab",
    section: "tabs",
    scopes: ["global"],
  },
  {
    id: "tab.next",
    combos: ["ctrl+tab", "ctrl+pagedown"],
    display: "Ctrl+Tab / Ctrl+PageDown",
    description: "Next tab",
    section: "tabs",
    scopes: ["global"],
  },
  {
    id: "tab.prev",
    combos: ["ctrl+shift+tab", "ctrl+pageup"],
    display: "Ctrl+Shift+Tab / Ctrl+PageUp",
    description: "Previous tab",
    section: "tabs",
    scopes: ["global"],
  },
  {
    id: "tab.jump",
    combos: ["alt+1", "alt+2", "alt+3", "alt+4", "alt+5", "alt+6", "alt+7", "alt+8", "alt+9"],
    display: "Alt+1…8 / Alt+9",
    description: "Jump to tab 1–8 / last tab",
    section: "tabs",
    scopes: ["global"],
  },
  {
    id: "tab.import",
    combos: ["ctrl+o"],
    description: "Import script",
    section: "tabs",
    scopes: ["global"],
  },

  // ── SQL / Monaco ──
  {
    id: "sql.run",
    combos: ["ctrl+enter"],
    display: "Ctrl+Enter",
    description: "Run query",
    section: "sql",
    scopes: ["monaco"],
  },
  {
    id: "sql.runF5",
    combos: ["f5"],
    display: "F5",
    description: "Run query",
    section: "sql",
    scopes: ["monaco"],
    cheatSheet: false, // aliased under sql.run display in empty state
  },
  {
    id: "sql.runCurrent",
    combos: ["ctrl+shift+enter"],
    display: "Ctrl+Shift+Enter",
    description: "Run statement under cursor",
    section: "sql",
    scopes: ["monaco"],
  },
  {
    id: "sql.visualExplain",
    combos: ["ctrl+shift+e"],
    display: "Ctrl+Shift+E",
    description: "Visual EXPLAIN",
    section: "sql",
    scopes: ["monaco"],
  },
  {
    id: "sql.save",
    combos: ["ctrl+s"],
    description: "Save script",
    section: "sql",
    scopes: ["monaco"],
  },

  // ── DataGrid editing ──
  {
    id: "grid.edit",
    combos: ["enter", "f2"],
    display: "Enter / F2",
    description: "Edit cell",
    section: "grid-edit",
    scopes: ["grid"],
  },
  {
    id: "grid.cancel",
    combos: ["escape"],
    display: "Escape",
    description: "Cancel editing",
    section: "grid-edit",
    scopes: ["grid"],
  },
  {
    id: "grid.nextCell",
    combos: ["tab"],
    display: "Tab / Shift+Tab",
    description: "Next / previous cell",
    section: "grid-edit",
    scopes: ["grid"],
  },
  {
    id: "grid.save",
    combos: ["ctrl+s"],
    description: "Save changes",
    section: "grid-edit",
    scopes: ["grid"],
  },
  {
    id: "grid.undo",
    combos: ["ctrl+z"],
    description: "Undo",
    section: "grid-edit",
    scopes: ["grid"],
  },
  {
    id: "grid.redo",
    combos: ["ctrl+y", "ctrl+shift+z"],
    display: "Ctrl+Y / Ctrl+Shift+Z",
    description: "Redo",
    section: "grid-edit",
    scopes: ["grid"],
  },
  {
    id: "grid.newRow",
    combos: ["ctrl+n"],
    description: "New row",
    section: "grid-edit",
    scopes: ["global"], // registered in QueryPanel; not while Monaco focused
  },
  {
    id: "grid.duplicateRow",
    combos: ["ctrl+d"],
    description: "Duplicate row",
    section: "grid-edit",
    scopes: ["grid"],
  },
  {
    id: "grid.deleteRow",
    combos: ["delete", "backspace"],
    display: "Delete / Backspace",
    description: "Mark row for deletion",
    section: "grid-edit",
    scopes: ["grid"],
  },

  // ── DataGrid selection / FK ──
  {
    id: "grid.selectAll",
    combos: ["ctrl+a"],
    description: "Select all",
    section: "grid-select",
    scopes: ["grid"],
  },
  {
    id: "grid.copy",
    combos: ["ctrl+c"],
    description: "Copy selection (TSV)",
    section: "grid-select",
    scopes: ["grid"],
  },
  {
    id: "grid.fkOpen",
    combos: ["ctrl+enter"],
    display: "Ctrl+Enter / Ctrl+Click (FK)",
    description: "Navigate to parent table (new tab)",
    section: "grid-select",
    scopes: ["grid"],
  },
  {
    id: "grid.fkOpenInPlace",
    combos: ["ctrl+shift+enter"],
    display: "Ctrl+Shift+Enter / Ctrl+Shift+Click (FK)",
    description: "Navigate in place, adding a breadcrumb",
    section: "grid-select",
    scopes: ["grid"],
  },
  {
    id: "grid.trail",
    combos: ["alt+arrowleft", "alt+arrowright"],
    display: "Alt+← / Alt+→",
    description: "Walk the breadcrumb trail back / forward",
    section: "grid-select",
    scopes: ["global"],
  },
  {
    id: "grid.fkPeek",
    combos: ["alt+p"],
    display: "Alt+P",
    description: "Peek the FK in the active cell",
    section: "grid-select",
    scopes: ["grid"],
  },
] as const;

export type ShortcutId = (typeof SHORTCUT_CATALOG)[number]["id"];

const BY_ID = new Map(SHORTCUT_CATALOG.map((e) => [e.id, e]));

export function formatCombo(combo: string): string {
  return combo
    .split("+")
    .map((part) => {
      switch (part) {
        case "ctrl":
          return "Ctrl";
        case "alt":
          return "Alt";
        case "shift":
          return "Shift";
        case "enter":
          return "Enter";
        case "tab":
          return "Tab";
        case "escape":
          return "Escape";
        case "delete":
          return "Delete";
        case "backspace":
          return "Backspace";
        case "pagedown":
          return "PageDown";
        case "pageup":
          return "PageUp";
        case "arrowleft":
          return "←";
        case "arrowright":
          return "→";
        case "arrowup":
          return "↑";
        case "arrowdown":
          return "↓";
        case "f2":
          return "F2";
        case "f5":
          return "F5";
        default:
          return part.length === 1 ? part.toUpperCase() : part;
      }
    })
    .join("+");
}

export function shortcut(id: ShortcutId): ShortcutEntry {
  const entry = BY_ID.get(id);
  if (!entry) throw new Error(`[shortcuts] unknown id: ${id}`);
  return entry;
}

/** All normalized combos for a shortcut id. */
export function combos(id: ShortcutId): readonly string[] {
  return shortcut(id).combos;
}

/** Primary normalized combo for registration / triggerShortcut. */
export function combo(id: ShortcutId): string {
  return shortcut(id).combos[0];
}

/** Human-readable label for tooltips and UI. */
export function display(id: ShortcutId): string {
  const entry = shortcut(id);
  return entry.display ?? formatCombo(entry.combos[0]);
}

export interface ShortcutConflict {
  combo: string;
  a: string;
  b: string;
  scopes: ShortcutScope[];
}

function effectiveScopes(scopes: readonly ShortcutScope[]): Set<ShortcutScope> {
  const set = new Set<ShortcutScope>(scopes);
  // Registry shortcuts nearly always use allowInMonaco, so they steal chords from the editor.
  if (set.has("global")) set.add("monaco");
  return set;
}

function scopesOverlap(a: readonly ShortcutScope[], b: readonly ShortcutScope[]): boolean {
  const A = effectiveScopes(a);
  for (const s of effectiveScopes(b)) {
    if (A.has(s)) return true;
  }
  return false;
}

/** Find combo collisions across overlapping scopes. */
export function findConflicts(
  catalog: readonly ShortcutEntry[] = SHORTCUT_CATALOG,
): ShortcutConflict[] {
  const conflicts: ShortcutConflict[] = [];
  for (let i = 0; i < catalog.length; i++) {
    for (let j = i + 1; j < catalog.length; j++) {
      const a = catalog[i];
      const b = catalog[j];
      if (!scopesOverlap(a.scopes, b.scopes)) continue;
      for (const c of a.combos) {
        if (!b.combos.includes(c)) continue;
        const shared = [...effectiveScopes(a.scopes)].filter((s) =>
          effectiveScopes(b.scopes).has(s),
        );
        conflicts.push({ combo: c, a: a.id, b: b.id, scopes: shared });
      }
    }
  }
  return conflicts;
}

export function assertNoShortcutConflicts(
  catalog: readonly ShortcutEntry[] = SHORTCUT_CATALOG,
): void {
  const conflicts = findConflicts(catalog);
  if (conflicts.length === 0) return;
  const lines = conflicts.map(
    (c) => `  ${c.combo}: ${c.a} ↔ ${c.b} (scopes: ${c.scopes.join(", ")})`,
  );
  throw new Error(`[shortcuts] conflicts:\n${lines.join("\n")}`);
}

export interface CheatSheetSection {
  title: string;
  rows: Array<[string, string]>;
}

export function cheatSheetSections(
  catalog: readonly ShortcutEntry[] = SHORTCUT_CATALOG,
): CheatSheetSection[] {
  const bySection = new Map<ShortcutSection, ShortcutEntry[]>();
  for (const entry of catalog) {
    if (entry.cheatSheet === false) continue;
    const list = bySection.get(entry.section) ?? [];
    list.push(entry);
    bySection.set(entry.section, list);
  }
  return SECTION_ORDER.filter((s) => bySection.has(s)).map((section) => ({
    title: SECTION_TITLES[section],
    rows: (bySection.get(section) ?? []).map((e) => [
      e.display ?? formatCombo(e.combos[0]),
      e.description,
    ]),
  }));
}
