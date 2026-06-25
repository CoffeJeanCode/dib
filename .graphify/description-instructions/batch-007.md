# Node Description Batch 8 of 9

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

- "hooks_usekeybindings_blocked": "_BLOCKED" | kind=code-symbol | source=src/hooks/useKeybindings.ts:L33 | neighbors=[useKeybindings.ts]
- "hooks_usekeybindings_key": "_key()" | kind=code-symbol | source=src/hooks/useKeybindings.ts:L13 | neighbors=[useKeybindings.ts]
- "hooks_usekeybindings_reg": "_reg" | kind=code-symbol | source=src/hooks/useKeybindings.ts:L10 | neighbors=[useKeybindings.ts]
- "hooks_usekeybindings_shortcutdef": "ShortcutDef" | kind=code-symbol | source=src/hooks/useKeybindings.ts:L3 | neighbors=[useKeybindings.ts]
- "hooks_usetoast_toasttype": "ToastType" | kind=code-symbol | source=src/hooks/useToast.ts:L3 | neighbors=[useToast.ts]
- "hooks_useuistate_default_state": "DEFAULT_STATE" | kind=code-symbol | source=src/hooks/useUiState.ts:L10 | neighbors=[useUiState.ts]
- "hooks_useuistate_uistate": "UiState" | kind=code-symbol | source=src/hooks/useUiState.ts:L4 | neighbors=[useUiState.ts]
- "plugins_graphify_graphifyplugin": "GraphifyPlugin()" | kind=code-symbol | source=.opencode/plugins/graphify.js:L12 | neighbors=[graphify.js]
- "sidebarparts_connectionitem_connectionitemprops": "ConnectionItemProps" | kind=code-symbol | source=src/components/SidebarParts/ConnectionItem.tsx:L7 | neighbors=[ConnectionItem.tsx]
- "sidebarparts_databasecategories_categories": "CATEGORIES" | kind=code-symbol | source=src/components/SidebarParts/DatabaseCategories.tsx:L12 | neighbors=[DatabaseCategories.tsx]
- "sidebarparts_databasecategories_databasecategoriesprops": "DatabaseCategoriesProps" | kind=code-symbol | source=src/components/SidebarParts/DatabaseCategories.tsx:L7 | neighbors=[DatabaseCategories.tsx]
- "sidebarparts_databasecategories_fmterr": "fmtErr()" | kind=code-symbol | source=src/components/SidebarParts/DatabaseCategories.tsx:L19 | neighbors=[DatabaseCategories.tsx]
- "sidebarparts_databaseselector_databaseselectorprops": "DatabaseSelectorProps" | kind=code-symbol | source=src/components/SidebarParts/DatabaseSelector.tsx:L6 | neighbors=[DatabaseSelector.tsx]
- "sidebarparts_scriptitem_scriptitemprops": "ScriptItemProps" | kind=code-symbol | source=src/components/SidebarParts/ScriptItem.tsx:L6 | neighbors=[ScriptItem.tsx]
- "sidebarparts_sidebarheader_sidebarheaderprops": "SidebarHeaderProps" | kind=code-symbol | source=src/components/SidebarParts/SidebarHeader.tsx:L3 | neighbors=[SidebarHeader.tsx]
- "sidebarparts_sidebarnav_navitem": "NavItem" | kind=code-symbol | source=src/components/SidebarParts/SidebarNav.tsx:L22 | neighbors=[SidebarNav.tsx]
- "sidebarparts_sidebarnav_sidebarnavprops": "SidebarNavProps" | kind=code-symbol | source=src/components/SidebarParts/SidebarNav.tsx:L8 | neighbors=[SidebarNav.tsx]
- "src_app_activeconn": "ActiveConn" | kind=code-symbol | source=src/App.tsx:L18 | neighbors=[App.tsx]
- "src_app_app": "App()" | kind=code-symbol | source=src/App.tsx:L35 | neighbors=[App.tsx]
- "src_app_navtable": "NavTable" | kind=code-symbol | source=src/App.tsx:L24 | neighbors=[App.tsx]
- "src_app_openscript": "OpenScript" | kind=code-symbol | source=src/App.tsx:L25 | neighbors=[App.tsx]
- "src_app_toastctx": "ToastCtx" | kind=code-symbol | source=src/App.tsx:L27 | neighbors=[App.tsx]
- "src_lib_run": "run()" | kind=code-symbol | source=src-tauri/src/lib.rs:L15 | neighbors=[lib.rs]
- "src_main_main": "main()" | kind=code-symbol | source=src-tauri/src/main.rs:L3 | neighbors=[main.tsx]
- "src_tauri_build_main": "main()" | kind=code-symbol | source=src-tauri/build.rs:L1 | neighbors=[build.rs]
- "storage_mod_appdb_delete_script_internal": ".delete_script_internal()" | kind=code-symbol | source=src-tauri/src/storage/mod.rs:L283 | neighbors=[AppDb]
- "storage_mod_appdb_get_connection_by_id": ".get_connection_by_id()" | kind=code-symbol | source=src-tauri/src/storage/mod.rs:L174 | neighbors=[AppDb]
- "storage_mod_appdb_get_query_history_internal": ".get_query_history_internal()" | kind=code-symbol | source=src-tauri/src/storage/mod.rs:L302 | neighbors=[AppDb]
- "storage_mod_appdb_get_scripts_internal": ".get_scripts_internal()" | kind=code-symbol | source=src-tauri/src/storage/mod.rs:L257 | neighbors=[AppDb]
- "storage_mod_appdb_init": ".init()" | kind=code-symbol | source=src-tauri/src/storage/mod.rs:L55 | neighbors=[AppDb]
- "storage_mod_appdb_save_query_history_internal": ".save_query_history_internal()" | kind=code-symbol | source=src-tauri/src/storage/mod.rs:L292 | neighbors=[AppDb]
- "storage_mod_appdb_save_script_internal": ".save_script_internal()" | kind=code-symbol | source=src-tauri/src/storage/mod.rs:L242 | neighbors=[AppDb]
- "storage_mod_internalscript": "InternalScript" | kind=code-symbol | source=src-tauri/src/storage/mod.rs:L17 | neighbors=[mod.rs]
- "storage_mod_queryhistoryentry": "QueryHistoryEntry" | kind=code-symbol | source=src-tauri/src/storage/mod.rs:L7 | neighbors=[mod.rs]
- "storage_mod_savedconnection": "SavedConnection" | kind=code-symbol | source=src-tauri/src/storage/mod.rs:L42 | neighbors=[mod.rs]
- "tools_generate_knowledge_graph_rationale_337": "Add edges for cross-file references where imported names match symbol names." | kind=entity | source=tools/generate-knowledge-graph.py:L337 | neighbors=[resolve_cross_refs()]
- "types_db_connectionstatus": "ConnectionStatus" | kind=code-symbol | source=src/types/db.ts:L11 | neighbors=[db.ts]
- "types_db_filteroperator": "FilterOperator" | kind=code-symbol | source=src/types/db.ts:L70 | neighbors=[db.ts]
- "types_db_pendingchangetype": "PendingChangeType" | kind=code-symbol | source=src/types/db.ts:L88 | neighbors=[db.ts]
- "types_db_queryerror": "QueryError" | kind=code-symbol | source=src/types/db.ts:L19 | neighbors=[db.ts]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: C:\tech-grow\tools\dib\.graphify\description-instructions\batch-007.json

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
