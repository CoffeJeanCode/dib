# Node Description Batch 5 of 9

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

- "tools_generate_knowledge_graph_write_graph_report": "write_graph_report()" | kind=code-symbol | source=tools/generate-knowledge-graph.py:L381 | neighbors=[generate-knowledge-graph.py, main()]
- "types_db_dbconfig": "DbConfig" | kind=code-symbol | source=src/types/db.ts:L1 | neighbors=[ConnectionManager.tsx, db.ts]
- "types_db_pagedresult": "PagedResult" | kind=code-symbol | source=src/types/db.ts:L50 | neighbors=[QueryPanel.tsx, db.ts]
- "types_db_queryhistoryentry": "QueryHistoryEntry" | kind=code-symbol | source=src/types/db.ts:L111 | neighbors=[QueryHistoryPanel.tsx, db.ts]
- "types_db_queryresult": "QueryResult" | kind=code-symbol | source=src/types/db.ts:L44 | neighbors=[SqlEditor.tsx, db.ts]
- "types_db_schemachange": "SchemaChange" | kind=code-symbol | source=src/types/db.ts:L122 | neighbors=[TableBuilderGrid.tsx, db.ts]
- "types_db_schemaobjects": "SchemaObjects" | kind=code-symbol | source=src/types/db.ts:L30 | neighbors=[DatabaseCategories.tsx, db.ts]
- "types_db_tablerelation": "TableRelation" | kind=code-symbol | source=src/types/db.ts:L81 | neighbors=[SchemaVisualizer.tsx, db.ts]
- "commands_db_apply_changes": "apply_changes()" | kind=code-symbol | source=src-tauri/src/commands/db.rs:L104 | neighbors=[db.rs]
- "commands_db_apply_schema_changes": "apply_schema_changes()" | kind=code-symbol | source=src-tauri/src/commands/db.rs:L305 | neighbors=[db.rs]
- "commands_db_connect_saved": "connect_saved()" | kind=code-symbol | source=src-tauri/src/commands/db.rs:L137 | neighbors=[db.rs]
- "commands_db_connect_to_db": "connect_to_db()" | kind=code-symbol | source=src-tauri/src/commands/db.rs:L26 | neighbors=[db.rs]
- "commands_db_dbstate_new": ".new()" | kind=code-symbol | source=src-tauri/src/commands/db.rs:L17 | neighbors=[DbState]
- "commands_db_disconnect": "disconnect()" | kind=code-symbol | source=src-tauri/src/commands/db.rs:L225 | neighbors=[db.rs]
- "commands_db_fetch_schema_objects": "fetch_schema_objects()" | kind=code-symbol | source=src-tauri/src/commands/db.rs:L60 | neighbors=[db.rs]
- "commands_db_fetch_table_data": "fetch_table_data()" | kind=code-symbol | source=src-tauri/src/commands/db.rs:L285 | neighbors=[db.rs]
- "commands_db_fetch_table_relations": "fetch_table_relations()" | kind=code-symbol | source=src-tauri/src/commands/db.rs:L269 | neighbors=[db.rs]
- "commands_db_fetch_table_schema": "fetch_table_schema()" | kind=code-symbol | source=src-tauri/src/commands/db.rs:L73 | neighbors=[db.rs]
- "commands_db_fetch_tables": "fetch_tables()" | kind=code-symbol | source=src-tauri/src/commands/db.rs:L47 | neighbors=[db.rs]
- "commands_db_generate_crud_sql": "generate_crud_sql()" | kind=code-symbol | source=src-tauri/src/commands/db.rs:L322 | neighbors=[db.rs]
- "commands_db_list_databases": "list_databases()" | kind=code-symbol | source=src-tauri/src/commands/db.rs:L235 | neighbors=[db.rs]
- "commands_db_run_query": "run_query()" | kind=code-symbol | source=src-tauri/src/commands/db.rs:L91 | neighbors=[db.rs]
- "commands_db_switch_database": "switch_database()" | kind=code-symbol | source=src-tauri/src/commands/db.rs:L246 | neighbors=[db.rs]
- "commands_db_test_connection": "test_connection()" | kind=code-symbol | source=src-tauri/src/commands/db.rs:L125 | neighbors=[db.rs]
- "commands_mod": "mod.rs" | kind=code-symbol | source=src-tauri/src/commands/mod.rs:L1 | neighbors=[f7b39e6 Add initial project setup with …]
- "commands_persistence_default_sidebar_width": "default_sidebar_width()" | kind=code-symbol | source=src-tauri/src/commands/persistence.rs:L9 | neighbors=[persistence.rs]
- "commands_persistence_default_true": "default_true()" | kind=code-symbol | source=src-tauri/src/commands/persistence.rs:L8 | neighbors=[persistence.rs]
- "commands_persistence_delete_connection": "delete_connection()" | kind=code-symbol | source=src-tauri/src/commands/persistence.rs:L45 | neighbors=[persistence.rs]
- "commands_persistence_get_saved_connections": "get_saved_connections()" | kind=code-symbol | source=src-tauri/src/commands/persistence.rs:L39 | neighbors=[persistence.rs]
- "commands_persistence_save_connection": "save_connection()" | kind=code-symbol | source=src-tauri/src/commands/persistence.rs:L30 | neighbors=[persistence.rs]
- "commands_persistence_uistate": "UiState" | kind=code-symbol | source=src-tauri/src/commands/persistence.rs:L12 | neighbors=[persistence.rs]
- "commands_system_status_check_system_status": "check_system_status()" | kind=code-symbol | source=src-tauri/src/commands/system_status.rs:L16 | neighbors=[system_status.rs]
- "commands_system_status_systemstatus": "SystemStatus" | kind=code-symbol | source=src-tauri/src/commands/system_status.rs:L5 | neighbors=[system_status.rs]
- "commands_workspace_delete_internal_script": "delete_internal_script()" | kind=code-symbol | source=src-tauri/src/commands/workspace.rs:L160 | neighbors=[workspace.rs]
- "commands_workspace_export_script_dialog": "export_script_dialog()" | kind=code-symbol | source=src-tauri/src/commands/workspace.rs:L116 | neighbors=[workspace.rs]
- "commands_workspace_get_internal_scripts": "get_internal_scripts()" | kind=code-symbol | source=src-tauri/src/commands/workspace.rs:L154 | neighbors=[workspace.rs]
- "commands_workspace_get_query_history": "get_query_history()" | kind=code-symbol | source=src-tauri/src/commands/workspace.rs:L180 | neighbors=[workspace.rs]
- "commands_workspace_import_script_dialog": "import_script_dialog()" | kind=code-symbol | source=src-tauri/src/commands/workspace.rs:L193 | neighbors=[workspace.rs]
- "commands_workspace_importedscript": "ImportedScript" | kind=code-symbol | source=src-tauri/src/commands/workspace.rs:L108 | neighbors=[workspace.rs]
- "commands_workspace_save_internal_script": "save_internal_script()" | kind=code-symbol | source=src-tauri/src/commands/workspace.rs:L143 | neighbors=[workspace.rs]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: C:\tech-grow\tools\dib\.graphify\description-instructions\batch-004.json

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
