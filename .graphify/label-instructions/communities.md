# Community Labeling

Graphify is running in assistant/skill mode (no API key). You are the host
assistant (Claude Code / Codex / Gemini CLI). Read the community listing below
and write 2-5 word plain-language names for each.

## Language

Write every name in English (en). Do not switch languages.

## Communities

Community 0: ToastContext, SavedConnection, mod.rs, system_status.rs, check_system_status(, SystemStatus, da9e33b Enhance sidebar functionality and integrate drag-and, f7b39e6 Add initial project setup with TypeScript, React, an, ConnectionManager.tsx, ConnectionManager(, ConnectionManagerProps, ContextMenu.tsx
Community 1: main, 2562ffd Add knowledge graph integration and UI enhancements, 2c5407b Refactor DataGrid and SqlEditor components for impro, 863e6a3 Update project references from "Database Interface B, CommitFooter.tsx, CommitFooter(, CommitFooterProps, DataGrid.tsx, DataGrid, DataGridProps, EmptyWorkspaceState.tsx, EmptyWorkspaceState(
Community 2: TableInfo, CommandPalette.tsx, CommandAction, CommandPalette(, CommandPaletteProps, ITEM_CATEGORY, ITEM_ICON, PaletteItem, QueryHistoryPanel.tsx, fmtMs(, fmtTime(, QueryHistoryPanel(
Community 3: ConnectionItem.tsx, ConnectionItem(, ConnectionItemProps, DatabaseCategories(, DatabaseSelector.tsx, DatabaseSelector(, DatabaseSelectorProps, index.ts, ScriptItem.tsx, getScriptIcon(, ScriptItem(, ScriptItemProps
Community 4: PostgresDriver, postgres.rs, build_where_pg(, is_select(, pg_bind_json(, pg_cast_suffix(, pg_value_to_json(, .apply_changes(, .apply_schema_changes(, .driver_name(, .execute_query(, .fetch_page(
Community 5: db.rs, apply_changes(, apply_schema_changes(, connect_saved(, connect_to_db(, DbState, .new(, disconnect(, fetch_schema_objects(, fetch_table_data(, fetch_table_relations(, fetch_table_schema(
Community 6: AppDb, keyring_entry(, mod.rs, .delete_connection(, .delete_script_internal(, .get_connection_by_id(, .get_connections(, .get_password_for(, .get_query_history_internal(, .get_scripts_internal(, .init(, .save_connection(
Community 7: useKeybindings(, TableBuilderGrid.tsx, BuilderRow, COMMON_TYPES, computeChanges(, fromColumnInfo(, TableBuilderGrid(, TableBuilderGridProps, useKeybindings.ts, _BLOCKED, _initListener(, _isMonaco(
Community 8: driver.rs, ChangeRow, ColumnInfo, ConnectionInfo, ConnectionStatus, create_driver(, DatabaseDriver, DbConfig, GridFilter, PagedResult, QueryError, .from(
Community 9: SqliteDriver, sqlite.rs, build_where_sqlite(, is_select(, sqlite_bind_json(, sqlite_value_to_json(, .apply_changes(, .apply_schema_changes(, .connect(, .driver_name(, .execute_query(, .fetch_page(
Community 10: parse_rust_file(, parse_ts_file(, generate-knowledge-graph.py, build_graph(, Edge, main(, Node, node_id(, parse_css_file(, Add edges for cross-file references where imported names mat, relative(, resolve_cross_refs(
Community 11: workspace.rs, delete_internal_script(, export_script_dialog(, get_internal_scripts(, get_query_history(, import_script_dialog(, ImportedScript, list_scripts(, read_script(, safe_filename(, save_internal_script(, save_query_history(
Community 12: SchemaVisualizer.tsx, FullSchemaView(, nodeTypes, RelationView(, SchemaVisualizer(, SchemaVisualizerProps, TableNode.tsx, ENGINE_ACCENT, TableNode, TableNodeComponent(, TableNodeData, TableRelation
Community 13: persistence.rs, default_sidebar_width(, default_true(, delete_connection(, get_data_path(, get_saved_connections(, load_ui_state(, save_connection(, save_ui_state(, UiState
Community 14: Toast.tsx, ToastContainer(, ToastContainerProps, ToastItem(, useToast.ts, Toast, ToastType, useToast(

## Instructions

Write a single JSON object mapping each community id (as a string) to its
2-5 word name to: C:\tech-grow\tools\dib\.graphify\label-instructions\communities.json

Example:
```json
{
  "0": "Authentication Flow",
  "1": "Authentication Flow",
  "2": "Authentication Flow"
}
```

Then re-run `graphify update` (or `graphify label`) to ingest the names.
