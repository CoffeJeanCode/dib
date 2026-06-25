# Node Description Batch 3 of 9

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
Write every description in English (en). Do not switch languages.
No marketing language.
Respond ONLY with a JSON object mapping each node id (as a string) to its
one-sentence description — no prose, no markdown fences.

- "commands_workspace_save_script": "save_script()" | kind=code-symbol | source=src-tauri/src/commands/workspace.rs:L38 | neighbors=[workspace.rs, safe_filename(), workspace_path()]
- "components_contextmenu_contextmenu": "ContextMenu()" | kind=code-symbol | source=src/components/ContextMenu.tsx:L24 | neighbors=[ContextMenu.tsx, QueryPanel.tsx, Sidebar.tsx]
- "components_datagrid_datagrid": "DataGrid" | kind=code-symbol | source=src/components/DataGrid.tsx:L28 | neighbors=[DataGrid.tsx, QueryPanel.tsx, SqlEditor.tsx]
- "components_tab_tabdata": "TabData" | kind=code-symbol | source=src/components/Tab.tsx:L17 | neighbors=[QueryPanel.tsx, Tab.tsx, TabBar.tsx]
- "db_mod": "mod.rs" | kind=code-symbol | source=src-tauri/src/db/mod.rs:L1 | neighbors=[2562ffd Add knowledge graph integration…, 2c5407b Refactor DataGrid and SqlEditor…, f7b39e6 Add initial project setup with …]
- "db_postgres_build_where_pg": "build_where_pg()" | kind=code-symbol | source=src-tauri/src/db/postgres.rs:L21 | neighbors=[postgres.rs, smart_val(), .fetch_page()]
- "db_postgres_pg_bind_json": "pg_bind_json()" | kind=code-symbol | source=src-tauri/src/db/postgres.rs:L76 | neighbors=[postgres.rs, .apply_changes(), .fetch_page()]
- "db_postgres_pg_value_to_json": "pg_value_to_json()" | kind=code-symbol | source=src-tauri/src/db/postgres.rs:L124 | neighbors=[postgres.rs, .execute_query(), .fetch_page()]
- "db_postgres_postgresdriver_apply_changes": ".apply_changes()" | kind=code-symbol | source=src-tauri/src/db/postgres.rs:L339 | neighbors=[PostgresDriver, pg_bind_json(), pg_cast_suffix()]
- "db_postgres_postgresdriver_execute_query": ".execute_query()" | kind=code-symbol | source=src-tauri/src/db/postgres.rs:L257 | neighbors=[PostgresDriver, is_select(), pg_value_to_json()]
- "db_postgres_qualified": "qualified()" | kind=code-symbol | source=src-tauri/src/db/postgres.rs:L137 | neighbors=[postgres.rs, .apply_schema_changes(), .fetch_page()]
- "db_sqlite_sqlite_value_to_json": "sqlite_value_to_json()" | kind=code-symbol | source=src-tauri/src/db/sqlite.rs:L82 | neighbors=[sqlite.rs, .execute_query(), .fetch_page()]
- "db_sqlite_sqlitedriver_execute_query": ".execute_query()" | kind=code-symbol | source=src-tauri/src/db/sqlite.rs:L159 | neighbors=[SqliteDriver, is_select(), sqlite_value_to_json()]
- "db_sqlite_sqlitedriver_fetch_page": ".fetch_page()" | kind=code-symbol | source=src-tauri/src/db/sqlite.rs:L282 | neighbors=[SqliteDriver, build_where_sqlite(), sqlite_value_to_json()]
- "hooks_usecontextmenu_usecontextmenu": "useContextMenu()" | kind=code-symbol | source=src/hooks/useContextMenu.ts:L9 | neighbors=[QueryPanel.tsx, Sidebar.tsx, useContextMenu.ts]
- "sidebarparts_connectionitem_connectionitem": "ConnectionItem()" | kind=code-symbol | source=src/components/SidebarParts/ConnectionItem.tsx:L19 | neighbors=[ConnectionItem.tsx, index.ts, SidebarNav.tsx]
- "sidebarparts_databasecategories_databasecategories": "DatabaseCategories()" | kind=code-symbol | source=src/components/SidebarParts/DatabaseCategories.tsx:L28 | neighbors=[ConnectionItem.tsx, DatabaseCategories.tsx, index.ts]
- "sidebarparts_utils_engine_colors": "ENGINE_COLORS" | kind=code-symbol | source=src/components/SidebarParts/utils.tsx:L26 | neighbors=[ConnectionItem.tsx, index.ts, utils.tsx]
- "src_main": "main.tsx" | kind=code-symbol | source=src/main.tsx:L1 | neighbors=[f7b39e6 Add initial project setup with …, App.tsx, main()]
- "tools_generate_knowledge_graph_edge": "Edge" | kind=code-symbol | source=tools/generate-knowledge-graph.py:L42 | neighbors=[generate-knowledge-graph.py, parse_rust_file(), parse_ts_file()]
- "types_db_connectioninfo": "ConnectionInfo" | kind=code-symbol | source=src/types/db.ts:L13 | neighbors=[ConnectionManager.tsx, App.tsx, db.ts]
- "types_db_gridfilter": "GridFilter" | kind=code-symbol | source=src/types/db.ts:L75 | neighbors=[DataGrid.tsx, QueryPanel.tsx, db.ts]
- "commands_db_dbstate": "DbState" | kind=code-symbol | source=src-tauri/src/commands/db.rs:L11 | neighbors=[db.rs, .new()]
- "commands_persistence_load_ui_state": "load_ui_state()" | kind=code-symbol | source=src-tauri/src/commands/persistence.rs:L59 | neighbors=[persistence.rs, get_data_path()]
- "commands_persistence_save_ui_state": "save_ui_state()" | kind=code-symbol | source=src-tauri/src/commands/persistence.rs:L51 | neighbors=[persistence.rs, get_data_path()]
- "commands_workspace_list_scripts": "list_scripts()" | kind=code-symbol | source=src-tauri/src/commands/workspace.rs:L67 | neighbors=[workspace.rs, workspace_path()]
- "components_commandpalette_commandpalette": "CommandPalette()" | kind=code-symbol | source=src/components/CommandPalette.tsx:L43 | neighbors=[CommandPalette.tsx, App.tsx]
- "components_commitfooter_commitfooter": "CommitFooter()" | kind=code-symbol | source=src/components/CommitFooter.tsx:L12 | neighbors=[CommitFooter.tsx, QueryPanel.tsx]
- "components_connectionmanager_connectionmanager": "ConnectionManager()" | kind=code-symbol | source=src/components/ConnectionManager.tsx:L14 | neighbors=[ConnectionManager.tsx, App.tsx]
- "components_emptyworkspacestate_emptyworkspacestate": "EmptyWorkspaceState()" | kind=code-symbol | source=src/components/EmptyWorkspaceState.tsx:L36 | neighbors=[EmptyWorkspaceState.tsx, QueryPanel.tsx]
- "components_homeview_homeview": "HomeView()" | kind=code-symbol | source=src/components/HomeView.tsx:L17 | neighbors=[HomeView.tsx, App.tsx]
- "components_layout_layout": "Layout()" | kind=code-symbol | source=src/components/Layout.tsx:L20 | neighbors=[Layout.tsx, App.tsx]
- "components_querypanel_querypanel": "QueryPanel()" | kind=code-symbol | source=src/components/QueryPanel.tsx:L73 | neighbors=[QueryPanel.tsx, App.tsx]
- "components_schemavisualizer_schemavisualizer": "SchemaVisualizer()" | kind=code-symbol | source=src/components/SchemaVisualizer.tsx:L201 | neighbors=[QueryPanel.tsx, SchemaVisualizer.tsx]
- "components_settingspanel_settingspanel": "SettingsPanel()" | kind=code-symbol | source=src/components/SettingsPanel.tsx:L9 | neighbors=[SettingsPanel.tsx, App.tsx]
- "components_sidebar_sidebar": "Sidebar()" | kind=code-symbol | source=src/components/Sidebar.tsx:L24 | neighbors=[Layout.tsx, Sidebar.tsx]
- "components_sqleditor_sqleditor": "SqlEditor()" | kind=code-symbol | source=src/components/SqlEditor.tsx:L20 | neighbors=[QueryPanel.tsx, SqlEditor.tsx]
- "components_tab_tab": "Tab()" | kind=code-symbol | source=src/components/Tab.tsx:L47 | neighbors=[Tab.tsx, TabBar.tsx]
- "components_tab_tabpayload": "TabPayload" | kind=code-symbol | source=src/components/Tab.tsx:L7 | neighbors=[QueryPanel.tsx, Tab.tsx]
- "components_tabbar_tabbar": "TabBar()" | kind=code-symbol | source=src/components/TabBar.tsx:L63 | neighbors=[QueryPanel.tsx, TabBar.tsx]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: C:\tech-grow\tools\dib\.graphify\description-instructions\batch-002.json

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
