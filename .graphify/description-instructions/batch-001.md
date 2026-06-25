# Node Description Batch 2 of 9

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

- "components_queryhistorypanel": "QueryHistoryPanel.tsx" | kind=code-symbol | source=src/components/QueryHistoryPanel.tsx:L1 | neighbors=[2562ffd Add knowledge graph integration…, fmtMs(), fmtTime(), QueryHistoryPanel(), QueryHistoryPanelProps, db.ts]
- "components_toast": "Toast.tsx" | kind=code-symbol | source=src/components/Toast.tsx:L1 | neighbors=[2562ffd Add knowledge graph integration…, ToastContainer(), ToastContainerProps, ToastItem(), useToast.ts, Toast]
- "storage_mod": "mod.rs" | kind=code-symbol | source=src-tauri/src/storage/mod.rs:L1 | neighbors=[2562ffd Add knowledge graph integration…, f7b39e6 Add initial project setup with …, AppDb, InternalScript, keyring_entry(), QueryHistoryEntry]
- "tools_generate_knowledge_graph_parse_ts_file": "parse_ts_file()" | kind=code-symbol | source=tools/generate-knowledge-graph.py:L78 | neighbors=[generate-knowledge-graph.py, build_graph(), Edge, Node, node_id(), relative()]
- "types_db_tableinfo": "TableInfo" | kind=code-symbol | source=src/types/db.ts:L25 | neighbors=[CommandPalette.tsx, QueryPanel.tsx, SchemaVisualizer.tsx, Tab.tsx, DatabaseCategories.tsx, App.tsx]
- "components_commitfooter": "CommitFooter.tsx" | kind=code-symbol | source=src/components/CommitFooter.tsx:L1 | neighbors=[f7b39e6 Add initial project setup with …, CommitFooter(), CommitFooterProps, db.ts, PendingChange, QueryPanel.tsx]
- "components_emptyworkspacestate": "EmptyWorkspaceState.tsx" | kind=code-symbol | source=src/components/EmptyWorkspaceState.tsx:L1 | neighbors=[2562ffd Add knowledge graph integration…, EmptyWorkspaceState(), Keys(), Shortcut, SHORTCUTS, QueryPanel.tsx]
- "components_settingspanel": "SettingsPanel.tsx" | kind=code-symbol | source=src/components/SettingsPanel.tsx:L1 | neighbors=[f7b39e6 Add initial project setup with …, SettingsPanel(), SettingsPanelProps, useUiState.ts, useUiState(), App.tsx]
- "components_statusblock": "StatusBlock.tsx" | kind=code-symbol | source=src/components/StatusBlock.tsx:L1 | neighbors=[2562ffd Add knowledge graph integration…, f7b39e6 Add initial project setup with …, StatusBlock(), SystemStatus, App.tsx, ToastContext]
- "components_tablenode": "TableNode.tsx" | kind=code-symbol | source=src/components/TableNode.tsx:L1 | neighbors=[f7b39e6 Add initial project setup with …, SchemaVisualizer.tsx, ENGINE_ACCENT, TableNode, TableNodeComponent(), TableNodeData]
- "hooks_usekeybindings_usekeybindings": "useKeybindings()" | kind=code-symbol | source=src/hooks/useKeybindings.ts:L72 | neighbors=[Layout.tsx, QueryPanel.tsx, TableBuilderGrid.tsx, useKeybindings.ts, _initListener(), App.tsx]
- "hooks_usetoast": "useToast.ts" | kind=code-symbol | source=src/hooks/useToast.ts:L1 | neighbors=[2562ffd Add knowledge graph integration…, Toast.tsx, Toast, ToastType, useToast(), App.tsx]
- "storage_mod_keyring_entry": "keyring_entry()" | kind=code-symbol | source=src-tauri/src/storage/mod.rs:L28 | neighbors=[mod.rs, .delete_connection(), .get_connections(), .get_password_for(), .save_connection(), .upsert_password_for()]
- "tools_generate_knowledge_graph_parse_rust_file": "parse_rust_file()" | kind=code-symbol | source=tools/generate-knowledge-graph.py:L189 | neighbors=[generate-knowledge-graph.py, build_graph(), Edge, Node, node_id(), relative()]
- "branch:repo:github.com/CoffeJeanCode/DiB#main": "main" | kind=Branch | source=git | neighbors=[2562ffd Add knowledge graph integration…, 2c5407b Refactor DataGrid and SqlEditor…, 863e6a3 Update project references from …, da9e33b Enhance sidebar functionality a…, f7b39e6 Add initial project setup with …]
- "db_postgres_postgresdriver_fetch_page": ".fetch_page()" | kind=code-symbol | source=src-tauri/src/db/postgres.rs:L291 | neighbors=[PostgresDriver, build_where_pg(), pg_bind_json(), pg_value_to_json(), qualified()]
- "hooks_usecontextmenu": "useContextMenu.ts" | kind=code-symbol | source=src/hooks/useContextMenu.ts:L1 | neighbors=[f7b39e6 Add initial project setup with …, QueryPanel.tsx, Sidebar.tsx, ContextMenuState, useContextMenu()]
- "hooks_usesavedconnections_usesavedconnections": "useSavedConnections()" | kind=code-symbol | source=src/hooks/useSavedConnections.ts:L5 | neighbors=[ConnectionManager.tsx, HomeView.tsx, Sidebar.tsx, useSavedConnections.ts, App.tsx]
- "src_app_toastcontext": "ToastContext" | kind=code-symbol | source=src/App.tsx:L33 | neighbors=[ConnectionManager.tsx, QueryPanel.tsx, StatusBlock.tsx, DatabaseCategories.tsx, App.tsx]
- "tools_generate_knowledge_graph_build_graph": "build_graph()" | kind=code-symbol | source=tools/generate-knowledge-graph.py:L305 | neighbors=[generate-knowledge-graph.py, parse_css_file(), parse_rust_file(), parse_ts_file(), main()]
- "tools_generate_knowledge_graph_main": "main()" | kind=code-symbol | source=tools/generate-knowledge-graph.py:L643 | neighbors=[generate-knowledge-graph.py, build_graph(), write_graph_html(), write_graph_json(), write_graph_report()]
- "tools_generate_knowledge_graph_parse_css_file": "parse_css_file()" | kind=code-symbol | source=tools/generate-knowledge-graph.py:L296 | neighbors=[generate-knowledge-graph.py, build_graph(), Node, node_id(), relative()]
- "types_db_columninfo": "ColumnInfo" | kind=code-symbol | source=src/types/db.ts:L37 | neighbors=[DataGrid.tsx, QueryPanel.tsx, SchemaVisualizer.tsx, TableBuilderGrid.tsx, db.ts]
- "commands_workspace_workspace_path": "workspace_path()" | kind=code-symbol | source=src-tauri/src/commands/workspace.rs:L10 | neighbors=[workspace.rs, list_scripts(), read_script(), save_script()]
- "commit:repo:github.com/CoffeJeanCode/DiB@863e6a355995d9e6adfeaa66b2e6976edb72503b": "863e6a3 Update project references from \"Database Interface Builder\" to \"Data Il…" | kind=Commit | source=git | neighbors=[2c5407b Refactor DataGrid and SqlEditor…, main, HomeView.tsx, generate-knowledge-graph.py]
- "hooks_useuistate_useuistate": "useUiState()" | kind=code-symbol | source=src/hooks/useUiState.ts:L16 | neighbors=[Layout.tsx, SettingsPanel.tsx, useUiState.ts, App.tsx]
- "sidebarparts_scriptitem_scriptitem": "ScriptItem()" | kind=code-symbol | source=src/components/SidebarParts/ScriptItem.tsx:L19 | neighbors=[index.ts, ScriptItem.tsx, getScriptIcon(), SidebarNav.tsx]
- "sidebarparts_sidebarheader": "SidebarHeader.tsx" | kind=code-symbol | source=src/components/SidebarParts/SidebarHeader.tsx:L1 | neighbors=[2562ffd Add knowledge graph integration…, index.ts, SidebarHeader(), SidebarHeaderProps]
- "sidebarparts_utils_getdbname": "getDbName()" | kind=code-symbol | source=src/components/SidebarParts/utils.tsx:L44 | neighbors=[ConnectionItem.tsx, DatabaseSelector.tsx, index.ts, utils.tsx]
- "sidebarparts_utils_getengineicon": "getEngineIcon()" | kind=code-symbol | source=src/components/SidebarParts/utils.tsx:L32 | neighbors=[ConnectionItem.tsx, DatabaseSelector.tsx, index.ts, utils.tsx]
- "src_lib": "lib.rs" | kind=code-symbol | source=src-tauri/src/lib.rs:L1 | neighbors=[2562ffd Add knowledge graph integration…, 2c5407b Refactor DataGrid and SqlEditor…, f7b39e6 Add initial project setup with …, run()]
- "tools_generate_knowledge_graph_node": "Node" | kind=code-symbol | source=tools/generate-knowledge-graph.py:L32 | neighbors=[generate-knowledge-graph.py, parse_css_file(), parse_rust_file(), parse_ts_file()]
- "tools_generate_knowledge_graph_node_id": "node_id()" | kind=code-symbol | source=tools/generate-knowledge-graph.py:L52 | neighbors=[generate-knowledge-graph.py, parse_css_file(), parse_rust_file(), parse_ts_file()]
- "tools_generate_knowledge_graph_relative": "relative()" | kind=code-symbol | source=tools/generate-knowledge-graph.py:L49 | neighbors=[generate-knowledge-graph.py, parse_css_file(), parse_rust_file(), parse_ts_file()]
- "types_db_internalscript": "InternalScript" | kind=code-symbol | source=src/types/db.ts:L103 | neighbors=[CommandPalette.tsx, ScriptItem.tsx, SidebarNav.tsx, db.ts]
- "types_db_pendingchange": "PendingChange" | kind=code-symbol | source=src/types/db.ts:L90 | neighbors=[CommitFooter.tsx, DataGrid.tsx, QueryPanel.tsx, db.ts]
- "commands_persistence_get_data_path": "get_data_path()" | kind=code-symbol | source=src-tauri/src/commands/persistence.rs:L20 | neighbors=[persistence.rs, load_ui_state(), save_ui_state()]
- "commands_system_status": "system_status.rs" | kind=code-symbol | source=src-tauri/src/commands/system_status.rs:L1 | neighbors=[check_system_status(), SystemStatus, f7b39e6 Add initial project setup with …]
- "commands_workspace_read_script": "read_script()" | kind=code-symbol | source=src-tauri/src/commands/workspace.rs:L101 | neighbors=[workspace.rs, safe_filename(), workspace_path()]
- "commands_workspace_safe_filename": "safe_filename()" | kind=code-symbol | source=src-tauri/src/commands/workspace.rs:L21 | neighbors=[workspace.rs, read_script(), save_script()]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: C:\tech-grow\tools\dib\.graphify\description-instructions\batch-001.json

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
