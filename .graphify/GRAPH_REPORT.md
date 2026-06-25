# Graph Report - .  (2026-06-24)

## Corpus Check
- Corpus is ~39.274 words - fits in a single context window. You may not need a graph.

## Summary
- 324 nodes · 592 edges · 15 communities detected
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output
- Edge kinds: contains: 229 · MODIFIES: 97 · imports: 86 · imports_from: 71 · calls: 52 · method: 36 · re_exports: 11 · ON_BRANCH: 5 · PARENT_OF: 4 · rationale_for: 1


## Input Scope
- Requested: auto
- Resolved: committed (source: default-auto)
- Included files: 59 · Candidates: 103
- Excluded: 12 untracked · 49627 ignored · 2 sensitive · 0 missing committed
- Recommendation: Use --scope all or graphify.yaml inputs.corpus for a knowledge-base folder.

## Graph Freshness
- Built from Git commit: `863e6a3`
- Compare this hash to `git rev-parse HEAD` before trusting freshness-sensitive graph output.
## God Nodes (most connected - your core abstractions)
1. `AppDb` - 13 edges
2. `PostgresDriver` - 12 edges
3. `SqliteDriver` - 12 edges
4. `SavedConnection` - 10 edges
5. `TableInfo` - 7 edges
6. `parse_ts_file()` - 7 edges
7. `keyring_entry()` - 6 edges
8. `useKeybindings()` - 6 edges
9. `parse_rust_file()` - 6 edges
10. `ToastContext` - 5 edges

## Surprising Connections (you probably didn't know these)
- `da9e33b Enhance sidebar functionality and integrate drag-and-drop for tabs` --ON_BRANCH--> `main`  [EXTRACTED]
  git → git  _Bridges community 0 → community 1_

## Communities

### Community 0 - "Community 0"
Cohesion: 0.06
Nodes (33): SystemStatus, da9e33b Enhance sidebar functionality and integrate drag-and-drop for tabs, f7b39e6 Add initial project setup with TypeScript, React, and Tauri, ConnectionManager(), ConnectionManagerProps, ContextMenu(), ContextMenuItem, ContextMenuProps (+25 more)

### Community 1 - "Community 1"
Cohesion: 0.07
Nodes (27): main, 2562ffd Add knowledge graph integration and UI enhancements, 2c5407b Refactor DataGrid and SqlEditor components for improved state management and UI updates, 863e6a3 Update project references from "Database Interface Builder" to "Data Illustrative Base", CommitFooter(), CommitFooterProps, DataGrid, DataGridProps (+19 more)

### Community 2 - "Community 2"
Cohesion: 0.08
Nodes (20): CommandAction, CommandPalette(), CommandPaletteProps, ITEM_CATEGORY, ITEM_ICON, PaletteItem, QueryHistoryPanelProps, CATEGORIES (+12 more)

### Community 3 - "Community 3"
Cohesion: 0.15
Nodes (19): ConnectionItem(), ConnectionItemProps, DatabaseCategories(), DatabaseSelector(), DatabaseSelectorProps, getScriptIcon(), ScriptItem(), ScriptItemProps (+11 more)

### Community 4 - "Community 4"
Cohesion: 0.16
Nodes (8): build_where_pg(), is_select(), pg_bind_json(), pg_cast_suffix(), pg_value_to_json(), PostgresDriver, qualified(), smart_val()

### Community 5 - "Community 5"
Cohesion: 0.11
Nodes (1): DbState

### Community 6 - "Community 6"
Cohesion: 0.14
Nodes (5): AppDb, InternalScript, keyring_entry(), QueryHistoryEntry, SavedConnection

### Community 7 - "Community 7"
Cohesion: 0.15
Nodes (13): BuilderRow, COMMON_TYPES, computeChanges(), TableBuilderGrid(), TableBuilderGridProps, _BLOCKED, _initListener(), _isMonaco() (+5 more)

### Community 8 - "Community 8"
Cohesion: 0.12
Nodes (14): ChangeRow, ColumnInfo, ConnectionInfo, ConnectionStatus, DatabaseDriver, DbConfig, GridFilter, PagedResult (+6 more)

### Community 9 - "Community 9"
Cohesion: 0.16
Nodes (5): build_where_sqlite(), is_select(), sqlite_bind_json(), sqlite_value_to_json(), SqliteDriver

### Community 10 - "Community 10"
Cohesion: 0.28
Nodes (15): build_graph(), Edge, main(), Node, node_id(), parse_css_file(), parse_rust_file(), parse_ts_file() (+7 more)

### Community 11 - "Community 11"
Cohesion: 0.18
Nodes (7): ImportedScript, list_scripts(), read_script(), safe_filename(), save_script(), ScriptMeta, workspace_path()

### Community 12 - "Community 12"
Cohesion: 0.20
Nodes (7): nodeTypes, SchemaVisualizer(), SchemaVisualizerProps, ENGINE_ACCENT, TableNode, TableNodeData, TableRelation

### Community 13 - "Community 13"
Cohesion: 0.24
Nodes (4): get_data_path(), load_ui_state(), save_ui_state(), UiState

### Community 14 - "Community 14"
Cohesion: 0.29
Nodes (5): ToastContainer(), ToastContainerProps, Toast, ToastType, useToast()

## Knowledge Gaps
- **80 isolated node(s):** `UiState`, `SystemStatus`, `ScriptMeta`, `ImportedScript`, `DbConfig` (+75 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `Community 5`** (1 nodes): `DbState`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What connects `UiState`, `SystemStatus`, `ScriptMeta` to the rest of the system?**
  _80 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.06077694235588972 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.07373737373737374 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.082010582010582 - nodes in this community are weakly interconnected._
- **Should `Community 5` be split into smaller, more focused modules?**
  _Cohesion score 0.1111111111111111 - nodes in this community are weakly interconnected._
- **Should `Community 6` be split into smaller, more focused modules?**
  _Cohesion score 0.1437908496732026 - nodes in this community are weakly interconnected._
- **Should `Community 7` be split into smaller, more focused modules?**
  _Cohesion score 0.14705882352941177 - nodes in this community are weakly interconnected._