# Node Description Batch 6 of 9

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

- "commands_workspace_save_query_history": "save_query_history()" | kind=code-symbol | source=src-tauri/src/commands/workspace.rs:L168 | neighbors=[workspace.rs]
- "commands_workspace_scriptmeta": "ScriptMeta" | kind=code-symbol | source=src-tauri/src/commands/workspace.rs:L30 | neighbors=[workspace.rs]
- "components_commandpalette_commandaction": "CommandAction" | kind=code-symbol | source=src/components/CommandPalette.tsx:L7 | neighbors=[CommandPalette.tsx]
- "components_commandpalette_commandpaletteprops": "CommandPaletteProps" | kind=code-symbol | source=src/components/CommandPalette.tsx:L33 | neighbors=[CommandPalette.tsx]
- "components_commandpalette_item_category": "ITEM_CATEGORY" | kind=code-symbol | source=src/components/CommandPalette.tsx:L26 | neighbors=[CommandPalette.tsx]
- "components_commandpalette_item_icon": "ITEM_ICON" | kind=code-symbol | source=src/components/CommandPalette.tsx:L19 | neighbors=[CommandPalette.tsx]
- "components_commandpalette_paletteitem": "PaletteItem" | kind=code-symbol | source=src/components/CommandPalette.tsx:L13 | neighbors=[CommandPalette.tsx]
- "components_commitfooter_commitfooterprops": "CommitFooterProps" | kind=code-symbol | source=src/components/CommitFooter.tsx:L5 | neighbors=[CommitFooter.tsx]
- "components_connectionmanager_connectionmanagerprops": "ConnectionManagerProps" | kind=code-symbol | source=src/components/ConnectionManager.tsx:L8 | neighbors=[ConnectionManager.tsx]
- "components_contextmenu_contextmenuitem": "ContextMenuItem" | kind=code-symbol | source=src/components/ContextMenu.tsx:L5 | neighbors=[ContextMenu.tsx]
- "components_contextmenu_contextmenuprops": "ContextMenuProps" | kind=code-symbol | source=src/components/ContextMenu.tsx:L13 | neighbors=[ContextMenu.tsx]
- "components_contextmenu_iconedit": "IconEdit()" | kind=code-symbol | source=src/components/ContextMenu.tsx:L58 | neighbors=[ContextMenu.tsx]
- "components_contextmenu_icontrash": "IconTrash()" | kind=code-symbol | source=src/components/ContextMenu.tsx:L72 | neighbors=[ContextMenu.tsx]
- "components_datagrid_datagridprops": "DataGridProps" | kind=code-symbol | source=src/components/DataGrid.tsx:L11 | neighbors=[DataGrid.tsx]
- "components_emptyworkspacestate_keys": "Keys()" | kind=code-symbol | source=src/components/EmptyWorkspaceState.tsx:L18 | neighbors=[EmptyWorkspaceState.tsx]
- "components_emptyworkspacestate_shortcut": "Shortcut" | kind=code-symbol | source=src/components/EmptyWorkspaceState.tsx:L4 | neighbors=[EmptyWorkspaceState.tsx]
- "components_emptyworkspacestate_shortcuts": "SHORTCUTS" | kind=code-symbol | source=src/components/EmptyWorkspaceState.tsx:L9 | neighbors=[EmptyWorkspaceState.tsx]
- "components_homeview_engine_colors": "ENGINE_COLORS" | kind=code-symbol | source=src/components/HomeView.tsx:L11 | neighbors=[HomeView.tsx]
- "components_homeview_homeviewprops": "HomeViewProps" | kind=code-symbol | source=src/components/HomeView.tsx:L6 | neighbors=[HomeView.tsx]
- "components_layout_layoutprops": "LayoutProps" | kind=code-symbol | source=src/components/Layout.tsx:L11 | neighbors=[Layout.tsx]
- "components_queryhistorypanel_fmtms": "fmtMs()" | kind=code-symbol | source=src/components/QueryHistoryPanel.tsx:L13 | neighbors=[QueryHistoryPanel.tsx]
- "components_queryhistorypanel_fmttime": "fmtTime()" | kind=code-symbol | source=src/components/QueryHistoryPanel.tsx:L18 | neighbors=[QueryHistoryPanel.tsx]
- "components_queryhistorypanel_queryhistorypanel": "QueryHistoryPanel()" | kind=code-symbol | source=src/components/QueryHistoryPanel.tsx:L27 | neighbors=[QueryHistoryPanel.tsx]
- "components_queryhistorypanel_queryhistorypanelprops": "QueryHistoryPanelProps" | kind=code-symbol | source=src/components/QueryHistoryPanel.tsx:L7 | neighbors=[QueryHistoryPanel.tsx]
- "components_querypanel_colicon": "colIcon()" | kind=code-symbol | source=src/components/QueryPanel.tsx:L22 | neighbors=[QueryPanel.tsx]
- "components_querypanel_defaulttabletabstate": "defaultTableTabState()" | kind=code-symbol | source=src/components/QueryPanel.tsx:L56 | neighbors=[QueryPanel.tsx]
- "components_querypanel_fmterr": "fmtErr()" | kind=code-symbol | source=src/components/QueryPanel.tsx:L5 | neighbors=[QueryPanel.tsx]
- "components_querypanel_querypanelprops": "QueryPanelProps" | kind=code-symbol | source=src/components/QueryPanel.tsx:L64 | neighbors=[QueryPanel.tsx]
- "components_querypanel_tabletabid": "tableTabId()" | kind=code-symbol | source=src/components/QueryPanel.tsx:L60 | neighbors=[QueryPanel.tsx]
- "components_querypanel_tabletabstate": "TableTabState" | kind=code-symbol | source=src/components/QueryPanel.tsx:L45 | neighbors=[QueryPanel.tsx]
- "components_schemavisualizer_fullschemaview": "FullSchemaView()" | kind=code-symbol | source=src/components/SchemaVisualizer.tsx:L31 | neighbors=[SchemaVisualizer.tsx]
- "components_schemavisualizer_nodetypes": "nodeTypes" | kind=code-symbol | source=src/components/SchemaVisualizer.tsx:L19 | neighbors=[SchemaVisualizer.tsx]
- "components_schemavisualizer_relationview": "RelationView()" | kind=code-symbol | source=src/components/SchemaVisualizer.tsx:L84 | neighbors=[SchemaVisualizer.tsx]
- "components_schemavisualizer_schemavisualizerprops": "SchemaVisualizerProps" | kind=code-symbol | source=src/components/SchemaVisualizer.tsx:L21 | neighbors=[SchemaVisualizer.tsx]
- "components_settingspanel_settingspanelprops": "SettingsPanelProps" | kind=code-symbol | source=src/components/SettingsPanel.tsx:L4 | neighbors=[SettingsPanel.tsx]
- "components_sidebar_sidebarprops": "SidebarProps" | kind=code-symbol | source=src/components/Sidebar.tsx:L12 | neighbors=[Sidebar.tsx]
- "components_sqleditor_sqleditorprops": "SqlEditorProps" | kind=code-symbol | source=src/components/SqlEditor.tsx:L8 | neighbors=[SqlEditor.tsx]
- "components_statusblock_statusblock": "StatusBlock()" | kind=code-symbol | source=src/components/StatusBlock.tsx:L16 | neighbors=[StatusBlock.tsx]
- "components_statusblock_systemstatus": "SystemStatus" | kind=code-symbol | source=src/components/StatusBlock.tsx:L6 | neighbors=[StatusBlock.tsx]
- "components_tab_icon_map": "ICON_MAP" | kind=code-symbol | source=src/components/Tab.tsx:L40 | neighbors=[Tab.tsx]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: C:\tech-grow\tools\dib\.graphify\description-instructions\batch-005.json

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
