# Knowledge Graph Report — DIB

**Generated:** `generate-knowledge-graph.py`

---

## Summary

| Metric | Count |
|--------|-------|
| Total nodes | 274 |
| Total edges | 379 |
| Files | 57 |
| Classes | 0 |
| Functions | 129 |
| React Components | 0 |
| Interfaces / Types | 47 |
| Rust Structs | 20 |
| Rust Traits | 1 |
| Rust Impl Blocks | 9 |
| Rust Modules | 10 |
| Tauri Commands | 24 |

## Files by Language

- **TypeScript/TSX:** 25 files
- **Rust:** 12 files
- **CSS:** 20 files

---

## TypeScript Files

### `src/App.tsx`
- Defines: function `App`, interface `ActiveConn`, interface `NavTable`, interface `OpenScript`
- Imports: `src/components/Layout.tsx`, `src/components/ConnectionManager.tsx`, `src/components/QueryPanel.tsx`, `src/components/CommandPalette.tsx`, `src/components/PasswordPrompt.tsx`, `src/components/HomeView.tsx`, `src/components/SettingsPanel.tsx`, `src/hooks/useSavedConnections.ts`, `src/hooks/useUiState.ts`, `src/hooks/useKeybindings.ts`

### `src/components/CommandPalette.tsx`
- Defines: function `fuzzy`, function `extractSql`, function `CommandPalette`, interface `CommandAction`, interface `CommandPaletteProps`
- Imports: 

### `src/components/CommitFooter.tsx`
- Defines: function `CommitFooter`, interface `CommitFooterProps`
- Imports: 

### `src/components/ConnectionManager.tsx`
- Defines: function `ConnectionManager`, interface `ConnectionManagerProps`
- Imports: `src/hooks/useSavedConnections.ts`

### `src/components/ContextMenu.tsx`
- Defines: function `ContextMenu`, function `IconEdit`, function `IconTrash`, interface `ContextMenuItem`, interface `ContextMenuProps`
- Imports: 

### `src/components/DataGrid.tsx`
- Defines: function `operatorsForType`, function `cell`, function `makeKey`, function `cellId`, function `buildRangeSet`, function `makeEditState`, function `DataGrid`, interface `DataGridProps`
- Imports: 

### `src/components/EmptyWorkspaceState.tsx`
- Defines: function `Keys`, function `EmptyWorkspaceState`, interface `Shortcut`
- Imports: 

### `src/components/HomeView.tsx`
- Defines: function `HomeView`, interface `HomeViewProps`
- Imports: `src/hooks/useSavedConnections.ts`

### `src/components/Layout.tsx`
- Defines: function `Layout`, interface `LayoutProps`
- Imports: `src/hooks/useUiState.ts`, `src/hooks/useKeybindings.ts`, `src/components/Sidebar.tsx`

### `src/components/PasswordPrompt.tsx`
- Defines: function `PasswordPrompt`, interface `PasswordPromptProps`
- Imports: 

### `src/components/QueryPanel.tsx`
- Defines: function `fmtErr`, function `colIcon`, function `genSelect`, function `genUpdate`, function `defaultTableTabState`, function `tableTabId`, function `QueryPanel`, interface `TableTabState`, interface `QueryPanelProps`
- Imports: `src/hooks/useKeybindings.ts`, `src/components/DataGrid.tsx`, `src/components/CommitFooter.tsx`, `src/components/TabBar.tsx`, `src/components/SqlEditor.tsx`, `src/components/SchemaVisualizer.tsx`, `src/components/EmptyWorkspaceState.tsx`, `src/components/ContextMenu.tsx`, `src/hooks/useContextMenu.ts`

### `src/components/SchemaVisualizer.tsx`
- Defines: function `FullSchemaView`, function `RelationView`, function `SchemaVisualizer`, interface `SchemaVisualizerProps`
- Imports: `src/components/TableNode.tsx`

### `src/components/SettingsPanel.tsx`
- Defines: function `SettingsPanel`, interface `SettingsPanelProps`
- Imports: `src/hooks/useUiState.ts`

### `src/components/Sidebar.tsx`
- Defines: function `PostgresIcon`, function `SqliteIcon`, function `Sidebar`, interface `SidebarProps`
- Imports: `src/hooks/useSavedConnections.ts`, `src/hooks/useContextMenu.ts`, `src/components/ContextMenu.tsx`

### `src/components/SqlEditor.tsx`
- Defines: function `fmtErr`, function `defineDibThemes`, function `getSystemTheme`, function `SqlEditor`, interface `SqlEditorProps`
- Imports: `src/components/DataGrid.tsx`

### `src/components/StatusBlock.tsx`
- Defines: function `StatusBlock`, interface `SystemStatus`
- Imports: 

### `src/components/Tab.tsx`
- Defines: function `Tab`, interface `TabPayload`, interface `TabData`, interface `TabProps`, interface `TabType`
- Imports: 

### `src/components/TabBar.tsx`
- Defines: function `SortableTab`, function `TabBar`, interface `TabBarProps`
- Imports: `src/components/Tab.tsx`

### `src/components/TableNode.tsx`
- Defines: function `TableNodeComponent`, interface `TableNodeData`, constant `TableNode`
- Imports: 

### `src/hooks/useContextMenu.ts`
- Defines: function `useContextMenu`, interface `ContextMenuState`
- Imports: 

### `src/hooks/useKeybindings.ts`
- Defines: function `_key`, function `_isMonaco`, function `_isPlainInput`, function `_initListener`, function `useKeybindings`, interface `ShortcutDef`
- Imports: 

### `src/hooks/useSavedConnections.ts`
- Defines: function `useSavedConnections`
- Imports: 

### `src/hooks/useUiState.ts`
- Defines: function `useUiState`, interface `UiState`
- Imports: 

### `src/main.tsx`
- Imports: `src/App.tsx`

### `src/types/db.ts`
- Defines: interface `DbConfig`, interface `ConnectionInfo`, interface `QueryError`, interface `TableInfo`, interface `ColumnInfo`, interface `QueryResult`, interface `PagedResult`, interface `SavedConnection`, interface `GridFilter`, interface `TableRelation`, interface `PendingChange`, interface `InternalScript`, interface `ScriptInfo`, interface `ScriptMeta`, interface `ConnectionStatus`, interface `FilterOperator`, interface `PendingChangeType`

## Rust Files

### `src-tauri/src/commands/db.rs`
- Defines: struct `DbState`, impl `DbState`, function `new`, function `connect_to_db`, function `fetch_tables`, function `fetch_table_schema`, function `run_query`, function `apply_changes`, function `test_connection`, function `connect_saved`, function `disconnect`, function `fetch_table_relations`, function `fetch_table_data`
- Uses: 

### `src-tauri/src/commands/mod.rs`
- Defines: module `db`, module `persistence`, module `system_status`, module `workspace`

### `src-tauri/src/commands/persistence.rs`
- Defines: struct `UiState`, function `default_true`, function `default_sidebar_width`, function `get_data_path`, function `save_connection`, function `get_saved_connections`, function `delete_connection`, function `save_ui_state`, function `load_ui_state`
- Uses: 

### `src-tauri/src/commands/system_status.rs`
- Defines: struct `SystemStatus`, function `check_system_status`
- Uses: 

### `src-tauri/src/commands/workspace.rs`
- Defines: struct `ScriptMeta`, struct `ImportedScript`, function `workspace_path`, function `safe_filename`, function `save_script`, function `list_scripts`, function `read_script`, function `export_script_dialog`, function `save_internal_script`, function `get_internal_scripts`, function `delete_internal_script`, function `import_script_dialog`
- Uses: 

### `src-tauri/src/db/driver.rs`
- Defines: struct `DbConfig`, struct `ConnectionInfo`, struct `QueryError`, struct `TableInfo`, struct `QueryResult`, struct `ColumnInfo`, struct `ChangeRow`, struct `GridFilter`, struct `TableRelation`, struct `PagedResult`, trait `DatabaseDriver`, impl `From for QueryError`, function `from`, function `get_tables`, function `get_table_schema`, function `execute_query`, function `apply_changes`, function `fetch_page`, function `get_table_relations`, function `driver_name`, function `create_driver`
- Uses: 

### `src-tauri/src/db/mod.rs`
- Defines: module `driver`, module `postgres`, module `sqlite`
- Uses: 

### `src-tauri/src/db/postgres.rs`
- Defines: struct `PostgresDriver`, impl `DatabaseDriver for PostgresDriver`, impl `PostgresDriver`, function `build_where_pg`, function `pg_bind_json`, function `from_config`, function `is_select`, function `pg_value_to_json`, function `qualified`, function `get_tables`, function `get_table_schema`, function `execute_query`, function `fetch_page`, function `apply_changes`, function `get_table_relations`, function `driver_name`
- Uses: 

### `src-tauri/src/db/sqlite.rs`
- Defines: struct `SqliteDriver`, impl `DatabaseDriver for SqliteDriver`, impl `SqliteDriver`, function `build_where_sqlite`, function `sqlite_bind_json`, function `connect`, function `is_select`, function `sqlite_value_to_json`, function `get_tables`, function `get_table_schema`, function `execute_query`, function `apply_changes`, function `fetch_page`, function `get_table_relations`, function `driver_name`
- Uses: 

### `src-tauri/src/lib.rs`
- Defines: module `commands`, module `db`, module `storage`, function `run`
- Uses: 

### `src-tauri/src/main.rs`
- Defines: function `main`

### `src-tauri/src/storage/mod.rs`
- Defines: struct `InternalScript`, struct `AppDb`, struct `SavedConnection`, impl `Send for AppDb`, impl `Sync for AppDb`, impl `AppDb`, function `keyring_entry`, function `init`, function `save_connection`, function `get_connections`, function `get_connection_by_id`, function `get_password_for`, function `upsert_password_for`, function `delete_connection`, function `save_script_internal`, function `get_scripts_internal`, function `delete_script_internal`
- Uses: 

## Tauri IPC Commands

- `apply_changes` (src-tauri/src/commands/db.rs:86)
- `check_system_status` (src-tauri/src/commands/system_status.rs:16)
- `connect_saved` (src-tauri/src/commands/db.rs:119)
- `connect_to_db` (src-tauri/src/commands/db.rs:24)
- `delete_connection` (src-tauri/src/commands/persistence.rs:45)
- `delete_internal_script` (src-tauri/src/commands/workspace.rs:160)
- `disconnect` (src-tauri/src/commands/db.rs:204)
- `export_script_dialog` (src-tauri/src/commands/workspace.rs:116)
- `fetch_table_data` (src-tauri/src/commands/db.rs:227)
- `fetch_table_relations` (src-tauri/src/commands/db.rs:211)
- `fetch_table_schema` (src-tauri/src/commands/db.rs:55)
- `fetch_tables` (src-tauri/src/commands/db.rs:42)
- `get_internal_scripts` (src-tauri/src/commands/workspace.rs:154)
- `get_saved_connections` (src-tauri/src/commands/persistence.rs:39)
- `import_script_dialog` (src-tauri/src/commands/workspace.rs:168)
- `list_scripts` (src-tauri/src/commands/workspace.rs:67)
- `load_ui_state` (src-tauri/src/commands/persistence.rs:59)
- `read_script` (src-tauri/src/commands/workspace.rs:101)
- `run_query` (src-tauri/src/commands/db.rs:73)
- `save_connection` (src-tauri/src/commands/persistence.rs:30)
- `save_internal_script` (src-tauri/src/commands/workspace.rs:143)
- `save_script` (src-tauri/src/commands/workspace.rs:38)
- `save_ui_state` (src-tauri/src/commands/persistence.rs:51)
- `test_connection` (src-tauri/src/commands/db.rs:107)

---

## File Dependency Graph (imports)

```
  src/App.tsx --> src/components/Layout.tsx
  src/App.tsx --> src/components/ConnectionManager.tsx
  src/App.tsx --> src/components/QueryPanel.tsx
  src/App.tsx --> src/components/CommandPalette.tsx
  src/App.tsx --> src/components/PasswordPrompt.tsx
  src/App.tsx --> src/components/HomeView.tsx
  src/App.tsx --> src/components/SettingsPanel.tsx
  src/App.tsx --> src/hooks/useSavedConnections.ts
  src/App.tsx --> src/hooks/useUiState.ts
  src/App.tsx --> src/hooks/useKeybindings.ts
  src/components/ConnectionManager.tsx --> src/hooks/useSavedConnections.ts
  src/components/HomeView.tsx --> src/hooks/useSavedConnections.ts
  src/components/Layout.tsx --> src/hooks/useUiState.ts
  src/components/Layout.tsx --> src/hooks/useKeybindings.ts
  src/components/Layout.tsx --> src/components/Sidebar.tsx
  src/components/QueryPanel.tsx --> src/hooks/useKeybindings.ts
  src/components/QueryPanel.tsx --> src/components/DataGrid.tsx
  src/components/QueryPanel.tsx --> src/components/CommitFooter.tsx
  src/components/QueryPanel.tsx --> src/components/TabBar.tsx
  src/components/QueryPanel.tsx --> src/components/SqlEditor.tsx
  src/components/QueryPanel.tsx --> src/components/SchemaVisualizer.tsx
  src/components/QueryPanel.tsx --> src/components/EmptyWorkspaceState.tsx
  src/components/QueryPanel.tsx --> src/components/ContextMenu.tsx
  src/components/QueryPanel.tsx --> src/hooks/useContextMenu.ts
  src/components/SchemaVisualizer.tsx --> src/components/TableNode.tsx
  src/components/SettingsPanel.tsx --> src/hooks/useUiState.ts
  src/components/Sidebar.tsx --> src/hooks/useSavedConnections.ts
  src/components/Sidebar.tsx --> src/hooks/useContextMenu.ts
  src/components/Sidebar.tsx --> src/components/ContextMenu.tsx
  src/components/SqlEditor.tsx --> src/components/DataGrid.tsx
  src/components/TabBar.tsx --> src/components/Tab.tsx
  src/main.tsx --> src/App.tsx
```
