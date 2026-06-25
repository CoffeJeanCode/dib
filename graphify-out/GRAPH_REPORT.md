# Graph Report - dib  (2026-06-25)

## Corpus Check
- 85 files · ~58,572 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 965 nodes · 1646 edges · 97 communities (68 shown, 29 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 4 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `f3723355`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 6|Community 6]]
- [[_COMMUNITY_Community 7|Community 7]]
- [[_COMMUNITY_Community 8|Community 8]]
- [[_COMMUNITY_Community 9|Community 9]]
- [[_COMMUNITY_Community 10|Community 10]]
- [[_COMMUNITY_Community 11|Community 11]]
- [[_COMMUNITY_Community 12|Community 12]]
- [[_COMMUNITY_Community 13|Community 13]]
- [[_COMMUNITY_Community 14|Community 14]]
- [[_COMMUNITY_Community 15|Community 15]]
- [[_COMMUNITY_Community 16|Community 16]]
- [[_COMMUNITY_Community 17|Community 17]]
- [[_COMMUNITY_Community 18|Community 18]]
- [[_COMMUNITY_Community 19|Community 19]]
- [[_COMMUNITY_Community 20|Community 20]]
- [[_COMMUNITY_Community 21|Community 21]]
- [[_COMMUNITY_Community 22|Community 22]]
- [[_COMMUNITY_Community 23|Community 23]]
- [[_COMMUNITY_Community 24|Community 24]]
- [[_COMMUNITY_Community 25|Community 25]]
- [[_COMMUNITY_Community 26|Community 26]]
- [[_COMMUNITY_Community 27|Community 27]]
- [[_COMMUNITY_Community 28|Community 28]]
- [[_COMMUNITY_Community 29|Community 29]]
- [[_COMMUNITY_Community 32|Community 32]]
- [[_COMMUNITY_Community 33|Community 33]]
- [[_COMMUNITY_Community 34|Community 34]]
- [[_COMMUNITY_Community 36|Community 36]]
- [[_COMMUNITY_Community 37|Community 37]]
- [[_COMMUNITY_Community 38|Community 38]]
- [[_COMMUNITY_Community 39|Community 39]]
- [[_COMMUNITY_Community 40|Community 40]]
- [[_COMMUNITY_Community 41|Community 41]]
- [[_COMMUNITY_Community 42|Community 42]]
- [[_COMMUNITY_Community 44|Community 44]]
- [[_COMMUNITY_Community 45|Community 45]]
- [[_COMMUNITY_Community 46|Community 46]]
- [[_COMMUNITY_Community 47|Community 47]]
- [[_COMMUNITY_Community 48|Community 48]]
- [[_COMMUNITY_Community 49|Community 49]]
- [[_COMMUNITY_Community 50|Community 50]]
- [[_COMMUNITY_Community 51|Community 51]]
- [[_COMMUNITY_Community 52|Community 52]]
- [[_COMMUNITY_Community 53|Community 53]]
- [[_COMMUNITY_Community 55|Community 55]]
- [[_COMMUNITY_Community 56|Community 56]]
- [[_COMMUNITY_Community 57|Community 57]]
- [[_COMMUNITY_Community 58|Community 58]]
- [[_COMMUNITY_Community 59|Community 59]]
- [[_COMMUNITY_Community 60|Community 60]]
- [[_COMMUNITY_Community 61|Community 61]]
- [[_COMMUNITY_Community 62|Community 62]]
- [[_COMMUNITY_Community 63|Community 63]]
- [[_COMMUNITY_Community 64|Community 64]]
- [[_COMMUNITY_Community 65|Community 65]]
- [[_COMMUNITY_Community 66|Community 66]]
- [[_COMMUNITY_Community 67|Community 67]]
- [[_COMMUNITY_Community 68|Community 68]]
- [[_COMMUNITY_Community 69|Community 69]]
- [[_COMMUNITY_Community 70|Community 70]]
- [[_COMMUNITY_Community 72|Community 72]]
- [[_COMMUNITY_Community 73|Community 73]]
- [[_COMMUNITY_Community 74|Community 74]]
- [[_COMMUNITY_Community 75|Community 75]]
- [[_COMMUNITY_Community 81|Community 81]]
- [[_COMMUNITY_Community 82|Community 82]]
- [[_COMMUNITY_Community 83|Community 83]]
- [[_COMMUNITY_Community 84|Community 84]]
- [[_COMMUNITY_Community 85|Community 85]]
- [[_COMMUNITY_Community 86|Community 86]]
- [[_COMMUNITY_Community 87|Community 87]]
- [[_COMMUNITY_Community 88|Community 88]]
- [[_COMMUNITY_Community 89|Community 89]]
- [[_COMMUNITY_Community 90|Community 90]]
- [[_COMMUNITY_Community 91|Community 91]]
- [[_COMMUNITY_Community 92|Community 92]]
- [[_COMMUNITY_Community 93|Community 93]]
- [[_COMMUNITY_Community 94|Community 94]]
- [[_COMMUNITY_Community 95|Community 95]]
- [[_COMMUNITY_Community 96|Community 96]]
- [[_COMMUNITY_Community 97|Community 97]]
- [[_COMMUNITY_Community 98|Community 98]]
- [[_COMMUNITY_Community 99|Community 99]]
- [[_COMMUNITY_Community 100|Community 100]]
- [[_COMMUNITY_Community 101|Community 101]]

## God Nodes (most connected - your core abstractions)
1. `DbState` - 24 edges
2. `AppDb` - 20 edges
3. `SavedConnection` - 17 edges
4. `compilerOptions` - 17 edges
5. `PostgresDriver` - 16 edges
6. `SqliteDriver` - 16 edges
7. `TableInfo` - 14 edges
8. `ColumnInfo` - 11 edges
9. `definitions` - 10 edges
10. `definitions` - 10 edges

## Surprising Connections (you probably didn't know these)
- `connect_to_db()` --calls--> `create_driver()`  [INFERRED]
  src-tauri/src/commands/db.rs → src-tauri/src/db/driver.rs
- `test_connection()` --calls--> `create_driver()`  [INFERRED]
  src-tauri/src/commands/db.rs → src-tauri/src/db/driver.rs
- `connect_saved()` --calls--> `create_driver()`  [INFERRED]
  src-tauri/src/commands/db.rs → src-tauri/src/db/driver.rs
- `switch_database()` --calls--> `create_driver()`  [INFERRED]
  src-tauri/src/commands/db.rs → src-tauri/src/db/driver.rs
- `NavTable` --references--> `TableInfo`  [EXTRACTED]
  src/App.tsx → src/types/db.ts

## Import Cycles
- 5-file cycle: `src/App.tsx -> src/components/Layout.tsx -> src/components/Sidebar.tsx -> src/components/SidebarParts/index.ts -> src/components/SidebarParts/DatabaseCategories.tsx -> src/App.tsx`

## Communities (97 total, 29 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.04
Nodes (45): file:src-tauri/src/commands/db.rs@src-tauri/src/commands/db.rs, file:src-tauri/src/commands/mod.rs@src-tauri/src/commands/mod.rs, file:src-tauri/src/commands/persistence.rs@src-tauri/src/commands/persistence.rs, file:src-tauri/src/commands/system_status.rs@src-tauri/src/commands/system_status.rs, file:src-tauri/src/commands/workspace.rs@src-tauri/src/commands/workspace.rs, function:apply_changes@src-tauri/src/commands/db.rs, function:check_system_status@src-tauri/src/commands/system_status.rs, function:connect_saved@src-tauri/src/commands/db.rs (+37 more)

### Community 1 - "Community 1"
Cohesion: 0.05
Nodes (37): dependencies, @dnd-kit/core, @dnd-kit/sortable, @dnd-kit/utilities, lucide-react, @monaco-editor/react, react, react-dom (+29 more)

### Community 2 - "Community 2"
Cohesion: 0.12
Nodes (18): ChangeRow, build_where_pg(), is_select(), parse_explain_node(), pg_bind_json(), pg_cast_suffix(), pg_value_to_json(), PostgresDriver (+10 more)

### Community 3 - "Community 3"
Cohesion: 0.18
Nodes (11): get_next_script_number(), export_script_dialog(), Entry, Error, Result, AppDb, InternalScript, keyring_entry() (+3 more)

### Community 4 - "Community 4"
Cohesion: 0.19
Nodes (25): apply_changes(), apply_schema_changes(), connect_saved(), connect_to_db(), DbState, disconnect(), drop_table(), explain_query() (+17 more)

### Community 5 - "Community 5"
Cohesion: 0.15
Nodes (18): DataGridContext, DataGridContextValue, useDataGridContext(), FilterPopover, GridBody, GridRow, GridRowProps, GridFooter (+10 more)

### Community 7 - "Community 7"
Cohesion: 0.09
Nodes (33): ContextMenu(), ContextMenuItem, ContextMenuProps, LayoutProps, Sidebar(), SidebarProps, ContextMenuState, useContextMenu() (+25 more)

### Community 8 - "Community 8"
Cohesion: 0.15
Nodes (23): AppHandle, delete_connection(), get_data_path(), get_saved_connections(), load_ui_state(), save_connection(), save_ui_state(), UiState (+15 more)

### Community 9 - "Community 9"
Cohesion: 0.09
Nodes (22): file:src-tauri/src/db/driver.rs@src-tauri/src/db/driver.rs, function:apply_changes@src-tauri/src/db/driver.rs, function:create_driver@src-tauri/src/db/driver.rs, function:driver_name@src-tauri/src/db/driver.rs, function:execute_query@src-tauri/src/db/driver.rs, function:fetch_page@src-tauri/src/db/driver.rs, function:from@src-tauri/src/db/driver.rs, function:get_table_relations@src-tauri/src/db/driver.rs (+14 more)

### Community 10 - "Community 10"
Cohesion: 0.14
Nodes (14): CommandAction, CommandPalette(), CommandPaletteProps, ITEM_CATEGORY, ITEM_ICON, PaletteItem, recentPaletteIds, BuilderRow (+6 more)

### Community 11 - "Community 11"
Cohesion: 0.10
Nodes (19): compilerOptions, allowImportingTsExtensions, forceConsistentCasingInFileNames, isolatedModules, jsx, lib, module, moduleResolution (+11 more)

### Community 12 - "Community 12"
Cohesion: 0.21
Nodes (8): ICON_MAP, Tab(), TabData, TabPayload, TabProps, TabType, TabBar(), TabBarProps

### Community 13 - "Community 13"
Cohesion: 0.05
Nodes (45): ConnectionManager(), ConnectionManagerProps, DangerConfirmDialog(), Props, ENGINE_COLORS, HomeView(), HomeViewProps, KeyboardCheatSheet() (+37 more)

### Community 14 - "Community 14"
Cohesion: 0.30
Nodes (16): Path, build_graph(), Edge, main(), Node, node_id(), parse_css_file(), parse_rust_file() (+8 more)

### Community 15 - "Community 15"
Cohesion: 0.11
Nodes (18): app, security, windows, withGlobalTauri, build, beforeBuildCommand, beforeDevCommand, devUrl (+10 more)

### Community 16 - "Community 16"
Cohesion: 0.17
Nodes (11): ColumnInfo, get_query_history(), ExplainNode, ExplainPlan, SqliteDriver, Option, QueryHistoryEntry, SchemaChange (+3 more)

### Community 17 - "Community 17"
Cohesion: 0.11
Nodes (18): file:src-tauri/src/storage/mod.rs@src-tauri/src/storage/mod.rs, function:delete_connection@src-tauri/src/storage/mod.rs, function:delete_script_internal@src-tauri/src/storage/mod.rs, function:get_connection_by_id@src-tauri/src/storage/mod.rs, function:get_connections@src-tauri/src/storage/mod.rs, function:get_password_for@src-tauri/src/storage/mod.rs, function:get_scripts_internal@src-tauri/src/storage/mod.rs, function:init@src-tauri/src/storage/mod.rs (+10 more)

### Community 18 - "Community 18"
Cohesion: 0.11
Nodes (18): file:src/types/db.ts@src/types/db.ts, interface:ColumnInfo@src/types/db.ts, interface:ConnectionInfo@src/types/db.ts, interface:DbConfig@src/types/db.ts, interface:GridFilter@src/types/db.ts, interface:InternalScript@src/types/db.ts, interface:PagedResult@src/types/db.ts, interface:PendingChange@src/types/db.ts (+10 more)

### Community 19 - "Community 19"
Cohesion: 0.29
Nodes (7): fetch_table_data(), build_where_sqlite(), is_select(), sqlite_value_to_json(), GridFilter, PagedResult, SqliteRow

### Community 20 - "Community 20"
Cohesion: 0.12
Nodes (17): file:src-tauri/src/db/postgres.rs@src-tauri/src/db/postgres.rs, function:apply_changes@src-tauri/src/db/postgres.rs, function:build_where_pg@src-tauri/src/db/postgres.rs, function:driver_name@src-tauri/src/db/postgres.rs, function:execute_query@src-tauri/src/db/postgres.rs, function:fetch_page@src-tauri/src/db/postgres.rs, function:from_config@src-tauri/src/db/postgres.rs, function:get_table_relations@src-tauri/src/db/postgres.rs (+9 more)

### Community 21 - "Community 21"
Cohesion: 0.13
Nodes (17): file:src/App.tsx@src/App.tsx, file:src/components/ConnectionManager.tsx@src/components/ConnectionManager.tsx, file:src/components/HomeView.tsx@src/components/HomeView.tsx, file:src/components/PasswordPrompt.tsx@src/components/PasswordPrompt.tsx, file:src/hooks/useSavedConnections.ts@src/hooks/useSavedConnections.ts, file:src/main.tsx@src/main.tsx, function:App@src/App.tsx, function:ConnectionManager@src/components/ConnectionManager.tsx (+9 more)

### Community 22 - "Community 22"
Cohesion: 0.12
Nodes (16): file:src-tauri/src/db/sqlite.rs@src-tauri/src/db/sqlite.rs, function:apply_changes@src-tauri/src/db/sqlite.rs, function:build_where_sqlite@src-tauri/src/db/sqlite.rs, function:connect@src-tauri/src/db/sqlite.rs, function:driver_name@src-tauri/src/db/sqlite.rs, function:execute_query@src-tauri/src/db/sqlite.rs, function:fetch_page@src-tauri/src/db/sqlite.rs, function:get_table_relations@src-tauri/src/db/sqlite.rs (+8 more)

### Community 23 - "Community 23"
Cohesion: 0.18
Nodes (9): DataGrid, SqlEditor(), SqlEditorProps, SQL_FUNCTIONS, SQL_KEYWORDS, useSqlEditor(), UseSqlEditorOptions, ExplainPlan (+1 more)

### Community 24 - "Community 24"
Cohesion: 0.13
Nodes (15): file:src/components/DataGrid.tsx@src/components/DataGrid.tsx, file:src/components/SqlEditor.tsx@src/components/SqlEditor.tsx, function:DataGrid@src/components/DataGrid.tsx, function:SqlEditor@src/components/SqlEditor.tsx, function:buildRangeSet@src/components/DataGrid.tsx, function:cell@src/components/DataGrid.tsx, function:cellId@src/components/DataGrid.tsx, function:defineDibThemes@src/components/SqlEditor.tsx (+7 more)

### Community 25 - "Community 25"
Cohesion: 0.15
Nodes (13): definitions, Identifier, Number, PermissionEntry, Target, description, oneOf, anyOf (+5 more)

### Community 26 - "Community 26"
Cohesion: 0.13
Nodes (15): definitions, Identifier, Number, PermissionEntry, Target, Value, oneOf, anyOf (+7 more)

### Community 27 - "Community 27"
Cohesion: 0.16
Nodes (12): CommitFooter(), CommitFooterProps, DataGridProps, EmptyWorkspaceState(), Shortcut, SHORTCUTS, TableTabState, UseDataGridStateOptions (+4 more)

### Community 28 - "Community 28"
Cohesion: 0.14
Nodes (14): file:src/components/ContextMenu.tsx@src/components/ContextMenu.tsx, file:src/components/Sidebar.tsx@src/components/Sidebar.tsx, file:src/hooks/useContextMenu.ts@src/hooks/useContextMenu.ts, function:ContextMenu@src/components/ContextMenu.tsx, function:IconEdit@src/components/ContextMenu.tsx, function:IconTrash@src/components/ContextMenu.tsx, function:PostgresIcon@src/components/Sidebar.tsx, function:Sidebar@src/components/Sidebar.tsx (+6 more)

### Community 29 - "Community 29"
Cohesion: 0.15
Nodes (13): file:src/components/CommitFooter.tsx@src/components/CommitFooter.tsx, file:src/components/QueryPanel.tsx@src/components/QueryPanel.tsx, function:CommitFooter@src/components/CommitFooter.tsx, function:QueryPanel@src/components/QueryPanel.tsx, function:colIcon@src/components/QueryPanel.tsx, function:defaultTableTabState@src/components/QueryPanel.tsx, function:fmtErr@src/components/QueryPanel.tsx, function:genSelect@src/components/QueryPanel.tsx (+5 more)

### Community 32 - "Community 32"
Cohesion: 0.17
Nodes (9): QueryPanelProps, nodeTypes, SchemaVisualizer(), SchemaVisualizerProps, engineAccent(), TableNode, TableNodeComponent(), TableNodeData (+1 more)

### Community 33 - "Community 33"
Cohesion: 0.14
Nodes (14): description, properties, required, type, Capability, type, default, description (+6 more)

### Community 34 - "Community 34"
Cohesion: 0.18
Nodes (11): properties, description, type, default, description, type, identifier, local (+3 more)

### Community 36 - "Community 36"
Cohesion: 0.36
Nodes (9): costColor(), countSeqScans(), fmtCost(), fmtMs(), NodeCard(), NodeCardProps, VisualExplain(), VisualExplainProps (+1 more)

### Community 37 - "Community 37"
Cohesion: 0.20
Nodes (10): file:src/components/Tab.tsx@src/components/Tab.tsx, file:src/components/TabBar.tsx@src/components/TabBar.tsx, function:SortableTab@src/components/TabBar.tsx, function:Tab@src/components/Tab.tsx, function:TabBar@src/components/TabBar.tsx, interface:TabBarProps@src/components/TabBar.tsx, interface:TabData@src/components/Tab.tsx, interface:TabPayload@src/components/Tab.tsx (+2 more)

### Community 38 - "Community 38"
Cohesion: 0.20
Nodes (10): $ref, description, items, type, uniqueItems, description, items, type (+2 more)

### Community 39 - "Community 39"
Cohesion: 0.20
Nodes (10): type, webviews, windows, items, description, items, type, description (+2 more)

### Community 40 - "Community 40"
Cohesion: 0.20
Nodes (10): $ref, description, items, type, uniqueItems, description, items, type (+2 more)

### Community 41 - "Community 41"
Cohesion: 0.20
Nodes (10): type, webviews, windows, items, description, items, type, description (+2 more)

### Community 42 - "Community 42"
Cohesion: 0.67
Nodes (3): Value, anyOf, description

### Community 44 - "Community 44"
Cohesion: 0.22
Nodes (9): constant:TableNode@src/components/TableNode.tsx, file:src/components/SchemaVisualizer.tsx@src/components/SchemaVisualizer.tsx, file:src/components/TableNode.tsx@src/components/TableNode.tsx, function:FullSchemaView@src/components/SchemaVisualizer.tsx, function:RelationView@src/components/SchemaVisualizer.tsx, function:SchemaVisualizer@src/components/SchemaVisualizer.tsx, function:TableNodeComponent@src/components/TableNode.tsx, interface:SchemaVisualizerProps@src/components/SchemaVisualizer.tsx (+1 more)

### Community 45 - "Community 45"
Cohesion: 0.22
Nodes (9): file:src/components/Layout.tsx@src/components/Layout.tsx, file:src/components/SettingsPanel.tsx@src/components/SettingsPanel.tsx, file:src/hooks/useUiState.ts@src/hooks/useUiState.ts, function:Layout@src/components/Layout.tsx, function:SettingsPanel@src/components/SettingsPanel.tsx, function:useUiState@src/hooks/useUiState.ts, interface:LayoutProps@src/components/Layout.tsx, interface:SettingsPanelProps@src/components/SettingsPanel.tsx (+1 more)

### Community 46 - "Community 46"
Cohesion: 0.25
Nodes (8): description, properties, required, type, CapabilityRemote, urls, description, type

### Community 47 - "Community 47"
Cohesion: 0.25
Nodes (8): description, properties, required, type, CapabilityRemote, urls, description, type

### Community 48 - "Community 48"
Cohesion: 0.25
Nodes (7): compilerOptions, allowSyntheticDefaultImports, composite, module, moduleResolution, skipLibCheck, include

### Community 49 - "Community 49"
Cohesion: 0.13
Nodes (18): Box, ColumnInfo, ConnectionInfo, ConnectionStatus, create_driver(), DatabaseDriver, DbConfig, GridFilter (+10 more)

### Community 50 - "Community 50"
Cohesion: 0.29
Nodes (7): file:src/hooks/useKeybindings.ts@src/hooks/useKeybindings.ts, function:_initListener@src/hooks/useKeybindings.ts, function:_isMonaco@src/hooks/useKeybindings.ts, function:_isPlainInput@src/hooks/useKeybindings.ts, function:_key@src/hooks/useKeybindings.ts, function:useKeybindings@src/hooks/useKeybindings.ts, interface:ShortcutDef@src/hooks/useKeybindings.ts

### Community 51 - "Community 51"
Cohesion: 0.15
Nodes (9): QueryHistoryPanelProps, ConnectionStatus, PendingChangeType, QueryError, QueryHistoryEntry, SchemaChange, SchemaChangeKind, ScriptInfo (+1 more)

### Community 52 - "Community 52"
Cohesion: 0.33
Nodes (5): DIB Architecture Rules, File Structure, Rule 1: Dumb Frontend, Smart Backend, Rule 2: UI No Punitiva, Rule 3: Centralization

### Community 53 - "Community 53"
Cohesion: 0.33
Nodes (6): file:src/components/CommandPalette.tsx@src/components/CommandPalette.tsx, function:CommandPalette@src/components/CommandPalette.tsx, function:extractSql@src/components/CommandPalette.tsx, function:fuzzy@src/components/CommandPalette.tsx, interface:CommandAction@src/components/CommandPalette.tsx, interface:CommandPaletteProps@src/components/CommandPalette.tsx

### Community 55 - "Community 55"
Cohesion: 0.40
Nodes (5): file:src-tauri/src/lib.rs@src-tauri/src/lib.rs, function:run@src-tauri/src/lib.rs, module:commands@src-tauri/src/lib.rs, module:db@src-tauri/src/lib.rs, module:storage@src-tauri/src/lib.rs

### Community 56 - "Community 56"
Cohesion: 0.40
Nodes (4): anyOf, description, $schema, title

### Community 57 - "Community 57"
Cohesion: 0.40
Nodes (4): anyOf, description, $schema, title

### Community 58 - "Community 58"
Cohesion: 0.50
Nodes (4): file:src-tauri/src/db/mod.rs@src-tauri/src/db/mod.rs, module:driver@src-tauri/src/db/mod.rs, module:postgres@src-tauri/src/db/mod.rs, module:sqlite@src-tauri/src/db/mod.rs

### Community 59 - "Community 59"
Cohesion: 0.50
Nodes (4): file:src/components/EmptyWorkspaceState.tsx@src/components/EmptyWorkspaceState.tsx, function:EmptyWorkspaceState@src/components/EmptyWorkspaceState.tsx, function:Keys@src/components/EmptyWorkspaceState.tsx, interface:Shortcut@src/components/EmptyWorkspaceState.tsx

### Community 60 - "Community 60"
Cohesion: 0.67
Nodes (3): ShellScopeEntryAllowedArg, anyOf, description

### Community 61 - "Community 61"
Cohesion: 0.50
Nodes (4): default, description, type, description

### Community 62 - "Community 62"
Cohesion: 0.50
Nodes (4): description, required, type, Capability

### Community 63 - "Community 63"
Cohesion: 0.50
Nodes (4): default, description, type, description

### Community 65 - "Community 65"
Cohesion: 0.67
Nodes (3): file:src/components/StatusBlock.tsx@src/components/StatusBlock.tsx, function:StatusBlock@src/components/StatusBlock.tsx, interface:SystemStatus@src/components/StatusBlock.tsx

### Community 68 - "Community 68"
Cohesion: 0.67
Nodes (3): ShellScopeEntryAllowedArg, anyOf, description

### Community 69 - "Community 69"
Cohesion: 0.67
Nodes (3): ShellScopeEntryAllowedArgs, anyOf, description

### Community 70 - "Community 70"
Cohesion: 0.67
Nodes (3): ShellScopeEntryAllowedArgs, anyOf, description

## Knowledge Gaps
- **226 isolated node(s):** `$schema`, `plugin`, `@opencode-ai/plugin`, `name`, `private` (+221 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **29 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `definitions` connect `Community 25` to `Community 33`, `Community 68`, `Community 69`, `Community 42`, `Community 46`, `Community 56`?**
  _High betweenness centrality (0.004) - this node is a cross-community bridge._
- **Why does `definitions` connect `Community 26` to `Community 70`, `Community 47`, `Community 57`, `Community 60`, `Community 62`?**
  _High betweenness centrality (0.004) - this node is a cross-community bridge._
- **Why does `properties` connect `Community 33` to `Community 61`, `Community 38`, `Community 39`?**
  _High betweenness centrality (0.003) - this node is a cross-community bridge._
- **What connects `$schema`, `plugin`, `@opencode-ai/plugin` to the rest of the system?**
  _227 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.044444444444444446 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.05263157894736842 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.1225071225071225 - nodes in this community are weakly interconnected._