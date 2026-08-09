# Graph Report - dib  (2026-08-09)

## Corpus Check
- 182 files · ~164,921 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 2803 nodes · 6340 edges · 191 communities (140 shown, 51 thin omitted)
- Extraction: 91% EXTRACTED · 9% INFERRED · 0% AMBIGUOUS · INFERRED: 546 edges (avg confidence: 0.53)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `f6576d8e`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Community 0
- Community 1
- Community 2
- Community 3
- Community 4
- Community 5
- Community 6
- Community 7
- x0
- Community 9
- Community 10
- Community 11
- Community 12
- g0
- Community 14
- Community 15
- Community 16
- Community 17
- Community 18
- Community 19
- Community 20
- Community 21
- Community 22
- Community 23
- Community 24
- Bb
- ne
- Community 27
- Community 28
- Community 29
- Community 30
- Community 31
- Community 32
- Xt
- Community 34
- Community 35
- Ac
- Community 37
- Community 38
- Community 39
- Community 40
- Community 41
- Community 42
- Community 43
- Community 44
- Community 45
- Community 46
- Community 47
- Community 48
- Community 49
- Community 50
- Community 51
- Community 52
- Community 53
- Community 54
- Community 55
- Community 56
- TableActionsMenu.tsx
- Community 58
- useKeybindings.ts
- Community 60
- Community 61
- Community 62
- DbActionDialog.tsx
- Community 64
- Community 65
- Community 66
- Community 67
- Community 68
- Community 69
- Community 70
- Community 71
- Community 72
- Community 73
- Community 74
- Community 75
- Community 76
- Community 78
- Community 79
- Community 81
- Community 82
- Community 83
- Community 84
- Community 85
- Community 86
- Community 87
- Community 88
- Community 89
- Community 90
- Community 91
- Community 92
- Community 93
- Community 94
- Community 95
- Community 96
- Community 97
- Community 98
- Community 99
- Community 100
- Community 101
- Community 102
- Community 103
- Community 104
- Community 105
- Community 106
- JsonPanel.tsx
- Community 108
- Community 109
- Community 110
- Community 111
- Community 112
- Community 113
- EmptyWorkspaceState.tsx
- Community 115
- Community 116
- r
- file:src/components/EmptyWorkspaceState.tsx@src/components/EmptyWorkspaceState.tsx
- Community 119
- Capability
- local
- useTreeKeyboardNav
- SettingsPanel.tsx
- useWorkspaceStore
- vc
- WorkspaceTree.tsx
- file:src/components/Layout.tsx@src/components/Layout.tsx
- SchemaChangeWizard.tsx
- Da
- z3
- Zo
- fv
- db.rs
- Ka
- Sa
- Dc
- U0
- Bo
- Sy
- qg
- Ri
- jk
- file:src/components/EmptyWorkspaceState.tsx@src/components/EmptyWorkspaceState.tsx
- Capability
- Capability
- la
- p2
- rj
- eS
- fE
- fj
- Hl
- j1
- lM
- mj
- useKeybindings.ts
- tp
- generate_mock_data
- fw
- ShellScopeEntryAllowedArgs
- Capability
- zw
- Target
- globals
- lucide-react
- ii
- file:src/components/EmptyWorkspaceState.tsx@src/components/EmptyWorkspaceState.tsx
- m3
- rm
- ma
- typescript
- @vitejs/plugin-react
- la
- Target
- o3
- w0
- lM
- gb
- rm
- dd
- tp

## God Nodes (most connected - your core abstractions)
1. `r()` - 126 edges
2. `n()` - 124 edges
3. `t()` - 123 edges
4. `s()` - 103 edges
5. `x0()` - 93 edges
6. `ae()` - 86 edges
7. `QueryError` - 77 edges
8. `ne()` - 48 edges
9. `useWorkspaceStore` - 46 edges
10. `DbState` - 45 edges

## Surprising Connections (you probably didn't know these)
- `useDataGridState()` --indirect_call--> `r()`  [INFERRED]
  src/features/DataGrid/DataGrid.hooks.ts → dist-root-owned/assets/index-sGUI_7J-.js
- `QueryPanel()` --indirect_call--> `r()`  [INFERRED]
  src/features/QueryPanel/QueryPanel.tsx → dist-root-owned/assets/index-sGUI_7J-.js
- `safeInvoke()` --indirect_call--> `r()`  [INFERRED]
  src/shared/utils/ipc.ts → dist-root-owned/assets/index-sGUI_7J-.js
- `t()` --indirect_call--> `k()`  [INFERRED]
  dist-root-owned/assets/index-sGUI_7J-.js → src/features/QueryPanel/EmptyWorkspaceState.tsx
- `CommandPalette()` --indirect_call--> `t()`  [INFERRED]
  src/features/CommandPalette/CommandPalette.tsx → dist-root-owned/assets/index-sGUI_7J-.js

## Import Cycles
- None detected.

## Communities (191 total, 51 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.04
Nodes (45): file:src-tauri/src/commands/db.rs@src-tauri/src/commands/db.rs, file:src-tauri/src/commands/mod.rs@src-tauri/src/commands/mod.rs, file:src-tauri/src/commands/persistence.rs@src-tauri/src/commands/persistence.rs, file:src-tauri/src/commands/system_status.rs@src-tauri/src/commands/system_status.rs, file:src-tauri/src/commands/workspace.rs@src-tauri/src/commands/workspace.rs, function:apply_changes@src-tauri/src/commands/db.rs, function:check_system_status@src-tauri/src/commands/system_status.rs, function:connect_saved@src-tauri/src/commands/db.rs (+37 more)

### Community 1 - "Community 1"
Cohesion: 0.07
Nodes (27): @dnd-kit/core, @dnd-kit/sortable, @dnd-kit/utilities, lucide-react, monaco-editor, @monaco-editor/react, dependencies, @dnd-kit/core (+19 more)

### Community 2 - "Community 2"
Cohesion: 0.16
Nodes (21): ExplainNode, PgArguments, PgPool, PgRow, build_where_pg(), decode_fk_action(), execute_query_inner(), execute_query_no_tx() (+13 more)

### Community 3 - "Community 3"
Cohesion: 0.11
Nodes (20): Connection, Error, Mutex, AppDb, InternalScript, QueryHistoryEntry, AppHandle, Option (+12 more)

### Community 4 - "Community 4"
Cohesion: 0.17
Nodes (31): Box, ConnectionInfo, DashMap, RwLock, assert_connection_in_active_workspace(), connect_db_lazily(), connect_saved(), connect_to_db() (+23 more)

### Community 5 - "Community 5"
Cohesion: 0.02
Nodes (62): $0, A0, ak, Al, b3, bk, bx, ck (+54 more)

### Community 6 - "Community 6"
Cohesion: 0.08
Nodes (28): SqliteArguments, SqlitePool, SqliteRow, build_where_sqlite(), is_select(), ColumnInfo, CreateColumn, DbTreeNode (+20 more)

### Community 7 - "Community 7"
Cohesion: 0.05
Nodes (90): a_(), Aa(), ag(), ai, Ar, aT(), b(), B2() (+82 more)

### Community 8 - "x0"
Cohesion: 0.05
Nodes (4): ae(), nC, wC, x0()

### Community 9 - "Community 9"
Cohesion: 0.09
Nodes (22): file:src-tauri/src/db/driver.rs@src-tauri/src/db/driver.rs, function:apply_changes@src-tauri/src/db/driver.rs, function:create_driver@src-tauri/src/db/driver.rs, function:driver_name@src-tauri/src/db/driver.rs, function:execute_query@src-tauri/src/db/driver.rs, function:fetch_page@src-tauri/src/db/driver.rs, function:from@src-tauri/src/db/driver.rs, function:get_table_relations@src-tauri/src/db/driver.rs (+14 more)

### Community 10 - "Community 10"
Cohesion: 0.11
Nodes (23): AtomicI32, From, pg_cast_suffix(), PostgresDriver, qualified(), Arc, ColumnInfo, CreateColumn (+15 more)

### Community 11 - "Community 11"
Cohesion: 0.05
Nodes (41): DOM, DOM.Iterable, ES2020, src, src/components/*, src/constants/*, src/features/*, src/hooks/* (+33 more)

### Community 12 - "Community 12"
Cohesion: 0.12
Nodes (8): AdapterEntry, FileSystemState, FsEntityMeta, FsMode, ScriptEntry, ScriptFsAdapter, useFileSystemStore, VirtualScript

### Community 13 - "g0"
Cohesion: 0.17
Nodes (12): ConnectionManager(), ConnectionManagerProps, parseConnectionUrl(), FlatCheckbox, FlatCheckboxProps, FlatInput, FlatInputProps, FlatSelect (+4 more)

### Community 14 - "Community 14"
Cohesion: 0.26
Nodes (17): IMPORTANT: keep the reminder string free of backticks and $(...) constructs., Path, build_graph(), Edge, main(), Node, node_id(), parse_css_file() (+9 more)

### Community 15 - "Community 15"
Cohesion: 0.07
Nodes (26): https://github.com/CoffeJeanCode/DiB/releases/latest/download/latest.json, icons/icon.ico, icons/icon.png, app, security, windows, withGlobalTauri, build (+18 more)

### Community 16 - "Community 16"
Cohesion: 0.15
Nodes (32): ChangeRow, ColumnInfo, ColumnMetadata, ConnectionInfo, ConnectionStatus, CreateColumn, DbConfig, DbTreeNode (+24 more)

### Community 17 - "Community 17"
Cohesion: 0.11
Nodes (18): file:src-tauri/src/storage/mod.rs@src-tauri/src/storage/mod.rs, function:delete_connection@src-tauri/src/storage/mod.rs, function:delete_script_internal@src-tauri/src/storage/mod.rs, function:get_connection_by_id@src-tauri/src/storage/mod.rs, function:get_connections@src-tauri/src/storage/mod.rs, function:get_password_for@src-tauri/src/storage/mod.rs, function:get_scripts_internal@src-tauri/src/storage/mod.rs, function:init@src-tauri/src/storage/mod.rs (+10 more)

### Community 18 - "Community 18"
Cohesion: 0.11
Nodes (18): file:src/types/db.ts@src/types/db.ts, interface:ColumnInfo@src/types/db.ts, interface:ConnectionInfo@src/types/db.ts, interface:DbConfig@src/types/db.ts, interface:GridFilter@src/types/db.ts, interface:InternalScript@src/types/db.ts, interface:PagedResult@src/types/db.ts, interface:PendingChange@src/types/db.ts (+10 more)

### Community 19 - "Community 19"
Cohesion: 0.16
Nodes (20): EntityBrowserProps, ConnectionItem(), ConnectionItemProps, ConnectionStatusDot(), ConnectionStatusDotProps, STATUS_CLASS, DatabaseCategories(), DatabaseSelector() (+12 more)

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
Cohesion: 0.08
Nodes (33): ColumnList, ColumnListProps, childNodeType(), ColumnsContent(), CONFIG_FOLDERS, ConnectionTreeRoot(), DatabaseNode(), DatabaseTree() (+25 more)

### Community 24 - "Community 24"
Cohesion: 0.13
Nodes (15): file:src/components/DataGrid.tsx@src/components/DataGrid.tsx, file:src/components/SqlEditor.tsx@src/components/SqlEditor.tsx, function:DataGrid@src/components/DataGrid.tsx, function:SqlEditor@src/components/SqlEditor.tsx, function:buildRangeSet@src/components/DataGrid.tsx, function:cell@src/components/DataGrid.tsx, function:cellId@src/components/DataGrid.tsx, function:defineDibThemes@src/components/SqlEditor.tsx (+7 more)

### Community 25 - "Bb"
Cohesion: 0.07
Nodes (35): Ab(), bf(), cp(), cS(), db(), dn(), El(), ey() (+27 more)

### Community 26 - "ne"
Cohesion: 0.07
Nodes (29): Always Do (No Exceptions), Ask First (Requires Human Approval), Broken Access Control, Broken Authentication, Common Rationalizations, Cross-Site Scripting (XSS), File Upload Safety, Injection (SQL, NoSQL, OS Command) (+21 more)

### Community 27 - "Community 27"
Cohesion: 0.10
Nodes (22): CommandAction, CommandPalette(), CommandPaletteProps, DbObjectSubtype, DDL_MODE_META, DdlMode, generateOrmAlias(), getPaletteItemHint() (+14 more)

### Community 28 - "Community 28"
Cohesion: 0.14
Nodes (14): file:src/components/ContextMenu.tsx@src/components/ContextMenu.tsx, file:src/components/Sidebar.tsx@src/components/Sidebar.tsx, file:src/hooks/useContextMenu.ts@src/hooks/useContextMenu.ts, function:ContextMenu@src/components/ContextMenu.tsx, function:IconEdit@src/components/ContextMenu.tsx, function:IconTrash@src/components/ContextMenu.tsx, function:PostgresIcon@src/components/Sidebar.tsx, function:Sidebar@src/components/Sidebar.tsx (+6 more)

### Community 29 - "Community 29"
Cohesion: 0.15
Nodes (13): file:src/components/CommitFooter.tsx@src/components/CommitFooter.tsx, file:src/components/QueryPanel.tsx@src/components/QueryPanel.tsx, function:CommitFooter@src/components/CommitFooter.tsx, function:QueryPanel@src/components/QueryPanel.tsx, function:colIcon@src/components/QueryPanel.tsx, function:defaultTableTabState@src/components/QueryPanel.tsx, function:fmtErr@src/components/QueryPanel.tsx, function:genSelect@src/components/QueryPanel.tsx (+5 more)

### Community 30 - "Community 30"
Cohesion: 0.11
Nodes (19): DataGrid, Props, MonacoEditor(), MonacoEditorProps, SqlEditor(), SqlEditorProps, VisualExplain, defineDibThemes() (+11 more)

### Community 31 - "Community 31"
Cohesion: 0.06
Nodes (71): DEFAULT_COL_W_EXPORT, DataGridProps, EditState, makeEditState(), Snapshot, useDataGridState(), ARROW_KEYS, CellCoord (+63 more)

### Community 32 - "Community 32"
Cohesion: 0.12
Nodes (16): definitions, Number, PermissionEntry, ShellScopeEntryAllowedArg, ShellScopeEntryAllowedArgs, Value, anyOf, description (+8 more)

### Community 33 - "Xt"
Cohesion: 0.09
Nodes (15): aN(), cN(), dv, ev(), ff(), If(), Kp(), Mi() (+7 more)

### Community 34 - "Community 34"
Cohesion: 0.13
Nodes (15): properties, default, description, type, type, array, null, description (+7 more)

### Community 35 - "Community 35"
Cohesion: 0.15
Nodes (13): properties, Identifier, default, description, type, description, oneOf, type (+5 more)

### Community 36 - "Ac"
Cohesion: 0.18
Nodes (11): co(), Fa(), Hg(), _i(), I1(), jh(), Nh(), qg() (+3 more)

### Community 37 - "Community 37"
Cohesion: 0.20
Nodes (10): file:src/components/Tab.tsx@src/components/Tab.tsx, file:src/components/TabBar.tsx@src/components/TabBar.tsx, function:SortableTab@src/components/TabBar.tsx, function:Tab@src/components/Tab.tsx, function:TabBar@src/components/TabBar.tsx, interface:TabBarProps@src/components/TabBar.tsx, interface:TabData@src/components/Tab.tsx, interface:TabPayload@src/components/Tab.tsx (+2 more)

### Community 38 - "Community 38"
Cohesion: 0.22
Nodes (9): file:src/components/Layout.tsx@src/components/Layout.tsx, file:src/components/SettingsPanel.tsx@src/components/SettingsPanel.tsx, file:src/hooks/useUiState.ts@src/hooks/useUiState.ts, function:Layout@src/components/Layout.tsx, function:SettingsPanel@src/components/SettingsPanel.tsx, function:useUiState@src/hooks/useUiState.ts, interface:LayoutProps@src/components/Layout.tsx, interface:SettingsPanelProps@src/components/SettingsPanel.tsx (+1 more)

### Community 39 - "Community 39"
Cohesion: 0.12
Nodes (16): definitions, Number, PermissionEntry, ShellScopeEntryAllowedArg, ShellScopeEntryAllowedArgs, Value, anyOf, description (+8 more)

### Community 40 - "Community 40"
Cohesion: 0.12
Nodes (16): definitions, Number, PermissionEntry, ShellScopeEntryAllowedArg, ShellScopeEntryAllowedArgs, Value, anyOf, description (+8 more)

### Community 41 - "Community 41"
Cohesion: 0.07
Nodes (45): CommitFooter(), CommitFooterProps, PageSizeSelect(), PageSizeSelectProps, SIZES, defaultTableTabState(), fmtErr(), MockGenerator (+37 more)

### Community 42 - "Community 42"
Cohesion: 0.05
Nodes (44): Action, ACTION_LABEL, ACTION_TITLE, DbActionDialog(), DbActionDialogProps, GlobalModals(), GlobalModalsProps, reopenPaletteOnDismiss() (+36 more)

### Community 43 - "Community 43"
Cohesion: 0.13
Nodes (15): properties, default, description, type, type, array, null, description (+7 more)

### Community 44 - "Community 44"
Cohesion: 0.22
Nodes (9): constant:TableNode@src/components/TableNode.tsx, file:src/components/SchemaVisualizer.tsx@src/components/SchemaVisualizer.tsx, file:src/components/TableNode.tsx@src/components/TableNode.tsx, function:FullSchemaView@src/components/SchemaVisualizer.tsx, function:RelationView@src/components/SchemaVisualizer.tsx, function:SchemaVisualizer@src/components/SchemaVisualizer.tsx, function:TableNodeComponent@src/components/TableNode.tsx, interface:SchemaVisualizerProps@src/components/SchemaVisualizer.tsx (+1 more)

### Community 45 - "Community 45"
Cohesion: 0.29
Nodes (7): $ref, description, items, type, uniqueItems, items, permissions

### Community 46 - "Community 46"
Cohesion: 0.20
Nodes (10): type, webviews, windows, items, description, items, type, description (+2 more)

### Community 47 - "Community 47"
Cohesion: 0.17
Nodes (12): $ref, array, null, description, items, type, uniqueItems, description (+4 more)

### Community 48 - "Community 48"
Cohesion: 0.22
Nodes (8): vite.config.ts, compilerOptions, allowSyntheticDefaultImports, composite, module, moduleResolution, skipLibCheck, include

### Community 49 - "Community 49"
Cohesion: 0.20
Nodes (10): type, webviews, windows, items, description, items, type, description (+2 more)

### Community 50 - "Community 50"
Cohesion: 0.29
Nodes (7): file:src/hooks/useKeybindings.ts@src/hooks/useKeybindings.ts, function:_initListener@src/hooks/useKeybindings.ts, function:_isMonaco@src/hooks/useKeybindings.ts, function:_isPlainInput@src/hooks/useKeybindings.ts, function:_key@src/hooks/useKeybindings.ts, function:useKeybindings@src/hooks/useKeybindings.ts, interface:ShortcutDef@src/hooks/useKeybindings.ts

### Community 51 - "Community 51"
Cohesion: 0.29
Nodes (7): $ref, description, items, type, uniqueItems, items, permissions

### Community 52 - "Community 52"
Cohesion: 0.33
Nodes (5): DIB Architecture Rules, File Structure, Rule 1: Dumb Frontend, Smart Backend, Rule 2: UI No Punitiva, Rule 3: Centralization

### Community 53 - "Community 53"
Cohesion: 0.33
Nodes (6): file:src/components/CommandPalette.tsx@src/components/CommandPalette.tsx, function:CommandPalette@src/components/CommandPalette.tsx, function:extractSql@src/components/CommandPalette.tsx, function:fuzzy@src/components/CommandPalette.tsx, interface:CommandAction@src/components/CommandPalette.tsx, interface:CommandPaletteProps@src/components/CommandPalette.tsx

### Community 54 - "Community 54"
Cohesion: 0.20
Nodes (10): type, webviews, windows, items, description, items, type, description (+2 more)

### Community 55 - "Community 55"
Cohesion: 0.40
Nodes (5): file:src-tauri/src/lib.rs@src-tauri/src/lib.rs, function:run@src-tauri/src/lib.rs, module:commands@src-tauri/src/lib.rs, module:db@src-tauri/src/lib.rs, module:storage@src-tauri/src/lib.rs

### Community 56 - "Community 56"
Cohesion: 0.06
Nodes (49): CATEGORIES, CatKey, fmtErr(), SYSTEM_SCHEMAS, useDatabaseCategoriesLogic(), DatabaseCategoriesProps, DatabaseCategoryItem, DatabaseCategoryItemProps (+41 more)

### Community 57 - "TableActionsMenu.tsx"
Cohesion: 0.07
Nodes (27): eslint, @eslint/js, eslint-plugin-react-hooks, eslint-plugin-react-refresh, glob, devDependencies, eslint, @eslint/js (+19 more)

### Community 58 - "Community 58"
Cohesion: 0.50
Nodes (4): file:src-tauri/src/db/mod.rs@src-tauri/src/db/mod.rs, module:driver@src-tauri/src/db/mod.rs, module:postgres@src-tauri/src/db/mod.rs, module:sqlite@src-tauri/src/db/mod.rs

### Community 59 - "useKeybindings.ts"
Cohesion: 0.08
Nodes (23): Accessibility (WCAG 2.1 AA), ARIA Labels, Avoid the AI Aesthetic, Color, Common Rationalizations, Component Architecture, Component Patterns, Design System Adherence (+15 more)

### Community 60 - "Community 60"
Cohesion: 0.22
Nodes (9): description, properties, required, type, CapabilityRemote, urls, urls, description (+1 more)

### Community 61 - "Community 61"
Cohesion: 0.22
Nodes (9): description, properties, required, type, CapabilityRemote, urls, urls, description (+1 more)

### Community 62 - "Community 62"
Cohesion: 0.22
Nodes (9): description, properties, required, type, CapabilityRemote, urls, urls, description (+1 more)

### Community 63 - "DbActionDialog.tsx"
Cohesion: 0.09
Nodes (23): bm(), d_(), Da(), e3(), eg(), Fc(), Gf(), Hp() (+15 more)

### Community 64 - "Community 64"
Cohesion: 0.14
Nodes (54): InternalScript, QueryHistoryEntry, create_file(), create_folder(), create_fs_folder(), create_workspace(), delete_fs_item(), delete_internal_script() (+46 more)

### Community 65 - "Community 65"
Cohesion: 0.67
Nodes (3): file:src/components/StatusBlock.tsx@src/components/StatusBlock.tsx, function:StatusBlock@src/components/StatusBlock.tsx, interface:SystemStatus@src/components/StatusBlock.tsx

### Community 66 - "Community 66"
Cohesion: 0.50
Nodes (3): plugin, $schema, .opencode/plugins/graphify.js

### Community 67 - "Community 67"
Cohesion: 0.09
Nodes (22): Anti-Patterns, Common Rationalizations, Confusion Management, Context Engineering, Context Packing Strategies, Level 1: Rules Files, Level 2: Specs and Architecture, Level 3: Relevant Source Files (+14 more)

### Community 68 - "Community 68"
Cohesion: 0.14
Nodes (13): Architecture, Build without Compose, Dev (with GUI via WSLg/X11), DIB — Data Illustrative Base, Docker, Docker Build, License, Local Build (+5 more)

### Community 69 - "Community 69"
Cohesion: 0.05
Nodes (74): ap(), aS(), Ay(), Bb(), bE(), bh(), bp(), Bs() (+66 more)

### Community 70 - "Community 70"
Cohesion: 0.11
Nodes (17): core:default, core:window:allow-close, core:window:allow-minimize, core:window:allow-start-dragging, core:window:allow-toggle-maximize, core:window:default, dialog:allow-open, dialog:default (+9 more)

### Community 71 - "Community 71"
Cohesion: 0.40
Nodes (4): anyOf, description, $schema, title

### Community 76 - "Community 76"
Cohesion: 0.40
Nodes (4): anyOf, description, $schema, title

### Community 78 - "Community 78"
Cohesion: 0.40
Nodes (4): anyOf, description, $schema, title

### Community 79 - "Community 79"
Cohesion: 0.60
Nodes (4): check_system_status(), Result, String, SystemStatus

### Community 101 - "Community 101"
Cohesion: 0.15
Nodes (12): 1. GESTIÓN DE CONEXIONES Y SERVIDOR, 2. NAVEGACIÓN Y WORKSPACE, 3. MOTOR DE EJECUCIÓN (SQL EDITOR), 4. EXPLORACIÓN Y VISUALIZACIÓN DE DATOS, 5.1 Comandos huérfanos (declarados en Rust, no consumidos por UI), 5.2 Funcionalidad incompleta en SQLite, 5.3 Problemas arquitectónicos (activos), 5.4 Funcionalidad no cubierta por UI (+4 more)

### Community 102 - "Community 102"
Cohesion: 0.29
Nodes (11): costColor(), countSeqScans(), ExplainFlowNode(), ExplainNodeData, fmtCost(), fmtMs(), layoutExplainTree(), nodeTypes (+3 more)

### Community 103 - "Community 103"
Cohesion: 0.14
Nodes (13): ContextMenuContentProps, ContextMenuItemProps, ContextMenuLabelProps, ContextMenuProps, ContextMenuSeparatorProps, ContextMenuSubContentProps, ContextMenuSubProps, ContextMenuSubTriggerProps (+5 more)

### Community 104 - "Community 104"
Cohesion: 0.19
Nodes (16): apply_changes(), cancel_query(), explain_query(), fetch_table_data(), AppHandle, ExplainPlan, GridFilter, Option (+8 more)

### Community 105 - "Community 105"
Cohesion: 0.12
Nodes (15): Key Assumptions to Validate, MVP Scope, Not Doing (and Why), Open Questions, Plan B (si falla el supuesto del gesto), Problem Statement, Recommended Direction, Relational Breadcrumbs (+7 more)

### Community 106 - "Community 106"
Cohesion: 0.67
Nodes (3): Identifier, description, oneOf

### Community 107 - "JsonPanel.tsx"
Cohesion: 0.09
Nodes (28): _2(), ah(), bA(), Ch(), dR(), e2(), eR(), eu() (+20 more)

### Community 108 - "Community 108"
Cohesion: 0.14
Nodes (14): FAKER_TYPES, Props, Dropzone(), DropzoneProps, EXTENSIONS, formatOf(), ImportFormat, ImportResult (+6 more)

### Community 109 - "Community 109"
Cohesion: 0.70
Nodes (4): die(), info(), run(), build-release.sh script

### Community 110 - "Community 110"
Cohesion: 0.18
Nodes (10): Auditoría Competitiva y Gap Analysis — DIB v0.1.0, Critical Gaps (Deuda de Producto), Gap 1: SSH Tunneling — CRÍTICO (Sprint 1), Gap 2: Exportación de Datos (CSV/JSON/Excel) — CRÍTICO (Sprint 1), Matriz de Funcionalidades, Resumen Estratégico, Unique Selling Propositions (USPs), USP 1: Arquitectura Tauri (Rust nativo) + Virtual Scrolling (+2 more)

### Community 111 - "Community 111"
Cohesion: 0.27
Nodes (19): fetch_db_node_children(), fetch_schema_objects(), fetch_table_relations(), fetch_table_schema(), fetch_table_schemas(), get_node_children(), get_table_structure(), invalidate_node_cache() (+11 more)

### Community 112 - "Community 112"
Cohesion: 0.33
Nodes (6): a2(), c2(), i2(), im(), No(), om()

### Community 113 - "Community 113"
Cohesion: 0.67
Nodes (3): Target, description, oneOf

### Community 115 - "Community 115"
Cohesion: 0.20
Nodes (10): scripts, build, dev, export, export:win, format, lint, preview (+2 more)

### Community 116 - "Community 116"
Cohesion: 0.08
Nodes (38): a1(), Ac(), af(), Au(), By(), Cl(), cy(), d1() (+30 more)

### Community 117 - "r"
Cohesion: 0.09
Nodes (22): Common Rationalizations, Core Web Vitals Targets, Large Bundle Size, Log every attempt, including the reverted ones, Missing Caching (Backend), Missing Image Optimization (Frontend), N+1 Queries (Backend), Overview (+14 more)

### Community 118 - "file:src/components/EmptyWorkspaceState.tsx@src/components/EmptyWorkspaceState.tsx"
Cohesion: 0.33
Nodes (6): description, required, type, Capability, identifier, permissions

### Community 119 - "Community 119"
Cohesion: 0.07
Nodes (41): bg(), bN(), bu(), c1(), Ci(), d0(), e0(), ed() (+33 more)

### Community 124 - "Capability"
Cohesion: 0.09
Nodes (21): Build Failure Triage, Common Rationalizations, Debugging and Error Recovery, Error-Specific Patterns, Instrumentation Guidelines, Overview, Red Flags, Runtime Error Triage (+13 more)

### Community 126 - "useTreeKeyboardNav"
Cohesion: 0.14
Nodes (15): bw(), clamp(), fl(), formatHsl(), gj(), jv(), mm(), pm() (+7 more)

### Community 127 - "SettingsPanel.tsx"
Cohesion: 0.40
Nodes (4): name, private, type, version

### Community 128 - "useWorkspaceStore"
Cohesion: 0.25
Nodes (14): SavedConnection, delete_connection(), get_data_path(), get_saved_connections(), load_ui_state(), AppHandle, Option, PathBuf (+6 more)

### Community 129 - "vc"
Cohesion: 0.29
Nodes (7): Ad(), Bi(), Kx(), vc(), xl(), Xx(), yC()

### Community 130 - "WorkspaceTree.tsx"
Cohesion: 0.08
Nodes (53): App(), MainContent(), Props, DDL_TEMPLATE, ENGINE_COLORS, HomeView(), HomeViewProps, JsonPanel() (+45 more)

### Community 131 - "file:src/components/Layout.tsx@src/components/Layout.tsx"
Cohesion: 0.09
Nodes (22): CC(), Cg(), cv(), e_(), em, ex(), gk, i3() (+14 more)

### Community 132 - "SchemaChangeWizard.tsx"
Cohesion: 0.50
Nodes (4): default, description, type, local

### Community 133 - "Da"
Cohesion: 0.36
Nodes (15): apply_schema_changes(), create_table(), drop_table(), generate_crud_sql(), get_function_ddl(), get_trigger_ddl(), get_view_ddl(), CreateColumn (+7 more)

### Community 134 - "z3"
Cohesion: 0.18
Nodes (13): $3(), A3(), Gx(), j3, lw(), mx(), nx(), sg() (+5 more)

### Community 135 - "Zo"
Cohesion: 0.20
Nodes (4): bR(), copy(), rp(), Zo()

### Community 136 - "fv"
Cohesion: 0.08
Nodes (32): Layout(), LayoutProps, Panel, PANELS, appWindow, Titlebar(), LAYOUT_OPTIONS, SettingsPanel() (+24 more)

### Community 137 - "db.rs"
Cohesion: 0.25
Nodes (8): displayable(), dm(), fm(), rgb(), uv, wj(), xj(), yj()

### Community 139 - "Sa"
Cohesion: 0.16
Nodes (14): Dc(), Dl, Fs(), Gr, Jo(), Ka(), Nl(), Oc() (+6 more)

### Community 140 - "Dc"
Cohesion: 0.17
Nodes (11): Key Assumptions to Validate, MVP Scope (Quick Wins), Not Doing (and Why), Open Questions, Por qué esta y no otra, Problem Statement, QW1: Arreglar `(empty)` falso, QW2: Compartir `ColumnList` entre modos (+3 more)

### Community 141 - "U0"
Cohesion: 0.50
Nodes (4): default, description, type, local

### Community 143 - "Sy"
Cohesion: 0.33
Nodes (6): description, required, type, Capability, identifier, permissions

### Community 144 - "qg"
Cohesion: 0.15
Nodes (7): ScriptsContextMenu(), ScriptsContextMenuProps, getFileIcon(), TreeItem(), TreeItemProps, WorkspaceTree, WorkspaceTreeProps

### Community 145 - "Ri"
Cohesion: 0.09
Nodes (30): b0(), ef(), Fh(), Fr(), g0(), gb(), Gl(), ha() (+22 more)

### Community 147 - "file:src/components/EmptyWorkspaceState.tsx@src/components/EmptyWorkspaceState.tsx"
Cohesion: 0.16
Nodes (14): av(), D2(), eN(), _f, iv(), l2(), ln(), lv() (+6 more)

### Community 148 - "Capability"
Cohesion: 0.50
Nodes (4): default, description, type, local

### Community 151 - "p2"
Cohesion: 0.67
Nodes (3): h2(), m2(), p2()

### Community 152 - "rj"
Cohesion: 0.67
Nodes (3): rj(), tj(), zv()

### Community 161 - "lM"
Cohesion: 0.12
Nodes (12): am(), du(), eC(), f3(), hE(), n(), qM(), rR() (+4 more)

### Community 163 - "useKeybindings.ts"
Cohesion: 0.13
Nodes (16): aw(), ax(), bT(), Cd(), iE(), j_(), nw(), q_() (+8 more)

### Community 168 - "generate_mock_data"
Cohesion: 0.39
Nodes (8): ColumnMapping, fake_value(), generate_mock_data(), MockResult, Result, State, String, Vec

### Community 170 - "ShellScopeEntryAllowedArgs"
Cohesion: 0.67
Nodes (3): Identifier, description, oneOf

### Community 171 - "Capability"
Cohesion: 0.33
Nodes (6): description, required, type, Capability, identifier, permissions

### Community 172 - "zw"
Cohesion: 0.50
Nodes (4): cb(), Hh(), Sy(), v1()

### Community 175 - "Target"
Cohesion: 0.67
Nodes (3): Target, description, oneOf

### Community 178 - "lucide-react"
Cohesion: 0.17
Nodes (13): f1(), hb(), Hi(), Ig(), Lg(), Ll, Mf(), pb() (+5 more)

### Community 181 - "m3"
Cohesion: 0.40
Nodes (5): dg(), jf(), jp, wa, zS

### Community 182 - "rm"
Cohesion: 0.50
Nodes (4): file:src/components/EmptyWorkspaceState.tsx@src/components/EmptyWorkspaceState.tsx, function:EmptyWorkspaceState@src/components/EmptyWorkspaceState.tsx, function:Keys@src/components/EmptyWorkspaceState.tsx, interface:Shortcut@src/components/EmptyWorkspaceState.tsx

### Community 187 - "la"
Cohesion: 0.67
Nodes (3): cA, fu(), la()

### Community 188 - "Target"
Cohesion: 0.67
Nodes (3): Target, description, oneOf

### Community 198 - "rm"
Cohesion: 0.11
Nodes (20): bv(), cR(), ew(), fN(), fv(), [gn](), hn, jM() (+12 more)

## Knowledge Gaps
- **620 isolated node(s):** `$schema`, `.opencode/plugins/graphify.js`, `gS`, `yS`, `kS` (+615 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **51 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `r()` connect `useKeybindings.ts` to `vc`, `file:src/components/Layout.tsx@src/components/Layout.tsx`, `Community 5`, `z3`, `Community 7`, `Zo`, `Sa`, `Ri`, `file:src/components/EmptyWorkspaceState.tsx@src/components/EmptyWorkspaceState.tsx`, `Bb`, `Community 31`, `lM`, `Xt`, `Ac`, `.constructor`, `Community 41`, `lucide-react`, `m3`, `Community 56`, `o3`, `DbActionDialog.tsx`, `Community 69`, `rm`, `tp`, `JsonPanel.tsx`, `Community 112`, `Community 116`, `Community 119`, `useTreeKeyboardNav`?**
  _High betweenness centrality (0.051) - this node is a cross-community bridge._
- **Why does `t()` connect `file:src/components/Layout.tsx@src/components/Layout.tsx` to `vc`, `Community 5`, `z3`, `Community 7`, `x0`, `db.rs`, `Zo`, `Sa`, `Ri`, `file:src/components/EmptyWorkspaceState.tsx@src/components/EmptyWorkspaceState.tsx`, `Bb`, `Community 27`, `Community 30`, `lM`, `Xt`, `useKeybindings.ts`, `Ac`, `Community 41`, `lucide-react`, `m3`, `Community 56`, `DbActionDialog.tsx`, `Community 69`, `rm`, `tp`, `JsonPanel.tsx`, `Community 108`, `Community 112`, `Community 116`, `Community 119`, `useTreeKeyboardNav`?**
  _High betweenness centrality (0.028) - this node is a cross-community bridge._
- **Why does `safeInvoke()` connect `Community 56` to `WorkspaceTree.tsx`, `useKeybindings.ts`, `fv`, `Community 41`, `Community 42`, `Community 108`, `g0`, `Community 12`, `Community 19`, `Community 23`, `Community 31`?**
  _High betweenness centrality (0.026) - this node is a cross-community bridge._
- **Are the 82 inferred relationships involving `r()` (e.g. with `Ac()` and `am()`) actually correct?**
  _`r()` has 82 INFERRED edges - model-reasoned connections that need verification._
- **Are the 76 inferred relationships involving `n()` (e.g. with `Ac()` and `am()`) actually correct?**
  _`n()` has 76 INFERRED edges - model-reasoned connections that need verification._
- **Are the 64 inferred relationships involving `t()` (e.g. with `av()` and `c1()`) actually correct?**
  _`t()` has 64 INFERRED edges - model-reasoned connections that need verification._
- **Are the 71 inferred relationships involving `s()` (e.g. with `_2()` and `Aa()`) actually correct?**
  _`s()` has 71 INFERRED edges - model-reasoned connections that need verification._