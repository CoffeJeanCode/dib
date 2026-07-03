# Graph Report - src-tauri  (2026-07-02)

## Corpus Check
- 26 files · ~54,294 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 503 nodes · 1250 edges · 41 communities
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 5 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `86b641b3`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 6|Community 6]]
- [[_COMMUNITY_Community 7|Community 7]]
- [[_COMMUNITY_Community 8|Community 8]]
- [[_COMMUNITY_Community 9|Community 9]]
- [[_COMMUNITY_Community 10|Community 10]]
- [[_COMMUNITY_Community 11|Community 11]]
- [[_COMMUNITY_Community 12|Community 12]]
- [[_COMMUNITY_Community 13|Community 13]]
- [[_COMMUNITY_Community 14|Community 14]]
- [[_COMMUNITY_Community 15|Community 15]]
- [[_COMMUNITY_Community 16|Community 16]]
- [[_COMMUNITY_Community 17|Community 17]]
- [[_COMMUNITY_Community 18|Community 18]]
- [[_COMMUNITY_Community 19|Community 19]]
- [[_COMMUNITY_Community 20|Community 20]]
- [[_COMMUNITY_Community 21|Community 21]]
- [[_COMMUNITY_Community 22|Community 22]]
- [[_COMMUNITY_Community 23|Community 23]]
- [[_COMMUNITY_Community 24|Community 24]]
- [[_COMMUNITY_Community 25|Community 25]]
- [[_COMMUNITY_Community 26|Community 26]]
- [[_COMMUNITY_Community 27|Community 27]]
- [[_COMMUNITY_Community 28|Community 28]]
- [[_COMMUNITY_Community 29|Community 29]]
- [[_COMMUNITY_Community 30|Community 30]]
- [[_COMMUNITY_Community 31|Community 31]]
- [[_COMMUNITY_Community 32|Community 32]]
- [[_COMMUNITY_Community 33|Community 33]]
- [[_COMMUNITY_Community 34|Community 34]]
- [[_COMMUNITY_Community 40|Community 40]]

## God Nodes (most connected - your core abstractions)
1. `QueryError` - 70 edges
2. `DbState` - 42 edges
3. `AppDb` - 40 edges
4. `PostgresDriver` - 27 edges
5. `SqliteDriver` - 17 edges
6. `create_driver()` - 11 edges
7. `TableStructure` - 11 edges
8. `definitions` - 10 edges
9. `definitions` - 10 edges
10. `definitions` - 10 edges

## Surprising Connections (you probably didn't know these)
- `assert_connection_in_active_workspace()` --references--> `AppDb`  [EXTRACTED]
  src/commands/connection.rs → src/storage/mod.rs
- `connect_to_db()` --calls--> `create_driver()`  [INFERRED]
  src/commands/connection.rs → src/db/driver.rs
- `test_connection()` --calls--> `create_driver()`  [INFERRED]
  src/commands/connection.rs → src/db/driver.rs
- `connect_saved()` --calls--> `create_driver()`  [INFERRED]
  src/commands/connection.rs → src/db/driver.rs
- `connect_saved()` --references--> `AppDb`  [EXTRACTED]
  src/commands/connection.rs → src/storage/mod.rs

## Import Cycles
- None detected.

## Communities (41 total, 0 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.07
Nodes (64): AppHandle, delete_connection(), get_saved_connections(), save_connection(), check_system_status(), SystemStatus, create_file(), create_folder() (+56 more)

### Community 1 - "Community 1"
Cohesion: 0.05
Nodes (46): AtomicI32, build_where_pg(), decode_fk_action(), execute_query_inner(), is_select(), parse_explain_node(), pg_bind_json(), pg_cast_suffix() (+38 more)

### Community 2 - "Community 2"
Cohesion: 0.09
Nodes (50): Arc, Box, assert_connection_in_active_workspace(), connect_db_lazily(), connect_saved(), connect_to_db(), create_database(), DbState (+42 more)

### Community 3 - "Community 3"
Cohesion: 0.11
Nodes (18): app, security, windows, withGlobalTauri, build, beforeBuildCommand, beforeDevCommand, devUrl (+10 more)

### Community 4 - "Community 4"
Cohesion: 0.13
Nodes (15): definitions, Identifier, Number, PermissionEntry, Target, Value, oneOf, anyOf (+7 more)

### Community 5 - "Community 5"
Cohesion: 0.13
Nodes (15): definitions, Identifier, Number, PermissionEntry, Target, Value, oneOf, anyOf (+7 more)

### Community 6 - "Community 6"
Cohesion: 0.13
Nodes (15): definitions, Identifier, Number, PermissionEntry, Target, Value, oneOf, anyOf (+7 more)

### Community 7 - "Community 7"
Cohesion: 0.18
Nodes (11): properties, description, type, default, description, type, identifier, local (+3 more)

### Community 8 - "Community 8"
Cohesion: 0.18
Nodes (11): properties, description, type, default, description, type, identifier, local (+3 more)

### Community 9 - "Community 9"
Cohesion: 0.18
Nodes (11): properties, description, type, default, description, type, identifier, local (+3 more)

### Community 10 - "Community 10"
Cohesion: 0.20
Nodes (10): $ref, description, items, type, uniqueItems, description, items, type (+2 more)

### Community 11 - "Community 11"
Cohesion: 0.20
Nodes (10): type, webviews, windows, items, description, items, type, description (+2 more)

### Community 12 - "Community 12"
Cohesion: 0.20
Nodes (10): $ref, description, items, type, uniqueItems, description, items, type (+2 more)

### Community 13 - "Community 13"
Cohesion: 0.20
Nodes (10): type, webviews, windows, items, description, items, type, description (+2 more)

### Community 14 - "Community 14"
Cohesion: 0.20
Nodes (10): $ref, description, items, type, uniqueItems, description, items, type (+2 more)

### Community 15 - "Community 15"
Cohesion: 0.20
Nodes (10): type, webviews, windows, items, description, items, type, description (+2 more)

### Community 16 - "Community 16"
Cohesion: 0.25
Nodes (8): description, properties, required, type, CapabilityRemote, urls, description, type

### Community 17 - "Community 17"
Cohesion: 0.25
Nodes (8): description, properties, required, type, CapabilityRemote, urls, description, type

### Community 18 - "Community 18"
Cohesion: 0.25
Nodes (8): description, properties, required, type, CapabilityRemote, urls, description, type

### Community 19 - "Community 19"
Cohesion: 0.33
Nodes (5): description, identifier, permissions, $schema, windows

### Community 20 - "Community 20"
Cohesion: 0.40
Nodes (4): anyOf, description, $schema, title

### Community 21 - "Community 21"
Cohesion: 0.40
Nodes (4): anyOf, description, $schema, title

### Community 22 - "Community 22"
Cohesion: 0.40
Nodes (4): anyOf, description, $schema, title

### Community 23 - "Community 23"
Cohesion: 0.50
Nodes (4): description, required, type, Capability

### Community 24 - "Community 24"
Cohesion: 0.50
Nodes (4): default, description, type, description

### Community 25 - "Community 25"
Cohesion: 0.50
Nodes (4): description, required, type, Capability

### Community 26 - "Community 26"
Cohesion: 0.50
Nodes (4): default, description, type, description

### Community 27 - "Community 27"
Cohesion: 0.50
Nodes (4): description, required, type, Capability

### Community 28 - "Community 28"
Cohesion: 0.50
Nodes (4): default, description, type, description

### Community 29 - "Community 29"
Cohesion: 0.67
Nodes (3): ShellScopeEntryAllowedArg, anyOf, description

### Community 30 - "Community 30"
Cohesion: 0.67
Nodes (3): ShellScopeEntryAllowedArgs, anyOf, description

### Community 31 - "Community 31"
Cohesion: 0.67
Nodes (3): ShellScopeEntryAllowedArg, anyOf, description

### Community 32 - "Community 32"
Cohesion: 0.67
Nodes (3): ShellScopeEntryAllowedArgs, anyOf, description

### Community 33 - "Community 33"
Cohesion: 0.67
Nodes (3): ShellScopeEntryAllowedArg, anyOf, description

### Community 34 - "Community 34"
Cohesion: 0.36
Nodes (5): get_data_path(), load_ui_state(), save_ui_state(), UiState, PathBuf

### Community 40 - "Community 40"
Cohesion: 0.67
Nodes (3): ShellScopeEntryAllowedArgs, anyOf, description

## Knowledge Gaps
- **148 isolated node(s):** `$schema`, `identifier`, `description`, `windows`, `permissions` (+143 more)
  These have ≤1 connection - possible missing edges or undocumented components.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `QueryError` connect `Community 2` to `Community 0`, `Community 1`?**
  _High betweenness centrality (0.020) - this node is a cross-community bridge._
- **Why does `definitions` connect `Community 4` to `Community 16`, `Community 20`, `Community 23`, `Community 29`, `Community 30`?**
  _High betweenness centrality (0.013) - this node is a cross-community bridge._
- **Why does `definitions` connect `Community 5` to `Community 32`, `Community 17`, `Community 21`, `Community 25`, `Community 31`?**
  _High betweenness centrality (0.013) - this node is a cross-community bridge._
- **What connects `$schema`, `identifier`, `description` to the rest of the system?**
  _148 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.07212121212121213 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.050286058416139714 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.09453551912568306 - nodes in this community are weakly interconnected._