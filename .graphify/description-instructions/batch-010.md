# Node Description Batch 11 of 11

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

- "storage_mod_internalscript": "InternalScript" | kind=code-symbol | source=src-tauri/src/storage/mod.rs:L17 | neighbors=[mod.rs]
- "storage_mod_queryhistoryentry": "QueryHistoryEntry" | kind=code-symbol | source=src-tauri/src/storage/mod.rs:L7 | neighbors=[mod.rs]
- "storage_mod_savedconnection": "SavedConnection" | kind=code-symbol | source=src-tauri/src/storage/mod.rs:L42 | neighbors=[mod.rs]
- "tools_generate_knowledge_graph_rationale_337": "Add edges for cross-file references where imported names match symbol names." | kind=entity | source=tools/generate-knowledge-graph.py:L337 | neighbors=[resolve_cross_refs()]
- "types_db_columnmetadata": "ColumnMetadata" | kind=code-symbol | source=src/types/db.ts:L44 | neighbors=[db.ts]
- "types_db_connectionstatus": "ConnectionStatus" | kind=code-symbol | source=src/types/db.ts:L11 | neighbors=[db.ts]
- "types_db_pendingchangetype": "PendingChangeType" | kind=code-symbol | source=src/types/db.ts:L96 | neighbors=[db.ts]
- "types_db_queryerror": "QueryError" | kind=code-symbol | source=src/types/db.ts:L19 | neighbors=[db.ts]
- "types_db_schemachangekind": "SchemaChangeKind" | kind=code-symbol | source=src/types/db.ts:L128 | neighbors=[db.ts]
- "types_db_scriptinfo": "ScriptInfo" | kind=code-symbol | source=src/types/db.ts:L148 | neighbors=[db.ts]
- "types_db_scriptmeta": "ScriptMeta" | kind=code-symbol | source=src/types/db.ts:L154 | neighbors=[db.ts]
- "vite_config": "vite.config.ts" | kind=code-symbol | source=vite.config.ts:L1 | neighbors=[f7b39e6 Add initial project setup with …]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: C:\tech-grow\tools\dib\.graphify\description-instructions\batch-010.json

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
