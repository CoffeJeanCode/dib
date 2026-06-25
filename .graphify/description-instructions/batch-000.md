# Node Description Batch 1 of 9

Graphify is running in assistant/skill mode (no API key). You are the host
assistant (Claude Code / Codex / Gemini CLI). Read the prompt below and write
your JSON answer to the answer file.

## Prompt

You are documenting nodes in a knowledge graph.
For each entry below, write ONE concise factual plain-language sentence
describing what it is or does. Use only the provided context.
For a code symbol (kind=code-symbol — a function, class, or constant),
describe what the function/symbol does based on its name, source location
and neighbors — e.g. "Resolves the configured ontology profile from graphify.yaml.".
For an entity node (any other kind — e.g. a person, place, event, object),
describe what the entity is and its role, grounded in its type, its
relations (neighbors) and the provided citations/evidence — e.g.
"Lady Carfax, a wealthy heiress who disappears en route to Lausanne.".
Ground entity descriptions in the citations/evidence when present; do not
speculate beyond the context, so a node with no supporting context may be
left out of the reply.
Write every description in English (en). Do not switch languages.
No marketing language.
Respond ONLY with a JSON object mapping each node id (as a string) to its
one-sentence description — no prose, no markdown fences.

- "types_db": "db.ts" | kind=code-symbol | source=src/types/db.ts:L1 | neighbors=[2562ffd Add knowledge graph integration…, 2c5407b Refactor DataGrid and SqlEditor…, f7b39e6 Add initial project setup with …, CommandPalette.tsx, CommitFooter.tsx, ConnectionManager.tsx]
- "components_querypanel": "QueryPanel.tsx" | kind=code-symbol | source=src/components/QueryPanel.tsx:L1 | neighbors=[2562ffd Add knowledge graph integration…, 2c5407b Refactor DataGrid and SqlEditor…, da9e33b Enhance sidebar functionality a…, f7b39e6 Add initial project setup with …, CommitFooter.tsx, CommitFooter()]
- "commit:repo:github.com/CoffeJeanCode/DiB@2562ffd0faf3e5cad3d9e0da0938e8bc57a4191c": "2562ffd Add knowledge graph integration and UI enhancements" | kind=Commit | source=git | neighbors=[main, db.rs, workspace.rs, 2c5407b Refactor DataGrid and SqlEditor…, CommandPalette.tsx, ConnectionManager.tsx]
- "commit:repo:github.com/CoffeJeanCode/DiB@f7b39e695b792381a926475d77d2c47f2f630b07": "f7b39e6 Add initial project setup with TypeScript, React, and Tauri" | kind=Commit | source=git | neighbors=[main, db.rs, mod.rs, persistence.rs, system_status.rs, workspace.rs]
- "src_app": "App.tsx" | kind=code-symbol | source=src/App.tsx:L1 | neighbors=[2562ffd Add knowledge graph integration…, 2c5407b Refactor DataGrid and SqlEditor…, f7b39e6 Add initial project setup with …, ConnectionManager.tsx, QueryPanel.tsx, StatusBlock.tsx]
- "sidebarparts_index": "index.ts" | kind=code-symbol | source=src/components/SidebarParts/index.ts:L1 | neighbors=[2562ffd Add knowledge graph integration…, Sidebar.tsx, ConnectionItem.tsx, ConnectionItem(), DatabaseCategories.tsx, DatabaseCategories()]
- "commands_db": "db.rs" | kind=code-symbol | source=src-tauri/src/commands/db.rs:L1 | neighbors=[apply_changes(), apply_schema_changes(), connect_saved(), connect_to_db(), DbState, disconnect()]
- "commit:repo:github.com/CoffeJeanCode/DiB@2c5407be995ffbb39e9d8d6919ea65146c287ba0": "2c5407b Refactor DataGrid and SqlEditor components for improved state managemen…" | kind=Commit | source=git | neighbors=[2562ffd Add knowledge graph integration…, main, db.rs, 863e6a3 Update project references from …, DataGrid.tsx, QueryPanel.tsx]
- "db_driver": "driver.rs" | kind=code-symbol | source=src-tauri/src/db/driver.rs:L1 | neighbors=[2562ffd Add knowledge graph integration…, 2c5407b Refactor DataGrid and SqlEditor…, f7b39e6 Add initial project setup with …, ChangeRow, ColumnInfo, ConnectionInfo]
- "commands_workspace": "workspace.rs" | kind=code-symbol | source=src-tauri/src/commands/workspace.rs:L1 | neighbors=[delete_internal_script(), export_script_dialog(), get_internal_scripts(), get_query_history(), import_script_dialog(), ImportedScript]
- "tools_generate_knowledge_graph": "generate-knowledge-graph.py" | kind=code-symbol | source=tools/generate-knowledge-graph.py:L1 | neighbors=[2562ffd Add knowledge graph integration…, 863e6a3 Update project references from …, build_graph(), Edge, main(), Node]
- "components_schemavisualizer": "SchemaVisualizer.tsx" | kind=code-symbol | source=src/components/SchemaVisualizer.tsx:L1 | neighbors=[2c5407b Refactor DataGrid and SqlEditor…, f7b39e6 Add initial project setup with …, QueryPanel.tsx, FullSchemaView(), nodeTypes, RelationView()]
- "components_sidebar": "Sidebar.tsx" | kind=code-symbol | source=src/components/Sidebar.tsx:L1 | neighbors=[2562ffd Add knowledge graph integration…, da9e33b Enhance sidebar functionality a…, f7b39e6 Add initial project setup with …, Layout.tsx, ContextMenu.tsx, ContextMenu()]
- "components_layout": "Layout.tsx" | kind=code-symbol | source=src/components/Layout.tsx:L1 | neighbors=[2562ffd Add knowledge graph integration…, da9e33b Enhance sidebar functionality a…, f7b39e6 Add initial project setup with …, Layout(), LayoutProps, Sidebar.tsx]
- "components_tab": "Tab.tsx" | kind=code-symbol | source=src/components/Tab.tsx:L1 | neighbors=[2562ffd Add knowledge graph integration…, 2c5407b Refactor DataGrid and SqlEditor…, da9e33b Enhance sidebar functionality a…, f7b39e6 Add initial project setup with …, QueryPanel.tsx, ICON_MAP]
- "hooks_usekeybindings": "useKeybindings.ts" | kind=code-symbol | source=src/hooks/useKeybindings.ts:L1 | neighbors=[2562ffd Add knowledge graph integration…, Layout.tsx, QueryPanel.tsx, TableBuilderGrid.tsx, _BLOCKED, _initListener()]
- "sidebarparts_connectionitem": "ConnectionItem.tsx" | kind=code-symbol | source=src/components/SidebarParts/ConnectionItem.tsx:L1 | neighbors=[2562ffd Add knowledge graph integration…, ConnectionItem(), ConnectionItemProps, DatabaseCategories.tsx, DatabaseCategories(), utils.tsx]
- "sidebarparts_databasecategories": "DatabaseCategories.tsx" | kind=code-symbol | source=src/components/SidebarParts/DatabaseCategories.tsx:L1 | neighbors=[2562ffd Add knowledge graph integration…, 2c5407b Refactor DataGrid and SqlEditor…, ConnectionItem.tsx, CATEGORIES, DatabaseCategories(), DatabaseCategoriesProps]
- "storage_mod_appdb": "AppDb" | kind=code-symbol | source=src-tauri/src/storage/mod.rs:L33 | neighbors=[mod.rs, .delete_connection(), .delete_script_internal(), .get_connection_by_id(), .get_connections(), .get_password_for()]
- "components_commandpalette": "CommandPalette.tsx" | kind=code-symbol | source=src/components/CommandPalette.tsx:L1 | neighbors=[2562ffd Add knowledge graph integration…, f7b39e6 Add initial project setup with …, CommandAction, CommandPalette(), CommandPaletteProps, ITEM_CATEGORY]
- "components_connectionmanager": "ConnectionManager.tsx" | kind=code-symbol | source=src/components/ConnectionManager.tsx:L1 | neighbors=[2562ffd Add knowledge graph integration…, f7b39e6 Add initial project setup with …, ConnectionManager(), ConnectionManagerProps, useSavedConnections.ts, useSavedConnections()]
- "components_tablebuildergrid": "TableBuilderGrid.tsx" | kind=code-symbol | source=src/components/TableBuilderGrid.tsx:L1 | neighbors=[2562ffd Add knowledge graph integration…, BuilderRow, COMMON_TYPES, computeChanges(), fromColumnInfo(), TableBuilderGrid()]
- "db_postgres_postgresdriver": "PostgresDriver" | kind=code-symbol | source=src-tauri/src/db/postgres.rs:L57 | neighbors=[postgres.rs, .apply_changes(), .apply_schema_changes(), .driver_name(), .execute_query(), .fetch_page()]
- "db_sqlite_sqlitedriver": "SqliteDriver" | kind=code-symbol | source=src-tauri/src/db/sqlite.rs:L42 | neighbors=[sqlite.rs, .apply_changes(), .apply_schema_changes(), .connect(), .driver_name(), .execute_query()]
- "sidebarparts_sidebarnav": "SidebarNav.tsx" | kind=code-symbol | source=src/components/SidebarParts/SidebarNav.tsx:L1 | neighbors=[2562ffd Add knowledge graph integration…, index.ts, ConnectionItem.tsx, ConnectionItem(), ScriptItem.tsx, ScriptItem()]
- "commands_persistence": "persistence.rs" | kind=code-symbol | source=src-tauri/src/commands/persistence.rs:L1 | neighbors=[default_sidebar_width(), default_true(), delete_connection(), get_data_path(), get_saved_connections(), load_ui_state()]
- "commit:repo:github.com/CoffeJeanCode/DiB@da9e33bfc65e248c5afdcaa50ae7f14b754344d2": "da9e33b Enhance sidebar functionality and integrate drag-and-drop for tabs" | kind=Commit | source=git | neighbors=[main, persistence.rs, 2562ffd Add knowledge graph integration…, Layout.tsx, QueryPanel.tsx, Sidebar.tsx]
- "components_datagrid": "DataGrid.tsx" | kind=code-symbol | source=src/components/DataGrid.tsx:L1 | neighbors=[2562ffd Add knowledge graph integration…, 2c5407b Refactor DataGrid and SqlEditor…, f7b39e6 Add initial project setup with …, DataGrid, DataGridProps, db.ts]
- "components_sqleditor": "SqlEditor.tsx" | kind=code-symbol | source=src/components/SqlEditor.tsx:L1 | neighbors=[2562ffd Add knowledge graph integration…, 2c5407b Refactor DataGrid and SqlEditor…, da9e33b Enhance sidebar functionality a…, f7b39e6 Add initial project setup with …, QueryPanel.tsx, DataGrid.tsx]
- "db_postgres": "postgres.rs" | kind=code-symbol | source=src-tauri/src/db/postgres.rs:L1 | neighbors=[2562ffd Add knowledge graph integration…, 2c5407b Refactor DataGrid and SqlEditor…, f7b39e6 Add initial project setup with …, build_where_pg(), is_select(), pg_bind_json()]
- "components_homeview": "HomeView.tsx" | kind=code-symbol | source=src/components/HomeView.tsx:L1 | neighbors=[863e6a3 Update project references from …, f7b39e6 Add initial project setup with …, ENGINE_COLORS, HomeView(), HomeViewProps, useSavedConnections.ts]
- "components_tabbar": "TabBar.tsx" | kind=code-symbol | source=src/components/TabBar.tsx:L1 | neighbors=[2562ffd Add knowledge graph integration…, da9e33b Enhance sidebar functionality a…, f7b39e6 Add initial project setup with …, QueryPanel.tsx, Tab.tsx, Tab()]
- "sidebarparts_utils": "utils.tsx" | kind=code-symbol | source=src/components/SidebarParts/utils.tsx:L1 | neighbors=[2562ffd Add knowledge graph integration…, 2c5407b Refactor DataGrid and SqlEditor…, ConnectionItem.tsx, DatabaseSelector.tsx, index.ts, ENGINE_COLORS]
- "types_db_savedconnection": "SavedConnection" | kind=code-symbol | source=src/types/db.ts:L58 | neighbors=[ConnectionManager.tsx, HomeView.tsx, Layout.tsx, Sidebar.tsx, useSavedConnections.ts, ConnectionItem.tsx]
- "sidebarparts_databaseselector": "DatabaseSelector.tsx" | kind=code-symbol | source=src/components/SidebarParts/DatabaseSelector.tsx:L1 | neighbors=[2562ffd Add knowledge graph integration…, DatabaseSelector(), DatabaseSelectorProps, utils.tsx, getDbName(), getEngineIcon()]
- "components_contextmenu": "ContextMenu.tsx" | kind=code-symbol | source=src/components/ContextMenu.tsx:L1 | neighbors=[f7b39e6 Add initial project setup with …, ContextMenu(), ContextMenuItem, ContextMenuProps, IconEdit(), IconTrash()]
- "db_sqlite": "sqlite.rs" | kind=code-symbol | source=src-tauri/src/db/sqlite.rs:L1 | neighbors=[2562ffd Add knowledge graph integration…, 2c5407b Refactor DataGrid and SqlEditor…, f7b39e6 Add initial project setup with …, build_where_sqlite(), is_select(), sqlite_bind_json()]
- "hooks_usesavedconnections": "useSavedConnections.ts" | kind=code-symbol | source=src/hooks/useSavedConnections.ts:L1 | neighbors=[f7b39e6 Add initial project setup with …, ConnectionManager.tsx, HomeView.tsx, Sidebar.tsx, useSavedConnections(), db.ts]
- "hooks_useuistate": "useUiState.ts" | kind=code-symbol | source=src/hooks/useUiState.ts:L1 | neighbors=[da9e33b Enhance sidebar functionality a…, f7b39e6 Add initial project setup with …, Layout.tsx, SettingsPanel.tsx, DEFAULT_STATE, UiState]
- "sidebarparts_scriptitem": "ScriptItem.tsx" | kind=code-symbol | source=src/components/SidebarParts/ScriptItem.tsx:L1 | neighbors=[2562ffd Add knowledge graph integration…, index.ts, getScriptIcon(), ScriptItem(), ScriptItemProps, db.ts]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: C:\tech-grow\tools\dib\.graphify\description-instructions\batch-000.json

Keep each description factual and concise (one sentence). No markdown, no prose
outside the JSON object. It is acceptable to omit a node if context is
insufficient — but include every node you can ground confidently.

Example answer format:
```json
{
  "node_id_1": "Resolves the configured ontology profile from graphify.yaml.",
  "node_id_2": "Colonel James Barclay, an antagonist in The Crooked Man."
}
```
