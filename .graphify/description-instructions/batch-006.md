# Node Description Batch 7 of 9

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

- "components_tab_tabprops": "TabProps" | kind=code-symbol | source=src/components/Tab.tsx:L27 | neighbors=[Tab.tsx]
- "components_tab_tabtype": "TabType" | kind=code-symbol | source=src/components/Tab.tsx:L5 | neighbors=[Tab.tsx]
- "components_tabbar_sortabletab": "SortableTab()" | kind=code-symbol | source=src/components/TabBar.tsx:L30 | neighbors=[TabBar.tsx]
- "components_tabbar_tabbarprops": "TabBarProps" | kind=code-symbol | source=src/components/TabBar.tsx:L21 | neighbors=[TabBar.tsx]
- "components_tablebuildergrid_builderrow": "BuilderRow" | kind=code-symbol | source=src/components/TableBuilderGrid.tsx:L8 | neighbors=[TableBuilderGrid.tsx]
- "components_tablebuildergrid_common_types": "COMMON_TYPES" | kind=code-symbol | source=src/components/TableBuilderGrid.tsx:L68 | neighbors=[TableBuilderGrid.tsx]
- "components_tablebuildergrid_fromcolumninfo": "fromColumnInfo()" | kind=code-symbol | source=src/components/TableBuilderGrid.tsx:L19 | neighbors=[TableBuilderGrid.tsx]
- "components_tablebuildergrid_tablebuildergridprops": "TableBuilderGridProps" | kind=code-symbol | source=src/components/TableBuilderGrid.tsx:L73 | neighbors=[TableBuilderGrid.tsx]
- "components_tablenode_engine_accent": "ENGINE_ACCENT" | kind=code-symbol | source=src/components/TableNode.tsx:L12 | neighbors=[TableNode.tsx]
- "components_tablenode_tablenodecomponent": "TableNodeComponent()" | kind=code-symbol | source=src/components/TableNode.tsx:L18 | neighbors=[TableNode.tsx]
- "components_toast_toastcontainerprops": "ToastContainerProps" | kind=code-symbol | source=src/components/Toast.tsx:L6 | neighbors=[Toast.tsx]
- "components_toast_toastitem": "ToastItem()" | kind=code-symbol | source=src/components/Toast.tsx:L11 | neighbors=[Toast.tsx]
- "db_driver_changerow": "ChangeRow" | kind=code-symbol | source=src-tauri/src/db/driver.rs:L72 | neighbors=[driver.rs]
- "db_driver_columninfo": "ColumnInfo" | kind=code-symbol | source=src-tauri/src/db/driver.rs:L64 | neighbors=[driver.rs]
- "db_driver_connectioninfo": "ConnectionInfo" | kind=code-symbol | source=src-tauri/src/db/driver.rs:L22 | neighbors=[driver.rs]
- "db_driver_connectionstatus": "ConnectionStatus" | kind=code-symbol | source=src-tauri/src/db/driver.rs:L16 | neighbors=[driver.rs]
- "db_driver_create_driver": "create_driver()" | kind=code-symbol | source=src-tauri/src/db/driver.rs:L191 | neighbors=[driver.rs]
- "db_driver_databasedriver": "DatabaseDriver" | kind=code-symbol | source=src-tauri/src/db/driver.rs:L143 | neighbors=[driver.rs]
- "db_driver_dbconfig": "DbConfig" | kind=code-symbol | source=src-tauri/src/db/driver.rs:L5 | neighbors=[driver.rs]
- "db_driver_gridfilter": "GridFilter" | kind=code-symbol | source=src-tauri/src/db/driver.rs:L102 | neighbors=[driver.rs]
- "db_driver_pagedresult": "PagedResult" | kind=code-symbol | source=src-tauri/src/db/driver.rs:L118 | neighbors=[driver.rs]
- "db_driver_queryerror_from": ".from()" | kind=code-symbol | source=src-tauri/src/db/driver.rs:L36 | neighbors=[QueryError]
- "db_driver_queryresult": "QueryResult" | kind=code-symbol | source=src-tauri/src/db/driver.rs:L57 | neighbors=[driver.rs]
- "db_driver_schemachange": "SchemaChange" | kind=code-symbol | source=src-tauri/src/db/driver.rs:L129 | neighbors=[driver.rs]
- "db_driver_schemaobjects": "SchemaObjects" | kind=code-symbol | source=src-tauri/src/db/driver.rs:L49 | neighbors=[driver.rs]
- "db_driver_tableinfo": "TableInfo" | kind=code-symbol | source=src-tauri/src/db/driver.rs:L42 | neighbors=[driver.rs]
- "db_driver_tablerelation": "TableRelation" | kind=code-symbol | source=src-tauri/src/db/driver.rs:L110 | neighbors=[driver.rs]
- "db_postgres_postgresdriver_driver_name": ".driver_name()" | kind=code-symbol | source=src-tauri/src/db/postgres.rs:L525 | neighbors=[PostgresDriver]
- "db_postgres_postgresdriver_from_config": ".from_config()" | kind=code-symbol | source=src-tauri/src/db/postgres.rs:L97 | neighbors=[PostgresDriver]
- "db_postgres_postgresdriver_get_table_relations": ".get_table_relations()" | kind=code-symbol | source=src-tauri/src/db/postgres.rs:L436 | neighbors=[PostgresDriver]
- "db_postgres_postgresdriver_get_table_schema": ".get_table_schema()" | kind=code-symbol | source=src-tauri/src/db/postgres.rs:L215 | neighbors=[PostgresDriver]
- "db_postgres_postgresdriver_list_databases": ".list_databases()" | kind=code-symbol | source=src-tauri/src/db/postgres.rs:L517 | neighbors=[PostgresDriver]
- "db_sqlite_sqlitedriver_apply_schema_changes": ".apply_schema_changes()" | kind=code-symbol | source=src-tauri/src/db/sqlite.rs:L352 | neighbors=[SqliteDriver]
- "db_sqlite_sqlitedriver_connect": ".connect()" | kind=code-symbol | source=src-tauri/src/db/sqlite.rs:L61 | neighbors=[SqliteDriver]
- "db_sqlite_sqlitedriver_driver_name": ".driver_name()" | kind=code-symbol | source=src-tauri/src/db/sqlite.rs:L389 | neighbors=[SqliteDriver]
- "db_sqlite_sqlitedriver_get_table_relations": ".get_table_relations()" | kind=code-symbol | source=src-tauri/src/db/sqlite.rs:L328 | neighbors=[SqliteDriver]
- "db_sqlite_sqlitedriver_get_table_schema": ".get_table_schema()" | kind=code-symbol | source=src-tauri/src/db/sqlite.rs:L131 | neighbors=[SqliteDriver]
- "db_sqlite_sqlitedriver_list_databases": ".list_databases()" | kind=code-symbol | source=src-tauri/src/db/sqlite.rs:L385 | neighbors=[SqliteDriver]
- "eslint_config": "eslint.config.js" | kind=code-symbol | source=eslint.config.js:L1 | neighbors=[f7b39e6 Add initial project setup with …]
- "hooks_usecontextmenu_contextmenustate": "ContextMenuState" | kind=code-symbol | source=src/hooks/useContextMenu.ts:L3 | neighbors=[useContextMenu.ts]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: C:\tech-grow\tools\dib\.graphify\description-instructions\batch-006.json

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
