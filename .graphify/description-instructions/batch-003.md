# Node Description Batch 4 of 9

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

- "components_tablebuildergrid_computechanges": "computeChanges()" | kind=code-symbol | source=src/components/TableBuilderGrid.tsx:L32 | neighbors=[TableBuilderGrid.tsx, TableBuilderGrid()]
- "components_tablebuildergrid_tablebuildergrid": "TableBuilderGrid()" | kind=code-symbol | source=src/components/TableBuilderGrid.tsx:L82 | neighbors=[TableBuilderGrid.tsx, computeChanges()]
- "components_tablenode_tablenode": "TableNode" | kind=code-symbol | source=src/components/TableNode.tsx:L44 | neighbors=[SchemaVisualizer.tsx, TableNode.tsx]
- "components_tablenode_tablenodedata": "TableNodeData" | kind=code-symbol | source=src/components/TableNode.tsx:L5 | neighbors=[SchemaVisualizer.tsx, TableNode.tsx]
- "components_toast_toastcontainer": "ToastContainer()" | kind=code-symbol | source=src/components/Toast.tsx:L31 | neighbors=[Toast.tsx, App.tsx]
- "db_driver_queryerror": "QueryError" | kind=code-symbol | source=src-tauri/src/db/driver.rs:L29 | neighbors=[driver.rs, .from()]
- "db_postgres_is_select": "is_select()" | kind=code-symbol | source=src-tauri/src/db/postgres.rs:L117 | neighbors=[postgres.rs, .execute_query()]
- "db_postgres_pg_cast_suffix": "pg_cast_suffix()" | kind=code-symbol | source=src-tauri/src/db/postgres.rs:L62 | neighbors=[postgres.rs, .apply_changes()]
- "db_postgres_postgresdriver_apply_schema_changes": ".apply_schema_changes()" | kind=code-symbol | source=src-tauri/src/db/postgres.rs:L476 | neighbors=[PostgresDriver, qualified()]
- "db_postgres_postgresdriver_get_schema_objects": ".get_schema_objects()" | kind=code-symbol | source=src-tauri/src/db/postgres.rs:L168 | neighbors=[PostgresDriver, .get_tables()]
- "db_postgres_postgresdriver_get_tables": ".get_tables()" | kind=code-symbol | source=src-tauri/src/db/postgres.rs:L147 | neighbors=[PostgresDriver, .get_schema_objects()]
- "db_postgres_smart_val": "smart_val()" | kind=code-symbol | source=src-tauri/src/db/postgres.rs:L12 | neighbors=[postgres.rs, build_where_pg()]
- "db_sqlite_build_where_sqlite": "build_where_sqlite()" | kind=code-symbol | source=src-tauri/src/db/sqlite.rs:L8 | neighbors=[sqlite.rs, .fetch_page()]
- "db_sqlite_is_select": "is_select()" | kind=code-symbol | source=src-tauri/src/db/sqlite.rs:L75 | neighbors=[sqlite.rs, .execute_query()]
- "db_sqlite_sqlite_bind_json": "sqlite_bind_json()" | kind=code-symbol | source=src-tauri/src/db/sqlite.rs:L46 | neighbors=[sqlite.rs, .apply_changes()]
- "db_sqlite_sqlitedriver_apply_changes": ".apply_changes()" | kind=code-symbol | source=src-tauri/src/db/sqlite.rs:L197 | neighbors=[SqliteDriver, sqlite_bind_json()]
- "db_sqlite_sqlitedriver_get_schema_objects": ".get_schema_objects()" | kind=code-symbol | source=src-tauri/src/db/sqlite.rs:L117 | neighbors=[SqliteDriver, .get_tables()]
- "db_sqlite_sqlitedriver_get_tables": ".get_tables()" | kind=code-symbol | source=src-tauri/src/db/sqlite.rs:L98 | neighbors=[SqliteDriver, .get_schema_objects()]
- "hooks_usekeybindings_initlistener": "_initListener()" | kind=code-symbol | source=src/hooks/useKeybindings.ts:L35 | neighbors=[useKeybindings.ts, useKeybindings()]
- "hooks_usekeybindings_ismonaco": "_isMonaco()" | kind=code-symbol | source=src/hooks/useKeybindings.ts:L22 | neighbors=[useKeybindings.ts, _isPlainInput()]
- "hooks_usekeybindings_isplaininput": "_isPlainInput()" | kind=code-symbol | source=src/hooks/useKeybindings.ts:L26 | neighbors=[useKeybindings.ts, _isMonaco()]
- "hooks_usetoast_toast": "Toast" | kind=code-symbol | source=src/hooks/useToast.ts:L5 | neighbors=[Toast.tsx, useToast.ts]
- "hooks_usetoast_usetoast": "useToast()" | kind=code-symbol | source=src/hooks/useToast.ts:L14 | neighbors=[useToast.ts, App.tsx]
- "plugins_graphify": "graphify.js" | kind=code-symbol | source=.opencode/plugins/graphify.js:L1 | neighbors=[2562ffd Add knowledge graph integration…, GraphifyPlugin()]
- "sidebarparts_databaseselector_databaseselector": "DatabaseSelector()" | kind=code-symbol | source=src/components/SidebarParts/DatabaseSelector.tsx:L12 | neighbors=[DatabaseSelector.tsx, index.ts]
- "sidebarparts_scriptitem_getscripticon": "getScriptIcon()" | kind=code-symbol | source=src/components/SidebarParts/ScriptItem.tsx:L14 | neighbors=[ScriptItem.tsx, ScriptItem()]
- "sidebarparts_sidebarheader_sidebarheader": "SidebarHeader()" | kind=code-symbol | source=src/components/SidebarParts/SidebarHeader.tsx:L9 | neighbors=[index.ts, SidebarHeader.tsx]
- "sidebarparts_sidebarnav_sidebarnav": "SidebarNav()" | kind=code-symbol | source=src/components/SidebarParts/SidebarNav.tsx:L26 | neighbors=[index.ts, SidebarNav.tsx]
- "sidebarparts_utils_postgresicon": "PostgresIcon()" | kind=code-symbol | source=src/components/SidebarParts/utils.tsx:L4 | neighbors=[index.ts, utils.tsx]
- "sidebarparts_utils_sqliteicon": "SqliteIcon()" | kind=code-symbol | source=src/components/SidebarParts/utils.tsx:L16 | neighbors=[index.ts, utils.tsx]
- "src_tauri_build": "build.rs" | kind=code-symbol | source=src-tauri/build.rs:L1 | neighbors=[f7b39e6 Add initial project setup with …, main()]
- "storage_mod_appdb_delete_connection": ".delete_connection()" | kind=code-symbol | source=src-tauri/src/storage/mod.rs:L221 | neighbors=[AppDb, keyring_entry()]
- "storage_mod_appdb_get_connections": ".get_connections()" | kind=code-symbol | source=src-tauri/src/storage/mod.rs:L132 | neighbors=[AppDb, keyring_entry()]
- "storage_mod_appdb_get_password_for": ".get_password_for()" | kind=code-symbol | source=src-tauri/src/storage/mod.rs:L199 | neighbors=[AppDb, keyring_entry()]
- "storage_mod_appdb_save_connection": ".save_connection()" | kind=code-symbol | source=src-tauri/src/storage/mod.rs:L97 | neighbors=[AppDb, keyring_entry()]
- "storage_mod_appdb_upsert_password_for": ".upsert_password_for()" | kind=code-symbol | source=src-tauri/src/storage/mod.rs:L205 | neighbors=[AppDb, keyring_entry()]
- "tools_generate_knowledge_graph_resolve_cross_refs": "resolve_cross_refs()" | kind=code-symbol | source=tools/generate-knowledge-graph.py:L336 | neighbors=[generate-knowledge-graph.py, Add edges for cross-file references whe…]
- "tools_generate_knowledge_graph_strip_ext": "strip_ext()" | kind=code-symbol | source=tools/generate-knowledge-graph.py:L55 | neighbors=[generate-knowledge-graph.py, parse_ts_file()]
- "tools_generate_knowledge_graph_write_graph_html": "write_graph_html()" | kind=code-symbol | source=tools/generate-knowledge-graph.py:L505 | neighbors=[generate-knowledge-graph.py, main()]
- "tools_generate_knowledge_graph_write_graph_json": "write_graph_json()" | kind=code-symbol | source=tools/generate-knowledge-graph.py:L363 | neighbors=[generate-knowledge-graph.py, main()]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: C:\tech-grow\tools\dib\.graphify\description-instructions\batch-003.json

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
